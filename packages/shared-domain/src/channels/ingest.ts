// =============================================================================
// ingestNormalizedMessages — ponto único onde mensagem inbound de qualquer
// canal vira `conversations` + `messages` + evento + audit_log.
//
// Usado por:
// - `/api/inbound/simulate` (Tarefa 3) → SimulatedWebhookAdapter
// - Worker IMAP (Tarefa 5) → EmailAdapter
// - Sprints futuras → EvolutionAdapter, WhatsAppCloudAdapter
//
// Decisões cristalizadas aqui:
// - ChannelType (adapter) → ConversationChannel (abstrato) acontece NESTE
//   helper, em nenhum outro lugar. Conversa fica agnóstica do provedor.
// - Audit_log carrega 2 entradas por mensagem inbound:
//     1. `message.created` (gravada por appendMessage, perspectiva end_client)
//     2. `message.ingested` (gravada aqui, perspectiva system/channel —
//        permite observar "X mensagens via email_imap nos últimos N min"
//        sem subir scope do appendMessage).
// - `message.received` event publicado em `tenant:<id>` AQUI, não na rota —
//   alinha com ADR-018: função de domínio que enfileira/publica declara isso
//   na assinatura.
// =============================================================================

import type { Json, ServiceRoleClient } from '@office/shared-db';
import { publishEvent } from '@office/shared-events';
import { appendAuditLog } from '../audit/index';
import {
  appendMessage,
  upsertConversation,
  type ConversationRow,
  type MessageRow,
} from '../conversations/index';
import {
  channelTypeToConversationChannel,
  type ChannelType,
  type NormalizedInboundMessage,
} from './types';

export type IngestNormalizedMessagesInput = {
  tenantId: string;
  accountId: string;
  channel: ChannelType;
  /** UUID da channel_session quando a ingestão veio de uma sessão real
   *  (e.g. IMAP poller). NULL pra simulated_webhook ou outros canais sem
   *  sessão materializada. */
  sessionId: string | null;
  messages: NormalizedInboundMessage[];
  /** Trace correlato. Se ausente, helper gera um por chamada — todas as
   *  mensagens do batch herdam o mesmo trace. */
  traceId?: string;
};

export type IngestedMessage = {
  conversation: ConversationRow;
  message: MessageRow;
};

const buildMessageMetadata = (
  channel: ChannelType,
  sessionId: string | null,
  normalized: NormalizedInboundMessage,
): Record<string, unknown> => ({
  adapter_channel: channel,
  ...(sessionId !== null && { session_id: sessionId }),
  thread_id: normalized.channelThreadId,
  external_id: normalized.externalMessageId,
  media_type: normalized.mediaType,
  ...(normalized.mediaUrl !== undefined && { media_url: normalized.mediaUrl }),
  received_at: normalized.receivedAt.toISOString(),
  ...(normalized.rawPayload !== undefined && { raw_payload: normalized.rawPayload }),
});

export const ingestNormalizedMessages = async (
  supabase: ServiceRoleClient,
  input: IngestNormalizedMessagesInput,
): Promise<IngestedMessage[]> => {
  const traceId = input.traceId ?? crypto.randomUUID();
  const conversationChannel = channelTypeToConversationChannel(input.channel);
  const results: IngestedMessage[] = [];

  for (const normalized of input.messages) {
    const conversation = await upsertConversation(supabase, {
      tenantId: input.tenantId,
      accountId: input.accountId,
      channel: conversationChannel,
      channelHandle: normalized.senderHandle,
      ...(normalized.subject !== undefined && { subject: normalized.subject }),
    });

    const metadata = buildMessageMetadata(input.channel, input.sessionId, normalized);
    const message = await appendMessage(supabase, {
      tenantId: input.tenantId,
      conversationId: conversation.id,
      accountId: input.accountId,
      direction: 'inbound',
      senderType: 'end_client',
      senderId: null,
      content: normalized.content,
      traceId,
      metadata,
    });

    await appendAuditLog(supabase, {
      trace_id: traceId,
      tenant_id: input.tenantId,
      account_id: input.accountId,
      actor: input.sessionId !== null ? `channel_session:${input.sessionId}` : `channel:${input.channel}`,
      action: 'message.ingested',
      resource: `message:${message.id}`,
      metadata: {
        channel: input.channel,
        conversationChannel,
        ...(input.sessionId !== null && { sessionId: input.sessionId }),
        externalMessageId: normalized.externalMessageId,
        threadId: normalized.channelThreadId,
        senderHandle: normalized.senderHandle,
      } as Json,
    });

    await publishEvent(
      'message.received',
      `tenant:${input.tenantId}`,
      {
        tenantId: input.tenantId,
        accountId: input.accountId,
        conversationId: conversation.id,
        messageId: message.id,
        channel: conversationChannel,
      },
      traceId,
    );

    results.push({ conversation, message });
  }

  return results;
};
