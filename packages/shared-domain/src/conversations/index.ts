import type {
  AuthenticatedClient,
  Database,
  Json,
  ServiceRoleClient,
} from '@office/shared-db';
import type {
  ConversationChannel,
  MessageDirection,
  SenderType,
} from '@office/shared-types';
import { appendAuditLog } from '../audit/index';

export type ConversationRow = Database['public']['Tables']['conversations']['Row'];
export type ConversationInsert = Database['public']['Tables']['conversations']['Insert'];
export type MessageRow = Database['public']['Tables']['messages']['Row'];
export type MessageInsert = Database['public']['Tables']['messages']['Insert'];

type AnyClient = AuthenticatedClient | ServiceRoleClient;

export type UpsertConversationInput = {
  tenantId: string;
  accountId: string;
  channel: ConversationChannel;
  channelHandle: string;
  subject?: string;
};

/**
 * Cria a conversation se não existir pelo UNIQUE (tenant_id, account_id,
 * channel, channel_handle), ou retorna a existente.
 *
 * Lookup-then-insert (NÃO supabase upsert): upsert sobrescreve `subject` em
 * re-call, o que não é o comportamento desejado — quem chama o webhook não
 * deve perder o subject que o cliente final usou na primeira mensagem.
 *
 * Race condition: dois POSTs simultâneos pra mesma key passam pelo lookup,
 * o segundo insert falha com 23505 (unique violation). Nesse caso, refazemos
 * o lookup pra retornar a row criada pelo primeiro.
 */
export const upsertConversation = async (
  supabase: AnyClient,
  input: UpsertConversationInput,
): Promise<ConversationRow> => {
  const lookup = await supabase
    .from('conversations')
    .select('*')
    .eq('tenant_id', input.tenantId)
    .eq('account_id', input.accountId)
    .eq('channel', input.channel)
    .eq('channel_handle', input.channelHandle)
    .maybeSingle();
  if (lookup.error) throw lookup.error;
  if (lookup.data) return lookup.data;

  const insert: ConversationInsert = {
    tenant_id: input.tenantId,
    account_id: input.accountId,
    channel: input.channel,
    channel_handle: input.channelHandle,
    ...(input.subject !== undefined && { subject: input.subject }),
  };
  const created = await supabase
    .from('conversations')
    .insert(insert)
    .select()
    .single();
  if (created.error) {
    // Outro processo criou entre o lookup e o insert — refaz select.
    if (created.error.code === '23505') {
      const retry = await supabase
        .from('conversations')
        .select('*')
        .eq('tenant_id', input.tenantId)
        .eq('account_id', input.accountId)
        .eq('channel', input.channel)
        .eq('channel_handle', input.channelHandle)
        .single();
      if (retry.error) throw retry.error;
      return retry.data;
    }
    throw created.error;
  }
  return created.data;
};

export type AppendMessageInput = {
  tenantId: string;
  conversationId: string;
  accountId: string;
  direction: MessageDirection;
  senderType: SenderType;
  senderId: string | null;
  content: string;
  metadata?: Record<string, unknown>;
  traceId?: string;
};

const formatActor = (senderType: SenderType, senderId: string | null): string => {
  switch (senderType) {
    case 'end_client':
      return 'end_client';
    case 'agent':
      return senderId ? `agent:${senderId}` : 'agent';
    case 'operator':
      return senderId ? `user:${senderId}` : 'operator';
    case 'system':
      return 'system';
  }
};

/**
 * Insere uma message, atualiza last_message_at (e unread_count se inbound)
 * da conversation, e grava audit_log. Tudo no mesmo traceId pra permitir
 * correlação. unread_count só incrementa em mensagem inbound — uma resposta
 * outbound do operador/agente não conta como "não lida".
 */
export const appendMessage = async (
  supabase: AnyClient,
  input: AppendMessageInput,
): Promise<MessageRow> => {
  const traceId = input.traceId ?? crypto.randomUUID();
  const metadata: Json = (input.metadata ?? {}) as Json;

  const insert: MessageInsert = {
    tenant_id: input.tenantId,
    account_id: input.accountId,
    conversation_id: input.conversationId,
    direction: input.direction,
    sender_type: input.senderType,
    sender_id: input.senderId,
    content: input.content,
    metadata,
  };
  const inserted = await supabase
    .from('messages')
    .insert(insert)
    .select()
    .single();
  if (inserted.error) throw inserted.error;
  const message = inserted.data;

  // Bumpa last_message_at sempre; unread_count só pra inbound.
  if (input.direction === 'inbound') {
    // Sem RPC pra increment atômico nesta sprint — lê + escreve. Em alta
    // concorrência por conversation pode subdimensionar; aceitável aqui
    // porque inbound é serializado por canal (webhook único).
    const current = await supabase
      .from('conversations')
      .select('unread_count')
      .eq('id', input.conversationId)
      .single();
    if (current.error) throw current.error;
    const nextUnread = (current.data.unread_count ?? 0) + 1;
    const { error: upErr } = await supabase
      .from('conversations')
      .update({
        last_message_at: message.created_at,
        unread_count: nextUnread,
      })
      .eq('id', input.conversationId);
    if (upErr) throw upErr;
  } else {
    const { error: upErr } = await supabase
      .from('conversations')
      .update({ last_message_at: message.created_at })
      .eq('id', input.conversationId);
    if (upErr) throw upErr;
  }

  await appendAuditLog(supabase, {
    trace_id: traceId,
    tenant_id: input.tenantId,
    account_id: input.accountId,
    actor: formatActor(input.senderType, input.senderId),
    action: 'message.created',
    resource: `message:${message.id}`,
    metadata: {
      conversationId: input.conversationId,
      direction: input.direction,
      senderType: input.senderType,
      ...(metadata as Record<string, unknown>),
    } as Json,
  });

  return message;
};

export type ListConversationsFilters = {
  tenantId?: string;
  status?: 'open' | 'waiting_client' | 'resolved' | 'archived';
  limit?: number;
};

export const listConversations = async (
  supabase: AnyClient,
  filters: ListConversationsFilters = {},
): Promise<ConversationRow[]> => {
  let query = supabase
    .from('conversations')
    .select('*')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (filters.tenantId) query = query.eq('tenant_id', filters.tenantId);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.limit) query = query.limit(filters.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
};
