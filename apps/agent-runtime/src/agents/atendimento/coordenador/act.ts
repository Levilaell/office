// =============================================================================
// Act — executa a decisão do Coordenador (efeitos colaterais).
//
// Fora do graph LangGraph de propósito: graph cuida do raciocínio (estado
// imutável); act é o passo de I/O (DB, canal externo, pub/sub).
//
// Sequência por decision:
//   respond_direct  → renderTemplate → sendAgentMessage
//   handoff_specialist → publica agent.handoff_requested
//   escalate_human  → patch conversation.metadata + manda T05 (best-effort)
//                     + publica agent.escalated_human
//
// Em TODOS os casos:
//   - recordClassification (histórico + intent_current)
//   - publica conversation.intent_changed
//   - audit_log coordenador.classified
// =============================================================================

import {
  appendAuditLog,
  getTemplateById,
  patchConversationMetadata,
  recordClassification,
  renderTemplate,
  sendAgentMessage,
  type ClassificationDecision,
  type Json,
  type ServiceRoleClient,
} from '@office/shared-domain';
import {
  publishEvent,
  type AgentEscalatedHumanPayload,
  type AgentHandoffRequestedPayload,
  type ConversationIntentChangedPayload,
} from '@office/shared-events';
import { coordenadorAtendimentoPrompt } from '@office/shared-prompts';
import type { ClassificationOutput } from './graph.js';
import type { DecideResult } from './decide.js';
import type { CoordenadorContext } from './tools/context.js';

export type ActInput = {
  context: CoordenadorContext;
  decision: DecideResult;
  classification: ClassificationOutput | null;
  classificationError: string | null;
  preClassifyHandled: boolean;
  runId: string;
  traceId: string;
  /** Métricas de custo/modelo do LLM call (ou null se pre-classify pulou). */
  llmMetrics: {
    promptVersion: string;
    model: string;
    costUsd: number;
  } | null;
};

export type ActOutput = {
  classificationId: string;
  decision: ClassificationDecision;
  outboundMessageId: string | null;
  handoffPublished: boolean;
  escalationPublished: boolean;
};

const buildDecisionMetadata = (input: ActInput): Record<string, unknown> => {
  const { decision, classification } = input;
  const out: Record<string, unknown> = {
    rationale: decision.rationale,
    promoted: decision.promoted,
    pre_classify: input.preClassifyHandled,
  };
  if (decision.definition?.targetAgent) {
    out.target_agent_key = decision.definition.targetAgent;
  }
  if (decision.definition?.template) {
    out.suggested_template = decision.definition.template;
  }
  if (classification?.alternatives && classification.alternatives.length > 0) {
    out.alternatives = classification.alternatives;
  }
  if (input.classificationError) {
    out.llm_error = input.classificationError;
  }
  return out;
};

const renderForDecision = (
  input: ActInput,
):
  | { ok: true; content: string; template: string }
  | { ok: false; reason: string } => {
  // Quando alguém precisa de mensagem outbound (respond_direct ou
  // escalate_human), escolhemos o template:
  //  - respond_direct: template do intent (catálogo)
  //  - escalate_human: T05 padrão
  const fallback = 'T05';
  const id =
    input.decision.decision === 'respond_direct'
      ? input.decision.definition?.template ?? fallback
      : fallback;

  const template = getTemplateById(id);
  if (!template) {
    return { ok: false, reason: `template ${id} desconhecido` };
  }

  const rendered = renderTemplate(id, {
    bot_name: input.context.displaySettings.bot_name,
    next_business_window: 'em breve',
  });
  if (!rendered.ok) {
    const reason =
      rendered.reason === 'missing_variables'
        ? `template ${id} faltando: ${(rendered.missing ?? []).join(',')}`
        : `template ${id} desconhecido`;
    return { ok: false, reason };
  }
  return { ok: true, content: rendered.content, template: id };
};

export const act = async (
  supabase: ServiceRoleClient,
  input: ActInput,
): Promise<ActOutput> => {
  const {
    context,
    decision,
    classification,
    runId,
    traceId,
    llmMetrics,
  } = input;
  const conversation = context.conversation;
  const message = context.message;
  const agentId = context.coordinatorAgent.id;

  const decisionMetadata = buildDecisionMetadata(input);

  let outboundMessageId: string | null = null;
  let handoffPublished = false;
  let escalationPublished = false;

  // 1. Side-effect específico por decisão.
  if (decision.decision === 'respond_direct') {
    const rendered = renderForDecision(input);
    if (!rendered.ok) {
      decisionMetadata.render_failure = rendered.reason;
      // Degrada pra escalate_human — não mandamos mensagem mutilada.
      decision.decision = 'escalate_human';
      decision.rationale = `${decision.rationale} | render falhou: ${rendered.reason}`;
    } else {
      const result = await sendAgentMessage(supabase, {
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
      if (result.ok) {
        outboundMessageId = result.messageId;
        decisionMetadata.outbound_message_id = result.messageId;
        decisionMetadata.template = rendered.template;
      } else {
        decisionMetadata.send_failure = result.reason;
        decision.decision = 'escalate_human';
        decision.rationale = `${decision.rationale} | envio falhou: ${result.reason}`;
      }
    }
  }

  if (decision.decision === 'handoff_specialist') {
    const targetAgentKey = decision.definition?.targetAgent;
    if (!targetAgentKey) {
      // Não deveria acontecer (catálogo garante targetAgent em handoffs),
      // mas se acontecer, escalamos humano em vez de publicar handoff cego.
      decision.decision = 'escalate_human';
      decision.rationale =
        `${decision.rationale} | handoff_specialist sem targetAgent no catálogo`;
    } else {
      const payload: AgentHandoffRequestedPayload = {
        fromAgentId: agentId,
        toAgentKey: targetAgentKey,
        tenantId: conversation.tenant_id,
        accountId: conversation.account_id,
        conversationId: conversation.id,
        messageId: message.id,
        traceId,
        intent: decision.intent,
        reasoning: decision.rationale,
        context: {
          confidence: classification?.confidence ?? null,
          template: decision.definition?.template ?? null,
        },
      };
      await publishEvent(
        'agent.handoff_requested',
        `tenant:${conversation.tenant_id}`,
        payload,
        traceId,
      );
      handoffPublished = true;
      decisionMetadata.target_agent_key = targetAgentKey;
    }
  }

  if (decision.decision === 'escalate_human') {
    // Marca a conversation como aguardando humano (metadata patch — coluna
    // dedicada vira refactor futuro).
    await patchConversationMetadata(supabase, {
      conversationId: conversation.id,
      metadataPatch: {
        assigned_to_human: true,
        escalated_at: new Date().toISOString(),
        escalated_reason: decision.rationale,
      },
    });

    // Best-effort: manda T05 ao cliente. Falha em enviar NÃO derruba a
    // escalação — humano ainda vê na UI.
    const rendered = renderForDecision({
      ...input,
      decision: { ...decision, decision: 'escalate_human' },
    });
    if (rendered.ok) {
      const result = await sendAgentMessage(supabase, {
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
      if (result.ok) {
        outboundMessageId = result.messageId;
        decisionMetadata.escalation_message_id = result.messageId;
        decisionMetadata.template = rendered.template;
      } else {
        decisionMetadata.escalation_send_failure = result.reason;
      }
    }

    const escalationPayload: AgentEscalatedHumanPayload = {
      tenantId: conversation.tenant_id,
      agentId,
      conversationId: conversation.id,
      messageId: message.id,
      reason: decision.rationale,
      intent: decision.intent,
      traceId,
    };
    await publishEvent(
      'agent.escalated_human',
      `tenant:${conversation.tenant_id}`,
      escalationPayload,
      traceId,
    );
    escalationPublished = true;
  }

  // 2. Histórico de classificações + atualiza intent_current.
  const classificationRow = await recordClassification(supabase, {
    tenantId: conversation.tenant_id,
    conversationId: conversation.id,
    messageId: message.id,
    agentId,
    agentRunId: runId,
    intent: decision.intent,
    confidence: classification?.confidence ?? null,
    reasoning:
      classification?.reasoning ??
      (input.preClassifyHandled ? decision.rationale : null),
    decision: decision.decision,
    decisionMetadata,
    promptVersion: llmMetrics?.promptVersion ?? null,
    model: llmMetrics?.model ?? null,
    costUsd: llmMetrics?.costUsd ?? null,
  });

  // 3. UI escuta esse evento pra atualizar badge sem refetch da lista inteira.
  const intentChanged: ConversationIntentChangedPayload = {
    tenantId: conversation.tenant_id,
    conversationId: conversation.id,
    intent: decision.intent,
    decision: decision.decision,
    classificationId: classificationRow.id,
    confidence: classification?.confidence ?? null,
  };
  await publishEvent(
    'conversation.intent_changed',
    `tenant:${conversation.tenant_id}`,
    intentChanged,
    traceId,
  );

  // 4. Audit_log estruturado da decisão do Coordenador.
  await appendAuditLog(supabase, {
    trace_id: traceId,
    tenant_id: conversation.tenant_id,
    account_id: conversation.account_id,
    actor: `agent:${agentId}`,
    action: 'coordenador.classified',
    resource: `conversation:${conversation.id}`,
    prompt_version: llmMetrics?.promptVersion ?? null,
    model: llmMetrics?.model ?? null,
    cost_usd: llmMetrics?.costUsd ?? null,
    metadata: {
      intent: decision.intent,
      decision: decision.decision,
      classification_id: classificationRow.id,
      message_id: message.id,
      ...(handoffPublished && { handoff_published: true }),
      ...(escalationPublished && { escalation_published: true }),
      ...(outboundMessageId !== null && { outbound_message_id: outboundMessageId }),
      pre_classify: input.preClassifyHandled,
      rationale: decision.rationale,
    } satisfies Json,
  });

  return {
    classificationId: classificationRow.id,
    decision: decision.decision,
    outboundMessageId,
    handoffPublished,
    escalationPublished,
  };
};

export const PROMPT_VERSION = `${coordenadorAtendimentoPrompt.id}@${coordenadorAtendimentoPrompt.version}`;
