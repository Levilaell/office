// =============================================================================
// Repositório de message_drafts
//
// Tabela criada na migration 20260520000001_message_drafts.sql.
// ADR-017 separa drafts (respostas em conversa síncrona) de approvals (ações
// regulatórias) — semânticas distintas (expiração curta vs. bloqueio rígido).
//
// Sprint 1.3 entrega o mínimo:
//   - createDraft               — INSERT
//   - getDraftById              — leitura única
//   - listPendingDrafts         — inbox de aprovação (Sprint 1.5 consome)
//   - approveDraft              — UPDATE atômico com guard de status (anti-race)
//   - markDraftAutoApproved     — UPDATE pra auto_approved com vínculo à mensagem
//
// Sprint 1.5 adiciona: rejectDraft, editDraft, expireDraft + worker de expiração.
// =============================================================================

import type {
  AuthenticatedClient,
  Database,
  Json,
  ServiceRoleClient,
} from '@office/shared-db';

export type MessageDraftRow =
  Database['public']['Tables']['message_drafts']['Row'];
export type MessageDraftInsert =
  Database['public']['Tables']['message_drafts']['Insert'];
export type MessageDraftUpdate =
  Database['public']['Tables']['message_drafts']['Update'];

type AnyClient = AuthenticatedClient | ServiceRoleClient;

export type MessageDraftStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'edited'
  | 'expired'
  | 'auto_approved';

export type MessageDraftContentType = 'text' | 'system_event';

export type CreateDraftInput = {
  tenantId: string;
  conversationId: string;
  agentId: string;
  proposedContent: string;
  agentRunId?: string | null;
  sourceMessageId?: string | null;
  contentType?: MessageDraftContentType;
  reasoning?: string | null;
  confidence?: number | null;
  status?: MessageDraftStatus;
  expiresAt?: string | null;
};

export const createDraft = async (
  supabase: AnyClient,
  input: CreateDraftInput,
): Promise<MessageDraftRow> => {
  const insert: MessageDraftInsert = {
    tenant_id: input.tenantId,
    conversation_id: input.conversationId,
    agent_id: input.agentId,
    proposed_content: input.proposedContent,
    ...(input.agentRunId !== undefined && { agent_run_id: input.agentRunId }),
    ...(input.sourceMessageId !== undefined && {
      source_message_id: input.sourceMessageId,
    }),
    ...(input.contentType !== undefined && { content_type: input.contentType }),
    ...(input.reasoning !== undefined && { reasoning: input.reasoning }),
    ...(input.confidence !== undefined && { confidence: input.confidence }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.expiresAt !== undefined && { expires_at: input.expiresAt }),
  };
  const { data, error } = await supabase
    .from('message_drafts')
    .insert(insert)
    .select()
    .single();
  if (error) throw error;
  return data;
};

/**
 * Lê um draft por id. Caller (worker com service role) deve validar tenant_id
 * antes de operar sobre o draft.
 */
export const getDraftById = async (
  supabase: AnyClient,
  draftId: string,
): Promise<MessageDraftRow | null> => {
  const { data, error } = await supabase
    .from('message_drafts')
    .select('*')
    .eq('id', draftId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export type ListPendingDraftsFilters = {
  conversationId?: string;
  limit?: number;
};

export const listPendingDrafts = async (
  supabase: AnyClient,
  tenantId: string,
  filters: ListPendingDraftsFilters = {},
): Promise<MessageDraftRow[]> => {
  let query = supabase
    .from('message_drafts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'pending');
  if (filters.conversationId) {
    query = query.eq('conversation_id', filters.conversationId);
  }
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 50);
  if (error) throw error;
  return data ?? [];
};

export type ApproveDraftResult =
  | { ok: true; draft: MessageDraftRow }
  | { ok: false; reason: 'not_found' | 'not_pending' };

/**
 * Move draft de `pending` → `approved`. Guard atômico no UPDATE (`.eq('status',
 * 'pending')`) evita race se duas aprovações chegarem simultaneamente — só uma
 * passa, a outra retorna `not_pending`. Lição do TD-004 (Sprint 1.0-prep).
 */
export const approveDraft = async (
  supabase: AnyClient,
  draftId: string,
  resolvedByUserId: string,
): Promise<ApproveDraftResult> => {
  const patch: MessageDraftUpdate = {
    status: 'approved',
    resolved_by: resolvedByUserId,
    resolved_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('message_drafts')
    .update(patch)
    .eq('id', draftId)
    .eq('status', 'pending')
    .select()
    .maybeSingle();
  if (error) throw error;
  if (data) return { ok: true, draft: data };

  // UPDATE não bateu — ou draft não existe, ou status já mudou.
  const existing = await getDraftById(supabase, draftId);
  if (!existing) return { ok: false, reason: 'not_found' };
  return { ok: false, reason: 'not_pending' };
};

/**
 * Marca draft como `auto_approved` vinculado à mensagem outbound já enviada.
 * Usado pelo Especialista (Sprint 1.3) no tier sugestivo da Fase 1 — registra
 * pra rastreabilidade depois de já ter mandado.
 *
 * Sem guard de status (idempotente): essa transição vem do mesmo handler que
 * acabou de criar o draft com status default 'pending'. Race aqui não existe.
 */
export const markDraftAutoApproved = async (
  supabase: AnyClient,
  draftId: string,
  finalMessageId: string,
  metadata?: Record<string, unknown>,
): Promise<MessageDraftRow> => {
  const patch: MessageDraftUpdate = {
    status: 'auto_approved',
    final_message_id: finalMessageId,
    resolved_at: new Date().toISOString(),
    ...(metadata !== undefined && {
      edit_diff: { auto_approve_metadata: metadata } as Json,
    }),
  };
  const { data, error } = await supabase
    .from('message_drafts')
    .update(patch)
    .eq('id', draftId)
    .select()
    .single();
  if (error) throw error;
  return data;
};
