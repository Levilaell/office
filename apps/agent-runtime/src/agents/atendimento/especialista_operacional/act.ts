// =============================================================================
// Act do Especialista Operacional — efeitos colaterais.
//
// Vive fora do graph LangGraph (igual padrão do Coordenador). Responsabilidade:
//
//   1. Criar `message_drafts` row com proposed_content + reasoning + confidence
//   2. Em respond / request_clarification:
//      - Envia mensagem outbound via sendAgentMessage
//      - Marca draft como `auto_approved` com vínculo à mensagem
//   3. Em escalate_human:
//      - patch conversation.metadata (assigned_to_human = true)
//      - Manda T_NO_DATA / T05 (best-effort)
//      - Publica `agent.escalated_human`
//   4. Em TODOS os casos:
//      - Publica `specialist.responded`
//      - audit_log `especialista_operacional.responded`
//
// Decisão pragmática Sprint 1.3: tier sugestivo opera em "draft + envio direto"
// (status `auto_approved` no draft). Sprint 1.5 introduz `pending` real, UI de
// inbox, worker de expiração. Ver TD-021.
// =============================================================================

import {
  appendAuditLog,
  createDraft,
  getTemplateById,
  markDraftAutoApproved,
  patchConversationMetadata,
  renderTemplate,
  sendAgentMessage,
  type Json,
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

  // -------------------------------------------------------------------------
  // RESPOND / REQUEST_CLARIFICATION
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

    // 1. Cria draft (status default = pending, mas vamos sobrescrever).
    const draft = await createDraft(supabase, {
      tenantId: conversation.tenant_id,
      conversationId: conversation.id,
      agentId,
      agentRunId: runId,
      sourceMessageId: message.id,
      proposedContent: content,
      reasoning: response.reasoning,
      confidence: response.confidence,
    });
    draftId = draft.id;

    // 2. Envia outbound.
    const sendResult = await sendAgentMessage(supabase, {
      tenantId: conversation.tenant_id,
      conversationId: conversation.id,
      accountId: conversation.account_id,
      agentId,
      content,
      traceId,
      ...(conversation.subject !== null && {
        subject: `Re: ${conversation.subject}`,
      }),
    });

    if (sendResult.ok) {
      outboundMessageId = sendResult.messageId;
      // 3. Marca draft como auto_approved + vincula mensagem final.
      await markDraftAutoApproved(supabase, draftId, sendResult.messageId, {
        autonomy_tier: context.specialistAgent.autonomy_tier,
        template_used: response.template_used,
        action: response.action,
      });
    } else {
      // Falha de envio → escala humano. O draft pending criado acima NÃO é
      // limpo automaticamente — fica como histórico de "respostas tentadas
      // mas não enviadas". Vai aparecer como pending no inbox da Sprint 1.5;
      // operador decide se tenta reenviar manual ou rejeita. Não usamos
      // `expired` aqui porque o motivo não é tempo decorrido — é falha
      // técnica que merece atenção humana imediata.
      noDataPath = false;
      return await escalateFromHandler(supabase, {
        ...input,
        response: {
          ...response,
          action: 'escalate_human',
          escalation_reason: `falha ao enviar mensagem: ${sendResult.reason}`,
        },
      });
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
    } satisfies Json,
  });

  return {
    draftId,
    outboundMessageId,
    action: response.action,
    escalationPublished,
    noDataPath,
  };
};

// -----------------------------------------------------------------------------
// Sub-rotina: escalação humana.
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
  let draftId: string | null = null;

  const template = getTemplateById(templateId);
  if (template) {
    const rendered = renderTemplate(templateId, { bot_name: botName });
    if (rendered.ok) {
      // Cria draft do template de escalação pra rastrear também.
      const draft = await createDraft(supabase, {
        tenantId: conversation.tenant_id,
        conversationId: conversation.id,
        agentId,
        agentRunId: input.runId,
        sourceMessageId: message.id,
        proposedContent: rendered.content,
        reasoning: response.reasoning,
        confidence: response.confidence,
      });
      draftId = draft.id;

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
        await markDraftAutoApproved(supabase, draft.id, sendResult.messageId, {
          escalation_template: templateId,
        });
      }
      // Falha de envio NÃO derruba a escalação — humano ainda vê na UI.
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

  return { draftId, outboundMessageId, escalationPublished: true, noDataPath };
};

// Quando act precisa degradar (envio falhou etc) e chamar escalate sem re-entrar
// no act original. Mantém grava + audit log corretos.
const escalateFromHandler = async (
  supabase: ServiceRoleClient,
  input: ActInput,
): Promise<ActOutput> => act(supabase, input);

export const PROMPT_VERSION = `${especialistaOperacionalPrompt.id}@${especialistaOperacionalPrompt.version}`;
