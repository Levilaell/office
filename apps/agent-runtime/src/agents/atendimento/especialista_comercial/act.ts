// =============================================================================
// Act — efeitos colaterais do turno do Especialista Comercial.
//
// Fora do graph LangGraph: graph cuida do raciocínio (estado imutável);
// act é o passo de I/O. Recebe `ComposedTurn` (intenção + slots extraídos),
// resolve criar/carregar lead, materializa side-effects.
//
// Cascata por branch:
//
//   silent_handoff   → metadata.assigned_to_human + agent.escalated_human
//                      (best-effort, idempotente). NÃO manda mensagem.
//
//   schedule_response → markLeadScheduledPending + T10b + publish status_changed
//
//   LLM mark_qualified:
//     - merge slots
//     - VERIFICAÇÃO: isQualified(merged) — se LLM mentiu (slots incompletos
//       mas pediu mark_qualified), override pra ask_next_slot com pergunta
//       canonical via renderSlotQuestion
//     - sucesso: markLeadQualified + T10 + lead.qualified + status_changed
//
//   LLM ask_next_slot / acknowledge_then_ask:
//     - merge slots (pode causar transição automática)
//     - se merge transitou pra qualified: fluxo de mark_qualified (T10)
//     - caso contrário: T09 com content do LLM
//
//   LLM escalate_human / request_human_handoff:
//     - markLeadDropped (se ainda não qualificado)
//     - metadata.assigned_to_human + T05 + agent.escalated_human
//
// Em TODOS os casos:
//   - audit_log especialista_comercial.turn com snapshot completo
// =============================================================================

import {
  appendAuditLog,
  createLead,
  getTemplateById,
  isQualified,
  markLeadDropped,
  markLeadQualified,
  markLeadScheduledPending,
  patchConversationMetadata,
  renderSlotQuestion,
  renderTemplate,
  sendAgentMessage,
  updateLeadQualificationData,
  type Json,
  type LeadRow,
  type LeadSlots,
  type LeadSource,
  type ServiceRoleClient,
} from '@office/shared-domain';
import {
  publishEvent,
  type AgentEscalatedHumanPayload,
  type LeadQualifiedPayload,
  type LeadStatusChangedPayload,
} from '@office/shared-events';
import { especialistaComercialPrompt } from '@office/shared-prompts';
import { getMissingSlots } from '@office/shared-domain';
import type { EspecialistaComercialContext } from './tools/context.js';
import type { ComposedTurn } from './graph.js';
import { parseScheduleSuggestion } from './schedule-parser.js';

export type ActInput = {
  context: EspecialistaComercialContext;
  composed: ComposedTurn;
  runId: string;
  traceId: string;
  llmMetrics: {
    promptVersion: string;
    model: string;
    costUsd: number;
  } | null;
};

export type ActOutput = {
  /** Lead ao final do turno (criado se não existia). null em silent_handoff
   *  quando lead também não existia (caso degenerado — não deveria chegar aqui). */
  leadId: string | null;
  /** Status do lead após materializar. Útil pra logs e debug. */
  leadStatus: string | null;
  /** Última ação realmente executada (pode divergir do composed.intendedAction
   *  quando override de mark_qualified). */
  executedAction:
    | 'ask_next_slot'
    | 'acknowledge_then_ask'
    | 'mark_qualified'
    | 'schedule_response'
    | 'escalate_human'
    | 'silent_handoff'
    | 'mark_qualified_overridden';
  /** Id da mensagem outbound enviada (null quando silent ou falha). */
  outboundMessageId: string | null;
  /** Eventos publicados. */
  publishedEvents: ReadonlyArray<string>;
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const channelToLeadSource = (channel: string): LeadSource => {
  switch (channel) {
    case 'simulated_webhook':
      return 'simulated_webhook';
    case 'email':
      return 'email_imap';
    case 'whatsapp':
      // sem distinguir Evolution/Cloud nesta camada — TD pra resolver
      return 'whatsapp_evolution';
    case 'sms':
      return 'unknown';
    default:
      return 'unknown';
  }
};

const extractFirstName = (fullName: string): string => {
  const trimmed = fullName.trim();
  const space = trimmed.indexOf(' ');
  return space === -1 ? trimmed : trimmed.slice(0, space);
};

const resolveResponsavelName = (
  context: EspecialistaComercialContext,
): string => {
  // Fase 1: usa signature do tenant como nome do responsável comercial.
  // Quando tenants.display_settings ganhar `commercial_lead_name`, prefere
  // esse campo. TD pra adicionar.
  return context.displaySettings.signature;
};

const sendRenderedTemplate = async (
  supabase: ServiceRoleClient,
  context: EspecialistaComercialContext,
  templateId: string,
  variables: Record<string, unknown>,
  traceId: string,
): Promise<
  | { ok: true; messageId: string; templateId: string }
  | { ok: false; reason: string }
> => {
  const tpl = getTemplateById(templateId);
  if (!tpl) return { ok: false, reason: `template ${templateId} desconhecido` };
  const rendered = renderTemplate(templateId, variables);
  if (!rendered.ok) {
    const reason =
      rendered.reason === 'missing_variables'
        ? `template ${templateId} faltando: ${(rendered.missing ?? []).join(',')}`
        : `template ${templateId} desconhecido`;
    return { ok: false, reason };
  }
  const result = await sendAgentMessage(supabase, {
    tenantId: context.conversation.tenant_id,
    conversationId: context.conversation.id,
    accountId: context.conversation.account_id,
    agentId: context.agent.id,
    content: rendered.content,
    traceId,
    ...(context.conversation.subject !== null && {
      subject: `Re: ${context.conversation.subject}`,
    }),
  });
  if (!result.ok) return { ok: false, reason: result.reason };
  return { ok: true, messageId: result.messageId, templateId };
};

const publishLeadStatusChanged = async (
  tenantId: string,
  leadId: string,
  previousStatus: string,
  status: string,
  traceId: string,
): Promise<void> => {
  if (previousStatus === status) return;
  const payload: LeadStatusChangedPayload = {
    tenantId,
    leadId,
    previousStatus,
    status,
    traceId,
  };
  await publishEvent(
    'lead.status_changed',
    `tenant:${tenantId}`,
    payload,
    traceId,
  );
};

const publishLeadQualified = async (
  context: EspecialistaComercialContext,
  lead: LeadRow,
  traceId: string,
): Promise<void> => {
  const payload: LeadQualifiedPayload = {
    tenantId: context.conversation.tenant_id,
    leadId: lead.id,
    conversationId: context.conversation.id,
    agentId: context.agent.id,
    traceId,
    qualificationSummary: lead.qualification_data as Record<string, unknown>,
  };
  await publishEvent(
    'lead.qualified',
    `tenant:${context.conversation.tenant_id}`,
    payload,
    traceId,
  );
};

const escalateHumanSideEffects = async (
  supabase: ServiceRoleClient,
  context: EspecialistaComercialContext,
  reason: string,
  traceId: string,
): Promise<{ messageId: string | null; eventPublished: boolean }> => {
  // 1. Marca conversation como aguardando humano (idempotente — patch
  // sobrescreve campos sem mexer no resto da metadata).
  await patchConversationMetadata(supabase, {
    conversationId: context.conversation.id,
    metadataPatch: {
      assigned_to_human: true,
      escalated_at: new Date().toISOString(),
      escalated_reason: reason,
    },
  });

  // 2. Manda T05 (best-effort).
  const rendered = await sendRenderedTemplate(
    supabase,
    context,
    'T05',
    { bot_name: context.displaySettings.bot_name },
    traceId,
  );
  const messageId = rendered.ok ? rendered.messageId : null;

  // 3. Publica evento.
  const escalationPayload: AgentEscalatedHumanPayload = {
    tenantId: context.conversation.tenant_id,
    agentId: context.agent.id,
    conversationId: context.conversation.id,
    messageId: context.message.id,
    reason,
    intent: 'comercial.lead_novo',
    traceId,
  };
  await publishEvent(
    'agent.escalated_human',
    `tenant:${context.conversation.tenant_id}`,
    escalationPayload,
    traceId,
  );

  return { messageId, eventPublished: true };
};

const ensureLead = async (
  supabase: ServiceRoleClient,
  context: EspecialistaComercialContext,
): Promise<LeadRow> => {
  if (context.lead) return context.lead;
  return createLead(supabase, {
    tenantId: context.conversation.tenant_id,
    source: channelToLeadSource(context.conversation.channel),
    sourceMetadata: {
      channel: context.conversation.channel,
      channel_handle: context.conversation.channel_handle,
    },
    primaryConversationId: context.conversation.id,
  });
};

// -----------------------------------------------------------------------------
// Materialize qualified flow — usado por mark_qualified do LLM e por slot
// merge que dispara qualified.
// -----------------------------------------------------------------------------

const materializeQualified = async (
  supabase: ServiceRoleClient,
  context: EspecialistaComercialContext,
  lead: LeadRow,
  traceId: string,
): Promise<{ messageId: string | null; events: string[] }> => {
  const previousStatus = lead.status;
  const marked = await markLeadQualified(supabase, lead.id);

  const leadFirstName = extractFirstName(
    (marked.lead.qualification_data as Record<string, unknown>)
      ?.contact_name as string ?? 'cliente',
  );
  const responsavelName = resolveResponsavelName(context);

  const rendered = await sendRenderedTemplate(
    supabase,
    context,
    'T10',
    {
      lead_first_name: leadFirstName,
      responsavel_name: responsavelName,
    },
    traceId,
  );

  const events: string[] = [];
  await publishLeadStatusChanged(
    context.conversation.tenant_id,
    lead.id,
    previousStatus,
    marked.lead.status,
    traceId,
  );
  if (previousStatus !== marked.lead.status) {
    events.push('lead.status_changed');
  }

  // Publica lead.qualified APENAS na primeira transição pra qualified
  // (se já estava qualified, evita evento duplicado).
  if (previousStatus !== 'qualified' && previousStatus !== 'scheduled_pending') {
    await publishLeadQualified(context, marked.lead, traceId);
    events.push('lead.qualified');
  }

  return {
    messageId: rendered.ok ? rendered.messageId : null,
    events,
  };
};

// -----------------------------------------------------------------------------
// Main act
// -----------------------------------------------------------------------------

export const act = async (
  supabase: ServiceRoleClient,
  input: ActInput,
): Promise<ActOutput> => {
  const { context, composed, runId, traceId, llmMetrics } = input;
  const conversation = context.conversation;

  let leadId: string | null = context.lead?.id ?? null;
  let leadStatus: string | null = context.lead?.status ?? null;
  let outboundMessageId: string | null = null;
  const publishedEvents: string[] = [];
  let executedAction: ActOutput['executedAction'] = 'silent_handoff';
  const auditMetadata: Record<string, unknown> = {
    intended_action: composed.intendedAction,
    confidence: composed.confidence,
    reasoning: composed.reasoning,
  };
  if (composed.escalationReason) {
    auditMetadata.escalation_reason = composed.escalationReason;
  }

  // ---------------------------------------------------------------------------
  // BRANCH: silent_handoff
  // ---------------------------------------------------------------------------
  if (composed.rawOutput === null && composed.escalationReason !== null) {
    // Sem rawOutput E com escalationReason → veio do pre_detect silent
    // OU schedule_response com flag. Distinguir pelo intendedAction.
    if (composed.intendedAction === 'escalate_human') {
      executedAction = 'silent_handoff';
      // Lead pode ou não existir. Se não existe, ainda assim marca conver-
      // sation como assigned_to_human (idempotente).
      await patchConversationMetadata(supabase, {
        conversationId: conversation.id,
        metadataPatch: {
          assigned_to_human: true,
          escalated_at: new Date().toISOString(),
          escalated_reason: composed.reasoning,
        },
      });
      const payload: AgentEscalatedHumanPayload = {
        tenantId: conversation.tenant_id,
        agentId: context.agent.id,
        conversationId: conversation.id,
        messageId: context.message.id,
        reason: composed.reasoning,
        intent: 'comercial.lead_novo',
        traceId,
      };
      await publishEvent(
        'agent.escalated_human',
        `tenant:${conversation.tenant_id}`,
        payload,
        traceId,
      );
      publishedEvents.push('agent.escalated_human');
      await writeAuditTurn({
        supabase,
        context,
        runId,
        traceId,
        llmMetrics,
        composed,
        auditMetadata: {
          ...auditMetadata,
          branch: 'silent_handoff',
          lead_id: leadId,
        },
      });
      return {
        leadId,
        leadStatus,
        executedAction,
        outboundMessageId,
        publishedEvents,
      };
    }

    if (composed.intendedAction === 'mark_qualified') {
      // BRANCH: schedule_response (preDetect marcou via mark_qualified)
      executedAction = 'schedule_response';
      // Lead garantidamente existe (preDetect só entra em schedule_response
      // se lead.status === 'qualified'). Defesa:
      if (!context.lead) {
        // Caso degenerado — vira escalate
        await patchConversationMetadata(supabase, {
          conversationId: conversation.id,
          metadataPatch: { assigned_to_human: true },
        });
        executedAction = 'silent_handoff';
        await writeAuditTurn({
          supabase,
          context,
          runId,
          traceId,
          llmMetrics,
          composed,
          auditMetadata: {
            ...auditMetadata,
            branch: 'schedule_response_no_lead',
            error: 'schedule_response branch sem lead',
          },
        });
        return {
          leadId,
          leadStatus,
          executedAction,
          outboundMessageId,
          publishedEvents,
        };
      }

      const parsed = parseScheduleSuggestion(context.message.content);
      const previousStatus = context.lead.status;
      const marked = await markLeadScheduledPending(supabase, context.lead.id, {
        scheduledAt: parsed.scheduledAt,
        notes: parsed.notes,
      });
      leadId = marked.lead.id;
      leadStatus = marked.lead.status;

      const responsavelName = resolveResponsavelName(context);
      const rendered = await sendRenderedTemplate(
        supabase,
        context,
        'T10b',
        { responsavel_name: responsavelName },
        traceId,
      );
      outboundMessageId = rendered.ok ? rendered.messageId : null;
      auditMetadata.template = 'T10b';
      auditMetadata.schedule_parsed = {
        scheduled_at: parsed.scheduledAt?.toISOString() ?? null,
        notes: parsed.notes,
      };

      await publishLeadStatusChanged(
        conversation.tenant_id,
        marked.lead.id,
        previousStatus,
        marked.lead.status,
        traceId,
      );
      if (previousStatus !== marked.lead.status) {
        publishedEvents.push('lead.status_changed');
      }
      await writeAuditTurn({
        supabase,
        context,
        runId,
        traceId,
        llmMetrics,
        composed,
        auditMetadata: {
          ...auditMetadata,
          branch: 'schedule_response',
          lead_id: leadId,
        },
      });
      return {
        leadId,
        leadStatus,
        executedAction,
        outboundMessageId,
        publishedEvents,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // BRANCH: LLM ran — process composed.intendedAction with slots merge first
  // ---------------------------------------------------------------------------

  // 1. Garante lead (cria se necessário). Toda ação LLM precisa de lead.
  const lead = await ensureLead(supabase, context);
  leadId = lead.id;
  leadStatus = lead.status;
  if (!context.lead) {
    auditMetadata.lead_created = true;
  }

  // 2. Merge slots extraídos.
  let updatedLead: LeadRow = lead;
  const slotsBefore = (lead.qualification_data ?? {}) as LeadSlots;
  let mergedSlots: LeadSlots = slotsBefore;
  let previousStatus = lead.status;

  if (Object.keys(composed.extractedSlots).length > 0) {
    const result = await updateLeadQualificationData(
      supabase,
      lead.id,
      composed.extractedSlots,
    );
    updatedLead = result.lead;
    leadStatus = updatedLead.status;
    mergedSlots = (updatedLead.qualification_data ?? {}) as LeadSlots;
    previousStatus = result.previousStatus;
    if (result.statusChanged) {
      await publishLeadStatusChanged(
        conversation.tenant_id,
        lead.id,
        previousStatus,
        updatedLead.status,
        traceId,
      );
      publishedEvents.push('lead.status_changed');
    }
    auditMetadata.slots_extracted_keys = Object.keys(composed.extractedSlots);
  }

  auditMetadata.slots_before = slotsBefore;
  auditMetadata.slots_after = mergedSlots;
  auditMetadata.status_before = previousStatus;
  auditMetadata.status_after = updatedLead.status;

  // 3. Decide ação efetiva com base em estado real pós-merge.
  const fullyQualified = isQualified(mergedSlots);

  // ESCALATE_HUMAN / REQUEST_HUMAN_HANDOFF
  if (
    composed.intendedAction === 'escalate_human' ||
    composed.intendedAction === 'request_human_handoff'
  ) {
    executedAction = 'escalate_human';
    // Marca lead como dropped se ainda não está qualificado (ele tava
    // qualificando — pediu humano = saiu do funil).
    if (
      updatedLead.status !== 'qualified' &&
      updatedLead.status !== 'scheduled_pending' &&
      updatedLead.status !== 'converted'
    ) {
      const dropReason =
        composed.intendedAction === 'request_human_handoff'
          ? 'lead solicitou falar com humano'
          : composed.escalationReason ?? 'agente escalou pra humano';
      const dropped = await markLeadDropped(
        supabase,
        updatedLead.id,
        dropReason,
      );
      updatedLead = dropped.lead;
      leadStatus = updatedLead.status;
      if (dropped.previousStatus !== updatedLead.status) {
        await publishLeadStatusChanged(
          conversation.tenant_id,
          updatedLead.id,
          dropped.previousStatus,
          updatedLead.status,
          traceId,
        );
        if (!publishedEvents.includes('lead.status_changed')) {
          publishedEvents.push('lead.status_changed');
        }
      }
    }

    const { messageId } = await escalateHumanSideEffects(
      supabase,
      context,
      composed.escalationReason ?? composed.reasoning,
      traceId,
    );
    outboundMessageId = messageId;
    publishedEvents.push('agent.escalated_human');
    auditMetadata.template = 'T05';

    await writeAuditTurn({
      supabase,
      context,
      runId,
      traceId,
      llmMetrics,
      composed,
      auditMetadata: { ...auditMetadata, branch: 'escalate_human', lead_id: leadId },
    });
    return {
      leadId,
      leadStatus,
      executedAction,
      outboundMessageId,
      publishedEvents,
    };
  }

  // MARK_QUALIFIED — com verificação de integridade
  if (composed.intendedAction === 'mark_qualified') {
    if (!fullyQualified) {
      // LLM mentiu. Override pra ask_next_slot com pergunta canonical.
      const missing = getMissingSlots(mergedSlots);
      const nextSlot = missing[0];
      if (!nextSlot) {
        // Não há slot pra perguntar mas isQualified=false — caso impossível,
        // mas defensivo: escala humano.
        const { messageId } = await escalateHumanSideEffects(
          supabase,
          context,
          'mark_qualified inválido: isQualified=false mas sem slot pra perguntar',
          traceId,
        );
        outboundMessageId = messageId;
        publishedEvents.push('agent.escalated_human');
        executedAction = 'escalate_human';
        auditMetadata.error = 'mark_qualified_inconsistente';
        await writeAuditTurn({
          supabase,
          context,
          runId,
          traceId,
          llmMetrics,
          composed,
          auditMetadata: { ...auditMetadata, branch: 'mark_qualified_inconsistente', lead_id: leadId },
        });
        return {
          leadId,
          leadStatus,
          executedAction,
          outboundMessageId,
          publishedEvents,
        };
      }

      executedAction = 'mark_qualified_overridden';
      const canonicalQuestion = renderSlotQuestion(nextSlot);
      const rendered = await sendRenderedTemplate(
        supabase,
        context,
        'T09',
        { content: canonicalQuestion },
        traceId,
      );
      outboundMessageId = rendered.ok ? rendered.messageId : null;
      auditMetadata.mark_qualified_overridden = true;
      auditMetadata.llm_rejected_content = composed.llmContent;
      auditMetadata.override_next_slot = nextSlot;
      auditMetadata.template = 'T09';

      await writeAuditTurn({
        supabase,
        context,
        runId,
        traceId,
        llmMetrics,
        composed,
        auditMetadata: {
          ...auditMetadata,
          branch: 'mark_qualified_overridden',
          lead_id: leadId,
        },
      });
      return {
        leadId,
        leadStatus,
        executedAction,
        outboundMessageId,
        publishedEvents,
      };
    }

    // Caminho feliz: fully qualified.
    executedAction = 'mark_qualified';
    const result = await materializeQualified(
      supabase,
      context,
      updatedLead,
      traceId,
    );
    outboundMessageId = result.messageId;
    for (const e of result.events) {
      if (!publishedEvents.includes(e)) publishedEvents.push(e);
    }
    leadStatus = 'qualified';
    auditMetadata.template = 'T10';
    auditMetadata.llm_rejected_content = composed.llmContent;
    await writeAuditTurn({
      supabase,
      context,
      runId,
      traceId,
      llmMetrics,
      composed,
      auditMetadata: { ...auditMetadata, branch: 'mark_qualified', lead_id: leadId },
    });
    return {
      leadId,
      leadStatus,
      executedAction,
      outboundMessageId,
      publishedEvents,
    };
  }

  // ASK_NEXT_SLOT / ACKNOWLEDGE_THEN_ASK
  if (
    composed.intendedAction === 'ask_next_slot' ||
    composed.intendedAction === 'acknowledge_then_ask'
  ) {
    // Edge case: slot merge transitou pra qualified — LLM não previu.
    // Override pra mark_qualified path.
    if (fullyQualified && updatedLead.status === 'qualified') {
      executedAction = 'mark_qualified';
      const result = await materializeQualified(
        supabase,
        context,
        updatedLead,
        traceId,
      );
      outboundMessageId = result.messageId;
      for (const e of result.events) {
        if (!publishedEvents.includes(e)) publishedEvents.push(e);
      }
      leadStatus = 'qualified';
      auditMetadata.template = 'T10';
      auditMetadata.auto_promoted_to_qualified = true;
      auditMetadata.llm_rejected_content = composed.llmContent;
      await writeAuditTurn({
        supabase,
        context,
        runId,
        traceId,
        llmMetrics,
        composed,
        auditMetadata: { ...auditMetadata, branch: 'auto_qualified', lead_id: leadId },
      });
      return {
        leadId,
        leadStatus,
        executedAction,
        outboundMessageId,
        publishedEvents,
      };
    }

    executedAction = composed.intendedAction;
    const content =
      composed.llmContent && composed.llmContent.trim().length > 0
        ? composed.llmContent
        : '...';
    const rendered = await sendRenderedTemplate(
      supabase,
      context,
      'T09',
      { content },
      traceId,
    );
    outboundMessageId = rendered.ok ? rendered.messageId : null;
    auditMetadata.template = 'T09';
    await writeAuditTurn({
      supabase,
      context,
      runId,
      traceId,
      llmMetrics,
      composed,
      auditMetadata: { ...auditMetadata, branch: 'slot_question', lead_id: leadId },
    });
    return {
      leadId,
      leadStatus,
      executedAction,
      outboundMessageId,
      publishedEvents,
    };
  }

  // Defensivo: ação desconhecida. Escala humano.
  const { messageId } = await escalateHumanSideEffects(
    supabase,
    context,
    `intent action desconhecido: ${composed.intendedAction}`,
    traceId,
  );
  outboundMessageId = messageId;
  publishedEvents.push('agent.escalated_human');
  executedAction = 'escalate_human';
  await writeAuditTurn({
    supabase,
    context,
    runId,
    traceId,
    llmMetrics,
    composed,
    auditMetadata: {
      ...auditMetadata,
      branch: 'unknown_action',
      lead_id: leadId,
    },
  });
  return {
    leadId,
    leadStatus,
    executedAction,
    outboundMessageId,
    publishedEvents,
  };
};

// -----------------------------------------------------------------------------
// Audit
// -----------------------------------------------------------------------------

type WriteAuditTurnInput = {
  supabase: ServiceRoleClient;
  context: EspecialistaComercialContext;
  runId: string;
  traceId: string;
  llmMetrics: ActInput['llmMetrics'];
  composed: ComposedTurn;
  auditMetadata: Record<string, unknown>;
};

const writeAuditTurn = async (input: WriteAuditTurnInput): Promise<void> => {
  await appendAuditLog(input.supabase, {
    trace_id: input.traceId,
    tenant_id: input.context.conversation.tenant_id,
    account_id: input.context.conversation.account_id,
    actor: `agent:${input.context.agent.id}`,
    action: 'especialista_comercial.turn',
    resource: `conversation:${input.context.conversation.id}`,
    prompt_version: input.llmMetrics?.promptVersion ?? null,
    model: input.llmMetrics?.model ?? null,
    cost_usd: input.llmMetrics?.costUsd ?? null,
    metadata: {
      run_id: input.runId,
      message_id: input.context.message.id,
      ...input.auditMetadata,
    } satisfies Json,
  });
};

export const PROMPT_VERSION = `${especialistaComercialPrompt.id}@${especialistaComercialPrompt.version}`;
