// =============================================================================
// Outbound de mensagem agente → canal externo.
//
// Junta os passos que vivem espalhados em alguns lugares:
//   1. Lê conversation pra obter channel abstrato + channel_handle.
//   2. Resolve `ChannelType` concreto (adapter) — via metadata da última
//      mensagem inbound (`metadata.adapter_channel`) ou fallback por
//      mapeamento abstract → único type conhecido.
//   3. Resolve channel_session (necessária pro adapter — identifier, secrets).
//      Simulated não precisa sessão real; injetamos um stub.
//   4. Chama adapter.sendMessage.
//   5. Em sucesso, persiste row em `messages` (direction=outbound,
//      senderType=agent) e grava audit_log via appendMessage.
//
// Coordenador chama este helper quando decide `respond_direct` ou
// `escalate_human` (esse último opcionalmente).
// =============================================================================

import type { ServiceRoleClient } from '@office/shared-db';
import { appendMessage } from '../conversations/index';
import { getConversationById } from '../conversations/index';
import { getChannelAdapter } from './registry';
import {
  getChannelSession,
  toChannelSession,
} from './sessions';
import {
  isChannelType,
  type ChannelSession,
  type ChannelType,
  type SendResult,
} from './types';

export type SendAgentMessageInput = {
  tenantId: string;
  conversationId: string;
  accountId: string;
  agentId: string;
  content: string;
  subject?: string;
  traceId?: string;
};

export type SendAgentMessageResult =
  | { ok: true; sendResult: SendResult; messageId: string }
  | { ok: false; reason: string; sendResult?: SendResult };

const STUB_SIMULATED_SESSION: ChannelSession = {
  id: '00000000-0000-0000-0000-000000000000',
  tenantId: '00000000-0000-0000-0000-000000000000',
  channel: 'simulated_webhook',
  identifier: 'simulated',
  connectionMetadata: {},
  secretsRef: null,
};

const resolveAdapterChannel = async (
  supabase: ServiceRoleClient,
  conversation: { channel: string },
  conversationId: string,
): Promise<ChannelType | null> => {
  // Preferência: ler metadata da última inbound, que já carrega
  // `adapter_channel` desde Sprint 1.1 (ver buildMessageMetadata em
  // channels/ingest.ts).
  const { data: lastInbound } = await supabase
    .from('messages')
    .select('metadata')
    .eq('conversation_id', conversationId)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const meta =
    (lastInbound?.metadata as Record<string, unknown> | null | undefined) ?? {};
  const explicit = meta.adapter_channel;
  if (typeof explicit === 'string' && isChannelType(explicit)) return explicit;

  // Fallback determinístico por abstrato → único type conhecido na Fase 1.
  switch (conversation.channel) {
    case 'simulated_webhook':
      return 'simulated_webhook';
    case 'email':
      return 'email_imap';
    case 'whatsapp':
      // WhatsApp tem dois adapters; sem metadata clara, não dá pra escolher.
      return null;
    case 'sms':
      return null;
    default:
      return null;
  }
};

/**
 * Envia mensagem do agente para o canal externo correspondente à conversation.
 * Pré-condição: conversation existe e pertence ao tenant. Caller (Coordenador
 * worker) já valida tenant antes de chamar.
 */
export const sendAgentMessage = async (
  supabase: ServiceRoleClient,
  input: SendAgentMessageInput,
): Promise<SendAgentMessageResult> => {
  const conv = await getConversationById(supabase, input.conversationId);
  if (!conv) {
    return { ok: false, reason: `conversation not found: ${input.conversationId}` };
  }
  if (conv.tenant_id !== input.tenantId) {
    return { ok: false, reason: 'tenant mismatch' };
  }

  const adapterChannel = await resolveAdapterChannel(supabase, conv, input.conversationId);
  if (!adapterChannel) {
    return {
      ok: false,
      reason: `cannot resolve adapter channel for conversation.channel=${conv.channel}`,
    };
  }

  let session: ChannelSession;
  if (adapterChannel === 'simulated_webhook') {
    session = { ...STUB_SIMULATED_SESSION, tenantId: input.tenantId };
  } else {
    const row = await getChannelSession(supabase, input.tenantId, adapterChannel);
    if (!row) {
      return { ok: false, reason: `no channel_session for ${adapterChannel}` };
    }
    session = toChannelSession(row);
  }

  // Threading: reusa external_id (vira In-Reply-To) + thread_id (vira
  // References pro encadeamento longo) da última inbound. Adapter ignora
  // se não suporta — só EmailAdapter usa hoje.
  const lastThreading = await readLastInboundThreading(supabase, input.conversationId);

  const adapter = await getChannelAdapter(adapterChannel);
  const sendResult = await adapter.sendMessage({
    session,
    recipientHandle: conv.channel_handle,
    content: input.content,
    mediaType: 'text',
    ...(input.subject !== undefined && { subject: input.subject }),
    ...(lastThreading.externalId !== null && {
      replyToExternalMessageId: lastThreading.externalId,
    }),
    ...(lastThreading.threadId !== null && {
      channelThreadId: lastThreading.threadId,
    }),
  });

  if (sendResult.status === 'rejected') {
    return { ok: false, reason: sendResult.reason, sendResult };
  }

  const message = await appendMessage(supabase, {
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    accountId: input.accountId,
    direction: 'outbound',
    senderType: 'agent',
    senderId: input.agentId,
    content: input.content,
    ...(input.traceId !== undefined && { traceId: input.traceId }),
    metadata: {
      adapter_channel: adapterChannel,
      ...(sendResult.status === 'sent' && {
        sent_at: sendResult.sentAt.toISOString(),
      }),
      ...(sendResult.status === 'queued' && {
        queued_at: sendResult.queuedAt.toISOString(),
      }),
      ...(sendResult.externalMessageId !== undefined && {
        external_id: sendResult.externalMessageId,
      }),
    },
  });

  return { ok: true, sendResult, messageId: message.id };
};

const readLastInboundThreading = async (
  supabase: ServiceRoleClient,
  conversationId: string,
): Promise<{ externalId: string | null; threadId: string | null }> => {
  const { data } = await supabase
    .from('messages')
    .select('metadata')
    .eq('conversation_id', conversationId)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const meta = (data?.metadata as Record<string, unknown> | null) ?? null;
  const ext = meta?.external_id;
  const thread = meta?.thread_id;
  return {
    externalId: typeof ext === 'string' ? ext : null,
    threadId: typeof thread === 'string' ? thread : null,
  };
};
