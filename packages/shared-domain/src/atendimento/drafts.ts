// =============================================================================
// Repositório de message_drafts
//
// Tabela criada na migration 20260520000001_message_drafts.sql.
// ADR-017 separa drafts (respostas em conversa síncrona) de approvals (ações
// regulatórias) — semânticas distintas (expiração curta vs. bloqueio rígido).
//
// Sprint 1.3:  createDraft / getDraftById / listPendingDrafts / approveDraft
//              / markDraftAutoApproved
// Sprint 1.5:  rejectDraft / editDraft / expireDraft / listExpiredDraftIds
//              + helpers de expiração (lê config do tenant).
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
 * Usado pelo Especialista no tier `semi_autonomo` (Sprint 1.5) ou pelo
 * Coordenador em intents sociais que dispensam draft mas registram histórico.
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
      decision_metadata: { auto_approve_metadata: metadata } as Json,
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

// =============================================================================
// Sprint 1.5 — transições de draft com guard atômico anti-race.
//
// Padrão (lição do TD-004 do Sprint 1.0-prep):
//   UPDATE ... WHERE id=$1 AND status='pending'
//
// Se 2 callers chegarem ao mesmo tempo (operador A aprova / worker expira),
// só o primeiro UPDATE muda linha; o segundo pega 0 rows e retorna
// `not_pending`. Sem isso, transições competem silenciosamente.
// =============================================================================

const DEFAULT_EXPIRATION_MINUTES = 15;
const MIN_EXPIRATION_MINUTES = 1;
const MAX_EXPIRATION_MINUTES = 1440;

/**
 * Lê `tenants.display_settings.drafts.expiration_minutes`. Default 15 min.
 * Clamp em [1, 1440] (24h). Pura: usar quando service role já carregou o
 * `display_settings`.
 */
export const resolveDraftExpirationMinutes = (
  displaySettings: unknown,
): number => {
  if (!displaySettings || typeof displaySettings !== 'object') {
    return DEFAULT_EXPIRATION_MINUTES;
  }
  const raw = (displaySettings as Record<string, unknown>).drafts;
  if (!raw || typeof raw !== 'object') return DEFAULT_EXPIRATION_MINUTES;
  const minutes = (raw as Record<string, unknown>).expiration_minutes;
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) {
    return DEFAULT_EXPIRATION_MINUTES;
  }
  if (minutes < MIN_EXPIRATION_MINUTES) return MIN_EXPIRATION_MINUTES;
  if (minutes > MAX_EXPIRATION_MINUTES) return MAX_EXPIRATION_MINUTES;
  return Math.floor(minutes);
};

/**
 * Lê config de expiração direto do banco. Caller (service role) decide se
 * cacheia — worker usa cache curto pra não bater no banco a cada draft.
 */
export const getDraftExpirationMinutes = async (
  supabase: ServiceRoleClient,
  tenantId: string,
): Promise<number> => {
  const { data, error } = await supabase
    .from('tenants')
    .select('display_settings')
    .eq('id', tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_EXPIRATION_MINUTES;
  return resolveDraftExpirationMinutes(data.display_settings);
};

/**
 * Calcula `expires_at` ISO a partir do horário atual + minutos.
 */
export const computeDraftExpiresAt = (expirationMinutes: number): string => {
  const safe =
    expirationMinutes < MIN_EXPIRATION_MINUTES
      ? MIN_EXPIRATION_MINUTES
      : expirationMinutes > MAX_EXPIRATION_MINUTES
        ? MAX_EXPIRATION_MINUTES
        : Math.floor(expirationMinutes);
  return new Date(Date.now() + safe * 60_000).toISOString();
};

// ----- rejectDraft -----------------------------------------------------------

export type RejectDraftInput = {
  resolvedByUserId: string;
  reason?: string;
};

export type RejectDraftResult =
  | { ok: true; draft: MessageDraftRow }
  | { ok: false; reason: 'not_found' | 'not_pending' };

export const rejectDraft = async (
  supabase: AnyClient,
  draftId: string,
  input: RejectDraftInput,
): Promise<RejectDraftResult> => {
  const decisionMetadata: Record<string, unknown> = {};
  if (input.reason !== undefined) decisionMetadata.reason = input.reason;

  const patch: MessageDraftUpdate = {
    status: 'rejected',
    resolved_by: input.resolvedByUserId,
    resolved_at: new Date().toISOString(),
    decision_metadata: decisionMetadata as Json,
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

  const existing = await getDraftById(supabase, draftId);
  if (!existing) return { ok: false, reason: 'not_found' };
  return { ok: false, reason: 'not_pending' };
};

// ----- editDraft -------------------------------------------------------------

export type EditDiff = {
  original: string;
  edited: string;
  char_distance: number;
};

export const computeEditDiff = (
  original: string,
  edited: string,
): EditDiff => ({
  original,
  edited,
  char_distance: Math.abs(original.length - edited.length),
});

export type EditDraftInput = {
  resolvedByUserId: string;
  editedContent: string;
  finalMessageId: string;
  justification?: string;
};

export type EditDraftResult =
  | { ok: true; draft: MessageDraftRow }
  | { ok: false; reason: 'not_found' | 'not_pending' };

export const editDraft = async (
  supabase: AnyClient,
  draftId: string,
  input: EditDraftInput,
): Promise<EditDraftResult> => {
  const existingForDiff = await getDraftById(supabase, draftId);
  if (!existingForDiff) return { ok: false, reason: 'not_found' };
  const diff = computeEditDiff(existingForDiff.proposed_content, input.editedContent);

  const decisionMetadata: Record<string, unknown> = { ...diff };
  if (input.justification !== undefined) {
    decisionMetadata.justification = input.justification;
  }

  const patch: MessageDraftUpdate = {
    status: 'edited',
    resolved_by: input.resolvedByUserId,
    resolved_at: new Date().toISOString(),
    final_message_id: input.finalMessageId,
    edit_diff: diff as unknown as Json,
    decision_metadata: decisionMetadata as Json,
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

  // Não pegou — confirmar se status mudou no meio.
  const existing = await getDraftById(supabase, draftId);
  if (!existing) return { ok: false, reason: 'not_found' };
  return { ok: false, reason: 'not_pending' };
};

// ----- approveDraftWithMessage (Sprint 1.5) ----------------------------------
//
// `approveDraft` (Sprint 1.3) só transita status sem vincular mensagem.
// Sprint 1.5 precisa: aprovar + envio bem-sucedido = vincular finalMessageId
// + status='approved'. Mantemos approveDraft (compat) e adicionamos uma versão
// estendida.

export type ApproveDraftWithMessageInput = {
  resolvedByUserId: string;
  finalMessageId: string;
  justification?: string;
};

export type ApproveDraftWithMessageResult =
  | { ok: true; draft: MessageDraftRow }
  | { ok: false; reason: 'not_found' | 'not_pending' };

export const approveDraftWithMessage = async (
  supabase: AnyClient,
  draftId: string,
  input: ApproveDraftWithMessageInput,
): Promise<ApproveDraftWithMessageResult> => {
  const decisionMetadata: Record<string, unknown> = {};
  if (input.justification !== undefined) {
    decisionMetadata.justification = input.justification;
  }
  const patch: MessageDraftUpdate = {
    status: 'approved',
    resolved_by: input.resolvedByUserId,
    resolved_at: new Date().toISOString(),
    final_message_id: input.finalMessageId,
    decision_metadata: decisionMetadata as Json,
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

  const existing = await getDraftById(supabase, draftId);
  if (!existing) return { ok: false, reason: 'not_found' };
  return { ok: false, reason: 'not_pending' };
};

// ----- expireDraft -----------------------------------------------------------

export type ExpireDraftInput = {
  /** Minutos configurados pelo tenant na hora da expiração — guardado na
   *  decision_metadata pra reconstruir contexto depois. */
  expirationMinutes: number;
};

export type ExpireDraftResult =
  | { ok: true; draft: MessageDraftRow }
  | { ok: false; reason: 'not_found' | 'not_pending' };

export const expireDraft = async (
  supabase: AnyClient,
  draftId: string,
  input: ExpireDraftInput,
): Promise<ExpireDraftResult> => {
  const now = new Date().toISOString();
  const patch: MessageDraftUpdate = {
    status: 'expired',
    resolved_at: now,
    decision_metadata: {
      expired_at: now,
      expiration_minutes: input.expirationMinutes,
    } as Json,
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

  const existing = await getDraftById(supabase, draftId);
  if (!existing) return { ok: false, reason: 'not_found' };
  return { ok: false, reason: 'not_pending' };
};

/**
 * Lista drafts com status='pending' e expires_at < now(). Worker chama isso
 * pra varrer drafts vencidos a cada tick. NÃO filtra por tenant — service role
 * varre todos (caller é um worker, não código por-tenant).
 */
export const listExpiredPendingDrafts = async (
  supabase: ServiceRoleClient,
  limit = 100,
): Promise<MessageDraftRow[]> => {
  const { data, error } = await supabase
    .from('message_drafts')
    .select('*')
    .eq('status', 'pending')
    .not('expires_at', 'is', null)
    .lt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
};

// =============================================================================
// Listagem por tenant (Sprint 1.5 — usa pra inbox + filtros opcionais)
// =============================================================================

export type ListDraftsFilters = {
  status?: MessageDraftStatus | ReadonlyArray<MessageDraftStatus>;
  conversationId?: string;
  agentId?: string;
  /** Limite. Default 50. */
  limit?: number;
};

export const listDraftsByTenant = async (
  supabase: AnyClient,
  tenantId: string,
  filters: ListDraftsFilters = {},
): Promise<MessageDraftRow[]> => {
  let query = supabase
    .from('message_drafts')
    .select('*')
    .eq('tenant_id', tenantId);

  if (filters.status !== undefined) {
    if (Array.isArray(filters.status)) {
      query = query.in('status', filters.status as readonly string[]);
    } else {
      query = query.eq('status', filters.status as string);
    }
  }
  if (filters.conversationId) {
    query = query.eq('conversation_id', filters.conversationId);
  }
  if (filters.agentId) {
    query = query.eq('agent_id', filters.agentId);
  }
  const { data, error } = await query
    .order('expires_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 50);
  if (error) throw error;
  return data ?? [];
};
