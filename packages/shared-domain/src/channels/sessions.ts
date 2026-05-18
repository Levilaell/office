// =============================================================================
// Repositórios de channel_sessions
//
// Operações de sessão (CRUD + transição de status) ficam aqui. O adapter
// trabalha com `ChannelSession` (subset camelCase em types.ts); estas funções
// trabalham com a row crua do Supabase.
// =============================================================================

import type {
  AuthenticatedClient,
  Database,
  Json,
  ServiceRoleClient,
} from '@office/shared-db';
import { publishEvent } from '@office/shared-events';
import { appendAuditLog } from '../audit/index';
import {
  isChannelSessionStatus,
  isChannelType,
  type ChannelSession,
  type ChannelSessionStatus,
  type ChannelType,
} from './types';

export type ChannelSessionRow = Database['public']['Tables']['channel_sessions']['Row'];
export type ChannelSessionInsert = Database['public']['Tables']['channel_sessions']['Insert'];
export type ChannelSessionUpdate = Database['public']['Tables']['channel_sessions']['Update'];

type AnyClient = AuthenticatedClient | ServiceRoleClient;

const isJsonRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const toChannelSession = (row: ChannelSessionRow): ChannelSession => {
  if (!isChannelType(row.channel)) {
    throw new Error(`invalid channel in session ${row.id}: ${row.channel}`);
  }
  return {
    id: row.id,
    tenantId: row.tenant_id,
    channel: row.channel,
    identifier: row.identifier,
    connectionMetadata: isJsonRecord(row.connection_metadata)
      ? (row.connection_metadata as Record<string, unknown>)
      : {},
    secretsRef: row.secrets_ref,
  };
};

export const getActiveChannelSessionsForTenant = async (
  supabase: AnyClient,
  tenantId: string,
): Promise<ChannelSessionRow[]> => {
  const { data, error } = await supabase
    .from('channel_sessions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'connected');
  if (error) throw error;
  return data ?? [];
};

export const listChannelSessionsForTenant = async (
  supabase: AnyClient,
  tenantId: string,
): Promise<ChannelSessionRow[]> => {
  const { data, error } = await supabase
    .from('channel_sessions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('channel', { ascending: true });
  if (error) throw error;
  return data ?? [];
};

export const getChannelSession = async (
  supabase: AnyClient,
  tenantId: string,
  channel: ChannelType,
): Promise<ChannelSessionRow | null> => {
  const { data, error } = await supabase
    .from('channel_sessions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('channel', channel)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const getChannelSessionsByChannel = async (
  supabase: AnyClient,
  channel: ChannelType,
  filterStatus?: ChannelSessionStatus,
): Promise<ChannelSessionRow[]> => {
  let query = supabase.from('channel_sessions').select('*').eq('channel', channel);
  if (filterStatus) query = query.eq('status', filterStatus);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
};

export type UpsertChannelSessionInput = {
  tenantId: string;
  channel: ChannelType;
  status?: ChannelSessionStatus;
  identifier?: string | null;
  displayName?: string | null;
  connectionMetadata?: Record<string, unknown>;
  secretsRef?: string | null;
};

/**
 * Cria a sessão se não existir pelo UNIQUE (tenant_id, channel), ou atualiza
 * campos não-nulos da existente. Idempotente — seed e UI usam o mesmo path.
 */
export const upsertChannelSession = async (
  supabase: ServiceRoleClient,
  input: UpsertChannelSessionInput,
): Promise<ChannelSessionRow> => {
  const payload: ChannelSessionInsert = {
    tenant_id: input.tenantId,
    channel: input.channel,
    ...(input.status !== undefined && { status: input.status }),
    ...(input.identifier !== undefined && { identifier: input.identifier }),
    ...(input.displayName !== undefined && { display_name: input.displayName }),
    ...(input.connectionMetadata !== undefined && {
      connection_metadata: input.connectionMetadata as Json,
    }),
    ...(input.secretsRef !== undefined && { secrets_ref: input.secretsRef }),
  };
  const { data, error } = await supabase
    .from('channel_sessions')
    .upsert(payload, { onConflict: 'tenant_id,channel' })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export type UpdateChannelSessionStatusInput = {
  sessionId: string;
  tenantId: string;
  status: ChannelSessionStatus;
  errorDetails?: Record<string, unknown> | null;
  lastHealthCheck?: Date;
  lastMessageAt?: Date;
  traceId?: string;
  actor?: string;
};

/**
 * Transiciona o status da sessão. Lê o atual primeiro pra gravar `before` no
 * audit_log e pra retornar o anterior (necessário pro evento
 * channel_session.status_changed publicado pelo worker/UI).
 *
 * Falha em logar audit é falha da operação — segue a regra de auditabilidade
 * da plataforma. Não silenciamos.
 */
export const updateChannelSessionStatus = async (
  supabase: ServiceRoleClient,
  input: UpdateChannelSessionStatusInput,
): Promise<{ row: ChannelSessionRow; previousStatus: ChannelSessionStatus | null }> => {
  const current = await supabase
    .from('channel_sessions')
    .select('*')
    .eq('id', input.sessionId)
    .single();
  if (current.error) throw current.error;
  const previousStatusRaw = current.data.status;
  const previousStatus = isChannelSessionStatus(previousStatusRaw)
    ? previousStatusRaw
    : null;

  const patch: ChannelSessionUpdate = {
    status: input.status,
    last_health_check: (input.lastHealthCheck ?? new Date()).toISOString(),
  };
  if (input.errorDetails !== undefined) {
    patch.error_details = (input.errorDetails ?? null) as Json | null;
  }
  if (input.lastMessageAt !== undefined) {
    patch.last_message_at = input.lastMessageAt.toISOString();
  }

  const updated = await supabase
    .from('channel_sessions')
    .update(patch)
    .eq('id', input.sessionId)
    .select()
    .single();
  if (updated.error) throw updated.error;

  if (previousStatus !== input.status) {
    const traceId = input.traceId ?? crypto.randomUUID();
    await appendAuditLog(supabase, {
      trace_id: traceId,
      tenant_id: input.tenantId,
      actor: input.actor ?? 'system',
      action: 'channel_session.status_changed',
      resource: `channel_session:${input.sessionId}`,
      before: { status: previousStatus } as Json,
      after: { status: input.status } as Json,
      metadata: {
        channel: updated.data.channel,
        ...(input.errorDetails && { errorDetails: input.errorDetails }),
      } as Json,
    });

    // Realtime: UI de canais reflete sem refresh. Failure de publish NÃO
    // derruba a operação — DB já foi atualizado, audit já gravado; pior
    // caso UI fica desatualizada até próximo refresh.
    if (isChannelType(updated.data.channel)) {
      try {
        await publishEvent(
          'channel_session.status_changed',
          `tenant:${input.tenantId}`,
          {
            sessionId: input.sessionId,
            tenantId: input.tenantId,
            channel: updated.data.channel,
            previousStatus: previousStatus ?? 'unknown',
            status: input.status,
          },
          traceId,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
          `[channel_sessions] publish status_changed failed (non-fatal): ${message}`,
        );
      }
    }
  }

  return { row: updated.data, previousStatus };
};
