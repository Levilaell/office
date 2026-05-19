// =============================================================================
// materializeProposal — decide entre "draft pending" e "envio direto" baseado
// no tier de autonomia do agente.
//
// ADR-017 (modo shadow):
//   - tier `sugestivo`        → cria draft com status='pending' e expires_at.
//                               NÃO envia mensagem ao cliente final.
//                               Publica draft.created pra UI mostrar inbox.
//   - tier `semi_autonomo`    → envia mensagem direto via ChannelAdapter,
//                               grava draft com status='auto_approved'
//                               vinculado ao final_message_id (rastreabilidade).
//   - tier `manual`/`autonomo` (não suportados Fase 1) → opera como sugestivo
//                               + warning no log.
//
// Especialistas chamam essa função quando vão *propor* uma resposta normal
// (T03/T06/T07/T08/T08b/T09/T10). Caminhos de escalação (T05, T_NO_DATA, T10b)
// continuam enviando direto sem materializar draft — feedback rápido pro
// cliente importa mais que aprovação humana nesses casos.
// =============================================================================

import {
  computeDraftExpiresAt,
  createDraft,
  getDraftExpirationMinutes,
  markDraftAutoApproved,
} from './drafts';
import { sendAgentMessage } from '../channels/outbound';
import type { ServiceRoleClient } from '@office/shared-db';
import {
  publishEvent,
  type DraftCreatedPayload,
} from '@office/shared-events';

export type AutonomyTier = 'manual' | 'sugestivo' | 'semi_autonomo' | 'autonomo';

export type MaterializeProposalInput = {
  tenantId: string;
  conversationId: string;
  accountId: string | null;
  agentId: string;
  agentRunId?: string | null;
  sourceMessageId?: string | null;
  autonomyTier: string;
  /** Texto que o operador (em sugestivo) ou cliente final (em semi_autonomo)
   *  vai ver. Já renderizado a partir do template. */
  proposedContent: string;
  /** Reasoning livre do agente — UI mostra na sheet pro operador. */
  reasoning?: string | null;
  confidence?: number | null;
  /** Identificador do template usado (T03, T08, T10b, ...). Salvo em
   *  decision_metadata quando auto_approved. */
  templateUsed?: string | null;
  /** Subject opcional pra outbound (e-mail). */
  subject?: string | null;
  traceId: string;
};

export type MaterializeProposalResult =
  | {
      kind: 'queued_for_approval';
      draftId: string;
      expiresAt: string;
      tierApplied: 'sugestivo';
      /** True quando agente vinha configurado como `manual`/`autonomo` mas
       *  caímos no sugestivo por falta de suporte na Fase 1. UI/audit pode
       *  sinalizar.  */
      fellBackToSugestivo: boolean;
    }
  | {
      kind: 'sent_direct';
      draftId: string;
      messageId: string;
      tierApplied: 'semi_autonomo';
    }
  | {
      kind: 'send_failed';
      draftId: string | null;
      reason: string;
    };

const UNSUPPORTED_TIERS = new Set(['manual', 'autonomo']);

const normalizeTier = (
  tier: string,
): { effective: 'sugestivo' | 'semi_autonomo'; fellBack: boolean } => {
  if (tier === 'sugestivo') return { effective: 'sugestivo', fellBack: false };
  if (tier === 'semi_autonomo') return { effective: 'semi_autonomo', fellBack: false };
  // manual / autonomo / qualquer outro → cai pra sugestivo (Fase 1 não suporta)
  return { effective: 'sugestivo', fellBack: true };
};

export const materializeProposal = async (
  supabase: ServiceRoleClient,
  input: MaterializeProposalInput,
): Promise<MaterializeProposalResult> => {
  const { effective, fellBack } = normalizeTier(input.autonomyTier);
  if (fellBack && UNSUPPORTED_TIERS.has(input.autonomyTier)) {
    console.warn(
      `[materializeProposal] tier '${input.autonomyTier}' não suportado na Fase 1, ` +
        `operando como 'sugestivo' (agentId=${input.agentId})`,
    );
  }

  // -------------------------------------------------------------------------
  // SUGESTIVO — cria draft pending, publica draft.created. NÃO envia.
  // -------------------------------------------------------------------------
  if (effective === 'sugestivo') {
    const expirationMinutes = await getDraftExpirationMinutes(
      supabase,
      input.tenantId,
    );
    const expiresAt = computeDraftExpiresAt(expirationMinutes);
    const draft = await createDraft(supabase, {
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      agentId: input.agentId,
      proposedContent: input.proposedContent,
      ...(input.agentRunId !== undefined && { agentRunId: input.agentRunId }),
      ...(input.sourceMessageId !== undefined && {
        sourceMessageId: input.sourceMessageId,
      }),
      ...(input.reasoning !== undefined && { reasoning: input.reasoning }),
      ...(input.confidence !== undefined && { confidence: input.confidence }),
      status: 'pending',
      expiresAt,
    });

    const payload: DraftCreatedPayload = {
      tenantId: input.tenantId,
      draftId: draft.id,
      conversationId: input.conversationId,
      agentId: input.agentId,
      traceId: input.traceId,
      proposedContent: input.proposedContent,
      confidence: input.confidence ?? null,
      expiresAt,
    };
    try {
      await publishEvent(
        'draft.created',
        `tenant:${input.tenantId}`,
        payload,
        input.traceId,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[materializeProposal] publish draft.created falhou', {
        draftId: draft.id,
        message,
      });
    }

    return {
      kind: 'queued_for_approval',
      draftId: draft.id,
      expiresAt,
      tierApplied: 'sugestivo',
      fellBackToSugestivo: fellBack,
    };
  }

  // -------------------------------------------------------------------------
  // SEMI_AUTONOMO — envia direto, depois vincula draft auto_approved.
  // -------------------------------------------------------------------------
  if (!input.accountId) {
    // Defesa: outbound exige accountId. Caller deve ter validado, mas
    // não silenciamos — degradamos pra sugestivo nesse caso.
    return materializeProposal(supabase, {
      ...input,
      autonomyTier: 'sugestivo',
    });
  }

  // Cria draft pending primeiro (pra ter rastreabilidade mesmo se send falhar).
  const draft = await createDraft(supabase, {
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    agentId: input.agentId,
    proposedContent: input.proposedContent,
    ...(input.agentRunId !== undefined && { agentRunId: input.agentRunId }),
    ...(input.sourceMessageId !== undefined && {
      sourceMessageId: input.sourceMessageId,
    }),
    ...(input.reasoning !== undefined && { reasoning: input.reasoning }),
    ...(input.confidence !== undefined && { confidence: input.confidence }),
    status: 'pending',
    // Sem expiresAt — tier semi_autonomo não usa expiração.
  });

  const sendResult = await sendAgentMessage(supabase, {
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    accountId: input.accountId,
    agentId: input.agentId,
    content: input.proposedContent,
    ...(input.subject !== undefined && input.subject !== null && {
      subject: input.subject,
    }),
    traceId: input.traceId,
  });

  if (!sendResult.ok) {
    // Draft fica como pending — operador vê no inbox que tem mensagem que
    // não foi enviada. Worker de expiração depois pega.
    return {
      kind: 'send_failed',
      draftId: draft.id,
      reason: sendResult.reason,
    };
  }

  await markDraftAutoApproved(supabase, draft.id, sendResult.messageId, {
    autonomy_tier: input.autonomyTier,
    template_used: input.templateUsed ?? null,
  });

  return {
    kind: 'sent_direct',
    draftId: draft.id,
    messageId: sendResult.messageId,
    tierApplied: 'semi_autonomo',
  };
};
