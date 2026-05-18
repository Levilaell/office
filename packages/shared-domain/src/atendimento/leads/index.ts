// =============================================================================
// Repositório de leads — qualificação progressiva pelo Especialista Comercial.
//
// Lead = pessoa/empresa antes de virar account. Slot-filling em
// `qualification_data` JSONB (estrutura validada em `./slots.ts`). Transição
// de status é determinística e calculada por `computeNextStatus`:
//
//   new → qualifying (primeiro slot preenchido) → qualified (todos core
//   preenchidos) → scheduled_pending → converted | lost | dropped
//
// `updateLeadQualificationData` faz merge JSONB no slot-data E recomputa
// status atomicamente — caller não precisa coordenar duas chamadas.
// =============================================================================

import type {
  AuthenticatedClient,
  Database,
  Json,
  ServiceRoleClient,
} from '@office/shared-db';
import {
  getRequiredSlots,
  isQualified,
  type LeadSlots,
} from './slots';

export type LeadRow = Database['public']['Tables']['leads']['Row'];
export type LeadInsert = Database['public']['Tables']['leads']['Insert'];
export type LeadUpdate = Database['public']['Tables']['leads']['Update'];

type AnyClient = AuthenticatedClient | ServiceRoleClient;

export type LeadSource =
  | 'whatsapp_evolution'
  | 'whatsapp_cloud'
  | 'email_imap'
  | 'simulated_webhook'
  | 'manual'
  | 'unknown';

export type LeadStatus =
  | 'new'
  | 'qualifying'
  | 'qualified'
  | 'scheduled_pending'
  | 'converted'
  | 'lost'
  | 'dropped';

export type CreateLeadInput = {
  tenantId: string;
  source: LeadSource;
  sourceMetadata?: Record<string, unknown>;
  primaryContactId?: string | null;
  primaryConversationId?: string | null;
  qualificationData?: LeadSlots;
};

/**
 * Cria lead inicial em status `new`. Idempotência fica por conta do caller
 * (ex: Especialista carrega via getLeadByConversationId antes de criar).
 */
export const createLead = async (
  supabase: AnyClient,
  input: CreateLeadInput,
): Promise<LeadRow> => {
  const qualification = (input.qualificationData ?? {}) as Json;
  const insert: LeadInsert = {
    tenant_id: input.tenantId,
    source: input.source,
    source_metadata: (input.sourceMetadata ?? {}) as Json,
    primary_contact_id: input.primaryContactId ?? null,
    primary_conversation_id: input.primaryConversationId ?? null,
    qualification_data: qualification,
    status: 'new',
  };

  const { data, error } = await supabase
    .from('leads')
    .insert(insert)
    .select()
    .single();
  if (error) throw error;
  return data;
};

/**
 * Lead vinculado à conversation (1:1 esperado na Fase 1). `maybeSingle`
 * porque lead pode não existir ainda — caller decide criar.
 */
export const getLeadByConversationId = async (
  supabase: AnyClient,
  tenantId: string,
  conversationId: string,
): Promise<LeadRow | null> => {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('primary_conversation_id', conversationId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const getLeadById = async (
  supabase: AnyClient,
  leadId: string,
): Promise<LeadRow | null> => {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

/**
 * Calcula próximo status com base no estado pós-merge dos slots.
 *
 * Regras:
 * - status terminal ('converted', 'lost', 'dropped') não muda (intervenção
 *   humana revisita explicitamente)
 * - 'scheduled_pending' não regride pra 'qualified' (cliente já sinalizou
 *   horário)
 * - se todos slots core preenchidos: vira 'qualified' (se ainda não estava)
 * - se algum slot tem valor: avança pra 'qualifying' (se estava em 'new')
 * - mantém 'new' enquanto nada foi preenchido
 */
export const computeNextStatus = (
  current: LeadStatus,
  merged: LeadSlots,
): LeadStatus => {
  if (current === 'converted' || current === 'lost' || current === 'dropped') {
    return current;
  }
  if (current === 'scheduled_pending') return 'scheduled_pending';
  if (isQualified(merged)) return 'qualified';
  // Algum slot foi preenchido?
  const hasSomeSlot = getRequiredSlots(merged).some(
    (slot) => merged[slot] !== undefined,
  );
  return hasSomeSlot ? 'qualifying' : 'new';
};

export type UpdateLeadQualificationResult = {
  lead: LeadRow;
  previousStatus: LeadStatus;
  statusChanged: boolean;
};

/**
 * Merge incremental no `qualification_data`. Re-lê estado atual pra recompu-
 * tar status (read-modify-write — aceitável porque Fase 1 não tem múltiplos
 * Especialistas rodando no mesmo lead em paralelo: BullMQ dedup por jobId
 * processa um turno por vez).
 *
 * Set automatic de `qualified_at` quando transição → qualified.
 */
export const updateLeadQualificationData = async (
  supabase: AnyClient,
  leadId: string,
  partialSlots: LeadSlots,
): Promise<UpdateLeadQualificationResult> => {
  const current = await getLeadById(supabase, leadId);
  if (!current) {
    throw new Error(`lead ${leadId} not found`);
  }

  const currentSlots = (current.qualification_data ?? {}) as LeadSlots;
  const merged: LeadSlots = { ...currentSlots, ...partialSlots };
  const previousStatus = current.status as LeadStatus;
  const nextStatus = computeNextStatus(previousStatus, merged);

  const patch: LeadUpdate = {
    qualification_data: merged as Json,
  };
  if (nextStatus !== previousStatus) {
    patch.status = nextStatus;
    if (nextStatus === 'qualified' && current.qualified_at === null) {
      patch.qualified_at = new Date().toISOString();
    }
  }

  const { data, error } = await supabase
    .from('leads')
    .update(patch)
    .eq('id', leadId)
    .select()
    .single();
  if (error) throw error;

  return {
    lead: data,
    previousStatus,
    statusChanged: nextStatus !== previousStatus,
  };
};

export type MarkLeadResult = {
  lead: LeadRow;
  previousStatus: LeadStatus;
};

/**
 * Transição explícita pra `qualified`, idempotente. Set `qualified_at`
 * apenas na primeira vez.
 */
export const markLeadQualified = async (
  supabase: AnyClient,
  leadId: string,
): Promise<MarkLeadResult> => {
  const current = await getLeadById(supabase, leadId);
  if (!current) throw new Error(`lead ${leadId} not found`);
  const previousStatus = current.status as LeadStatus;
  if (previousStatus === 'qualified' || previousStatus === 'scheduled_pending') {
    return { lead: current, previousStatus };
  }

  const patch: LeadUpdate = { status: 'qualified' };
  if (current.qualified_at === null) {
    patch.qualified_at = new Date().toISOString();
  }
  const { data, error } = await supabase
    .from('leads')
    .update(patch)
    .eq('id', leadId)
    .select()
    .single();
  if (error) throw error;
  return { lead: data, previousStatus };
};

/**
 * Cliente sugeriu horário pra call. Set `scheduled_call_at` se parseável
 * (caller pode passar null se só captou texto livre — guardado em notes).
 */
export const markLeadScheduledPending = async (
  supabase: AnyClient,
  leadId: string,
  preferredSlot?: { scheduledAt?: Date | null; notes?: string },
): Promise<MarkLeadResult> => {
  const current = await getLeadById(supabase, leadId);
  if (!current) throw new Error(`lead ${leadId} not found`);
  const previousStatus = current.status as LeadStatus;

  const patch: LeadUpdate = { status: 'scheduled_pending' };
  if (preferredSlot?.scheduledAt !== undefined && preferredSlot.scheduledAt !== null) {
    patch.scheduled_call_at = preferredSlot.scheduledAt.toISOString();
  }
  if (preferredSlot?.notes !== undefined) {
    const existing = current.notes ?? '';
    patch.notes = existing.length > 0
      ? `${existing}\n[scheduling] ${preferredSlot.notes}`
      : `[scheduling] ${preferredSlot.notes}`;
  }

  const { data, error } = await supabase
    .from('leads')
    .update(patch)
    .eq('id', leadId)
    .select()
    .single();
  if (error) throw error;
  return { lead: data, previousStatus };
};

export const markLeadLost = async (
  supabase: AnyClient,
  leadId: string,
  reason: string,
): Promise<MarkLeadResult> => {
  const current = await getLeadById(supabase, leadId);
  if (!current) throw new Error(`lead ${leadId} not found`);
  const previousStatus = current.status as LeadStatus;
  if (previousStatus === 'lost') return { lead: current, previousStatus };

  const { data, error } = await supabase
    .from('leads')
    .update({ status: 'lost', lost_reason: reason })
    .eq('id', leadId)
    .select()
    .single();
  if (error) throw error;
  return { lead: data, previousStatus };
};

/**
 * Lead abandonado (pediu humano antes de qualificar, ou inatividade
 * prolongada). Diferente de `lost`: dropped é "saiu do funil"; lost é
 * "perdemos a venda".
 */
export const markLeadDropped = async (
  supabase: AnyClient,
  leadId: string,
  reason: string,
): Promise<MarkLeadResult> => {
  const current = await getLeadById(supabase, leadId);
  if (!current) throw new Error(`lead ${leadId} not found`);
  const previousStatus = current.status as LeadStatus;
  if (previousStatus === 'dropped') return { lead: current, previousStatus };

  const { data, error } = await supabase
    .from('leads')
    .update({ status: 'dropped', lost_reason: reason })
    .eq('id', leadId)
    .select()
    .single();
  if (error) throw error;
  return { lead: data, previousStatus };
};

export type ListLeadsFilters = {
  status?: LeadStatus | LeadStatus[];
  limit?: number;
};

export const listLeadsByTenant = async (
  supabase: AnyClient,
  tenantId: string,
  filters: ListLeadsFilters = {},
): Promise<LeadRow[]> => {
  let query = supabase
    .from('leads')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (filters.status) {
    if (Array.isArray(filters.status)) {
      query = query.in('status', filters.status);
    } else {
      query = query.eq('status', filters.status);
    }
  }
  if (filters.limit !== undefined) query = query.limit(filters.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
};

export {
  CORE_SLOTS,
  SLOT_QUESTIONS,
  SLOT_ORDER,
  getMissingSlots,
  getNextSuggestedSlot,
  getRequiredSlots,
  isQualified,
  renderSlotQuestion,
  type CompanySizeEstimate,
  type CurrentRegime,
  type DecisionTimeline,
  type LeadSlots,
} from './slots';
