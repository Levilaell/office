// -----------------------------------------------------------------------------
// Sprint 1.0 — Atendimento foundations
//
// Espelha os CHECKs da migration 20260515103000_atendimento_foundations.sql
// + rename 20260518163051_rename_interactions_to_messages.sql.
// Type guards isXxx pra usar em mappers de runtime (DB → snapshot).
// -----------------------------------------------------------------------------

export const CONVERSATION_CHANNELS = [
  'email',
  'whatsapp',
  'simulated_webhook',
  'sms',
] as const;
export type ConversationChannel = (typeof CONVERSATION_CHANNELS)[number];
export const isConversationChannel = (value: unknown): value is ConversationChannel =>
  typeof value === 'string' && (CONVERSATION_CHANNELS as readonly string[]).includes(value);

// -----------------------------------------------------------------------------
// Sprint 1.1 — Channel adapter
//
// ChannelType identifica adapter/provedor (`email_imap`, `whatsapp_evolution`,
// ...). ConversationChannel acima é o abstrato (`email`, `whatsapp`, ...).
// Mapping é via `channelTypeToConversationChannel`.
//
// Tipos vivem aqui em shared-types (não em shared-domain) pra evitar que
// realtime-provider / mappers / UI puxem o grafo todo de shared-domain
// (triagem → shared-events → ioredis → dns) pro client bundle do Next.
// -----------------------------------------------------------------------------

export const CHANNEL_TYPES = [
  'simulated_webhook',
  'email_imap',
  'whatsapp_evolution',
  'whatsapp_cloud',
] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];
export const isChannelType = (value: unknown): value is ChannelType =>
  typeof value === 'string' && (CHANNEL_TYPES as readonly string[]).includes(value);

export const channelTypeToConversationChannel = (
  channel: ChannelType,
): ConversationChannel => {
  switch (channel) {
    case 'simulated_webhook':
      return 'simulated_webhook';
    case 'email_imap':
      return 'email';
    case 'whatsapp_evolution':
    case 'whatsapp_cloud':
      return 'whatsapp';
  }
};

export const MEDIA_TYPES = [
  'text',
  'image',
  'audio',
  'document',
  'video',
  'location',
  'system_event',
] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];
export const isMediaType = (value: unknown): value is MediaType =>
  typeof value === 'string' && (MEDIA_TYPES as readonly string[]).includes(value);

export const CHANNEL_SESSION_STATUSES = [
  'connected',
  'disconnected',
  'qr_pending',
  'banned',
  'error',
] as const;
export type ChannelSessionStatus = (typeof CHANNEL_SESSION_STATUSES)[number];
export const isChannelSessionStatus = (value: unknown): value is ChannelSessionStatus =>
  typeof value === 'string' &&
  (CHANNEL_SESSION_STATUSES as readonly string[]).includes(value);

export const CONVERSATION_STATUSES = [
  'open',
  'waiting_client',
  'resolved',
  'archived',
] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];
export const isConversationStatus = (value: unknown): value is ConversationStatus =>
  typeof value === 'string' && (CONVERSATION_STATUSES as readonly string[]).includes(value);

export const MESSAGE_DIRECTIONS = ['inbound', 'outbound'] as const;
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number];
export const isMessageDirection = (value: unknown): value is MessageDirection =>
  typeof value === 'string' && (MESSAGE_DIRECTIONS as readonly string[]).includes(value);

export const SENDER_TYPES = ['end_client', 'agent', 'operator', 'system'] as const;
export type SenderType = (typeof SENDER_TYPES)[number];
export const isSenderType = (value: unknown): value is SenderType =>
  typeof value === 'string' && (SENDER_TYPES as readonly string[]).includes(value);

export type Conversation = {
  id: string;
  tenantId: string;
  accountId: string;
  channel: ConversationChannel;
  channelHandle: string;
  status: ConversationStatus;
  subject: string | null;
  /**
   * Última classificação de intent feita pelo Coordenador (Sprint 1.2+).
   * Slug hierárquico (ex: `operacional.status_obrigacao`). NULL antes da
   * primeira classificação ou pra conversas que não passam pelo coord.
   */
  intentCurrent: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type Message = {
  id: string;
  tenantId: string;
  accountId: string;
  conversationId: string;
  direction: MessageDirection;
  senderType: SenderType;
  // user_id, agent_id, ou null pra end_client externo (channel_handle identifica).
  senderId: string | null;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};
