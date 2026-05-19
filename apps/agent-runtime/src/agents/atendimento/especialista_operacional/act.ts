// =============================================================================
// Act do Especialista Operacional — efeitos colaterais.
//
// Vive fora do graph LangGraph (igual padrão do Coordenador). Responsabilidade:
//
//   1. Em respond / request_clarification:
//      - Delega pra materializeProposal: decide draft pending (sugestivo)
//        vs envio direto + auto_approved (semi_autonomo).
//      - Se send falhar em semi_autonomo, escala humano.
//   2. Em escalate_human:
//      - patch conversation.metadata (assigned_to_human = true)
//      - Manda T_NO_DATA / T05 direto (SEM draft — feedback rápido pro cliente
//        importa mais que aprovação humana quando estamos escalando)
//      - Publica `agent.escalated_human`
//   3. Em TODOS os casos:
//      - Publica `specialist.responded`
//      - audit_log `especialista_operacional.responded`
//
// Sprint 1.5: TD-021 do self-review 1.3 fechado — tier sugestivo agora cria
// draft pending real e NÃO envia até operador aprovar. ADR-017 implementado.
// =============================================================================

import {
  appendAuditLog,
  getTemplateById,
  materializeProposal,
  patchConversationMetadata,
  renderTemplate,
  sendAgentMessage,
  type Json,
  type MaterializeProposalResult,
  type ServiceRoleClient,
} from '@office/shared-domain';
import {
  publishEvent,
  type AgentEscalatedHumanPayload,
  type SpecialistRespondedPayload,
} from '@office/shared-events';
import { especialistaOperacionalPrompt } from '@office/shared-prompts';
import type { EspecialistaResponse } from './graph.js';
import type { EspecialistaOperacionalContext } from './tools/context.js';

export type ActInput = {
  context: EspecialistaOperacionalContext;
  /** Pode ser null em curto-circuito (ex: sem account) — handler injeta uma
   *  resposta sintética escalando humano antes de chamar act. */
  response: EspecialistaResponse;
  /** Quando handler curto-circuita SEM rodar LLM, marcamos isso. */
  preDecided: boolean;
  intent: string;
  runId: string;
  traceId: string;
  llmMetrics: {
    promptVersion: string;
    model: string;
    costUsd: number;
  } | null;
};

export type ActOutput = {
  draftId: string | null;
  outboundMessageId: string | null;
  action: EspecialistaResponse['action'];
  escalationPublished: boolean;
  /** True se mandamos T_NO_DATA em escalate_human (quando motivo era sem-dados). */
  noDataPath: boolean;
  /** True quando draft ficou pending (tier sugestivo); UI mostra inbox. */
  queuedForApproval: boolean;
  /** Tier efetivamente aplicado (pode divergir do configurado quando manual/
   *  autonomo caem pra sugestivo na Fase 1). null em escalações. */
  tierApplied: 'sugestivo' | 'semi_autonomo' | null;
};

const ESCALATION_TEMPLATE_DEFAULT = 'T05';
const ESCALATION_TEMPLATE_NO_DATA = 'T_NO_DATA';

const NO_DATA_HINT = /sem dados|sem dado|não\s*encontr|nao\s*encontr/i;

const pickEscalationTemplate = (
  response: EspecialistaResponse,
): { id: string; noDataPath: boolean } => {
  const reason = response.escalation_reason ?? '';
  if (
    response.template_used === ESCALATION_TEMPLATE_NO_DATA ||
    NO_DATA_HINT.test(reason)
  ) {
    return { id: ESCALATION_TEMPLATE_NO_DATA, noDataPath: true };
  }
  return { id: ESCALATION_TEMPLATE_DEFAULT, noDataPath: false };
};

export const act = async (
  supabase: ServiceRoleClient,
  input: ActInput,
): Promise<ActOutput> => {
  const { context, response, intent, runId, traceId, llmMetrics } = input;
  const conversation = context.conversation;
  const message = context.message;
  const agentId = context.specialistAgent.id;
  const agentKey = context.specialistAgent.agent_key;

  let draftId: string | null = null;
  let outboundMessageId: string | null = null;
  let escalationPublished = false;
  let noDataPath = false;
  let queuedForApproval = false;
  let tierApplied: ActOutput['tierApplied'] = null;

  // -------------------------------------------------------------------------
  // RESPOND / REQUEST_CLARIFICATION → materializeProposal (sugestivo vs auto)
  // -------------------------------------------------------------------------
  if (response.action === 'respond' || response.action === 'request_clarification') {
    const content = response.content ?? '';
    if (!content) {
      // Defesa em profundidade — schema já valida. Se chegar aqui, escala.
      return await escalateFromHandler(supabase, {
        ...input,
        response: {
          ...response,
          action: 'escalate_human',
          escalation_reason: 'content vazio inesperadamente',
        },
      });
    }

    const result: MaterializeProposalResult = await materializeProposal(supabase, {
      tenantId: conversation.tenant_id,
      conversationId: conversation.id,
      accountId: conversation.account_id,
      agentId,
      agentRunId: runId,
      sourceMessageId: message.id,
      autonomyTier: context.specialistAgent.autonomy_tier,
      proposedContent: content,
      reasoning: response.reasoning,
      confidence: response.confidence,
      templateUsed: response.template_used,
      subject: conversation.subject !== null ? `Re: ${conversation.subject}` : null,
      traceId,
    });

    if (result.kind === 'send_failed') {
      // Send falhou em semi_autonomo. Draft fica como pending (operador vê
      // no inbox + pode reenviar). Vamos escalar humano com motivo claro
      // pra cliente final ter feedback rápido (T05).
      draftId = result.draftId;
      return await escalateFromHandler(supabase, {
        ...input,
        response: {
          ...response,
          action: 'escalate_human',
          escalation_reason: `falha ao enviar mensagem: ${result.reason}`,
        },
      });
    }
    draftId = result.draftId;
    tierApplied = result.tierApplied;
    if (result.kind === 'queued_for_approval') {
      // Tier sugestivo — draft pending, NÃO enviou. Operador aprova/edita/
      // rejeita via UI de inbox.
      queuedForApproval = true;
    } else {
      // Tier semi_autonomo — enviou direto, draft auto_approved vinculado.
      outboundMessageId = result.messageId;
    }
  }

  // -------------------------------------------------------------------------
  // ESCALATE_HUMAN
  // -------------------------------------------------------------------------
  if (response.action === 'escalate_human') {
    const escalationResult = await runEscalation(supabase, input, agentKey);
    draftId = escalationResult.draftId;
    outboundMessageId = escalationResult.outboundMessageId;
    escalationPublished = escalationResult.escalationPublished;
    noDataPath = escalationResult.noDataPath;
  }

  // -------------------------------------------------------------------------
  // EVENTOS + AUDIT — sempre
  // -------------------------------------------------------------------------
  const responded: SpecialistRespondedPayload = {
    tenantId: conversation.tenant_id,
    conversationId: conversation.id,
    messageId: outboundMessageId,
    draftId,
    agentId,
    agentKey,
    traceId,
    intent,
    action: response.action,
    dataUsed: response.data_used,
  };
  await publishEvent(
    'specialist.responded',
    `tenant:${conversation.tenant_id}`,
    responded,
    traceId,
  );

  await appendAuditLog(supabase, {
    trace_id: traceId,
    tenant_id: conversation.tenant_id,
    account_id: conversation.account_id,
    actor: `agent:${agentId}`,
    action: 'especialista_operacional.responded',
    resource: `conversation:${conversation.id}`,
    prompt_version: llmMetrics?.promptVersion ?? null,
    model: llmMetrics?.model ?? null,
    cost_usd: llmMetrics?.costUsd ?? null,
    metadata: {
      intent,
      action: response.action,
      confidence: response.confidence,
      reasoning: response.reasoning,
      template_used: response.template_used,
      data_used: response.data_used,
      ...(response.escalation_reason !== undefined && {
        escalation_reason: response.escalation_reason,
      }),
      pre_decided: input.preDecided,
      ...(outboundMessageId !== null && { outbound_message_id: outboundMessageId }),
      ...(draftId !== null && { draft_id: draftId }),
      ...(escalationPublished && { escalation_published: true }),
      ...(noDataPath && { no_data_path: true }),
      ...(queuedForApproval && { queued_for_approval: true }),
      ...(tierApplied !== null && { tier_applied: tierApplied }),
      configured_autonomy_tier: context.specialistAgent.autonomy_tier,
    } satisfies Json,
  });

  return {
    draftId,
    outboundMessageId,
    action: response.action,
    escalationPublished,
    noDataPath,
    queuedForApproval,
    tierApplied,
  };
};

// -----------------------------------------------------------------------------
// Sub-rotina: escalação humana.
//
// Sprint 1.5: T05/T_NO_DATA enviam DIRETO (sem materializar draft). Cliente
// precisa de feedback imediato de que humano vai pegar; esperar aprovação
// humana pra mandar "vou verificar e volto" é ruído sem ganho.
// Audit_log preserva o conteúdo enviado (campo template_used + reason).
// -----------------------------------------------------------------------------
const runEscalation = async (
  supabase: ServiceRoleClient,
  input: ActInput,
  agentKey: string,
): Promise<{
  draftId: string | null;
  outboundMessageId: string | null;
  escalationPublished: boolean;
  noDataPath: boolean;
}> => {
  const { context, response, traceId } = input;
  const conversation = context.conversation;
  const message = context.message;
  const agentId = context.specialistAgent.id;
  const botName = context.displaySettings.bot_name;

  await patchConversationMetadata(supabase, {
    conversationId: conversation.id,
    metadataPatch: {
      assigned_to_human: true,
      escalated_at: new Date().toISOString(),
      escalated_reason: response.escalation_reason ?? response.reasoning,
      escalated_by_agent_key: agentKey,
    },
  });

  const { id: templateId, noDataPath } = pickEscalationTemplate(response);
  let outboundMessageId: string | null = null;

  const template = getTemplateById(templateId);
  if (template) {
    const rendered = renderTemplate(templateId, { bot_name: botName });
    if (rendered.ok) {
      const sendResult = await sendAgentMessage(supabase, {
        tenantId: conversation.tenant_id,
        conversationId: conversation.id,
        accountId: conversation.account_id,
        agentId,
        content: rendered.content,
        traceId,
        ...(conversation.subject !== null && {
          subject: `Re: ${conversation.subject}`,
        }),
      });
      if (sendResult.ok) {
        outboundMessageId = sendResult.messageId;
      }
      // Falha de envio NÃO derruba a escalação — humano ainda vê na UI via
      // conversation.metadata.assigned_to_human.
    }
  }

  const escalationPayload: AgentEscalatedHumanPayload = {
    tenantId: conversation.tenant_id,
    agentId,
    conversationId: conversation.id,
    messageId: message.id,
    reason: response.escalation_reason ?? response.reasoning,
    intent: input.intent,
    traceId,
  };
  await publishEvent(
    'agent.escalated_human',
    `tenant:${conversation.tenant_id}`,
    escalationPayload,
    traceId,
  );

  return {
    draftId: null,
    outboundMessageId,
    escalationPublished: true,
    noDataPath,
  };
};

// Quando act precisa degradar (envio falhou etc) e chamar escalate sem re-entrar
// no act original. Mantém grava + audit log corretos.
const escalateFromHandler = async (
  supabase: ServiceRoleClient,
  input: ActInput,
): Promise<ActOutput> => act(supabase, input);

export const PROMPT_VERSION = `${especialistaOperacionalPrompt.id}@${especialistaOperacionalPrompt.version}`;
