// =============================================================================
// ChannelAdapter — contrato comum pra todo canal externo de comunicação
// (e-mail, WhatsApp, simulated_webhook). Desenhado contra o adapter mais
// restritivo (Cloud API: templates aprovados + janelas) — ADR-015.
//
// O adapter NÃO conhece domínio de Atendimento. Só normaliza payload externo
// e expõe envio. A virada pra `conversations` + `messages` vive em
// `ingestNormalizedMessages` (ingest.ts), camada acima.
//
// Enums/guards (CHANNEL_TYPES, isChannelSessionStatus, ...) vivem em
// `@office/shared-types`. Client bundle puxa só o necessário sem arrastar
// shared-events/ioredis. Aqui ficam só as interfaces concretas que o adapter
// usa.
// =============================================================================

import type {
  ChannelSessionStatus,
  ChannelType,
  MediaType,
} from '@office/shared-types';

// Re-exports pra manter API estável pra quem importava daqui.
export {
  CHANNEL_TYPES,
  CHANNEL_SESSION_STATUSES,
  MEDIA_TYPES,
  channelTypeToConversationChannel,
  isChannelSessionStatus,
  isChannelType,
  isMediaType,
  type ChannelSessionStatus,
  type ChannelType,
  type MediaType,
} from '@office/shared-types';

// -----------------------------------------------------------------------------
// Estado de sessão exposto ao adapter
//
// É um subset da row de `channel_sessions` — só o que o adapter precisa pra
// operar. Repositório full (status, timestamps, error_details) vive em
// channels/sessions.ts pra worker e UI.
// -----------------------------------------------------------------------------

export type ChannelSession = {
  id: string;
  tenantId: string;
  channel: ChannelType;
  identifier: string | null;
  connectionMetadata: Record<string, unknown>;
  secretsRef: string | null;
};

export type ChannelHealth = {
  status: ChannelSessionStatus;
  lastCheck: Date;
  details?: string;
};

// -----------------------------------------------------------------------------
// Capacidades — runtime check antes de chamar sendMessage. Permite que código
// chamador valide "este canal suporta template?", "está dentro da janela?"
// sem precisar conhecer adapter concreto.
// -----------------------------------------------------------------------------

export type ChannelCapabilities = {
  readonly supportsTemplates: boolean;
  readonly supportsOutboundOutsideWindow: boolean;
  readonly windowDurationHours: number | null;
  readonly maxMessageSize: number;
  readonly supportedMediaTypes: ReadonlyArray<MediaType>;
};

// -----------------------------------------------------------------------------
// Payloads de mensagem normalizada
//
// `senderHandle` → conversation.channel_handle (identidade do interlocutor)
// `channelThreadId` → metadata.thread_id (encadeamento dentro do canal; pra
//   e-mail é Message-ID ou first References; pra simulated é o próprio handle).
// `externalMessageId` → metadata.external_id (Message-ID, WAID, etc).
// Anexos não são persistidos automaticamente nesta Fase — `mediaUrl` fica em
// metadata pra inspeção; download pra Storage é Fase 2+.
// -----------------------------------------------------------------------------

export type NormalizedInboundMessage = {
  senderHandle: string;
  channelThreadId: string;
  externalMessageId: string;
  content: string;
  mediaType: MediaType;
  mediaUrl?: string;
  subject?: string;
  receivedAt: Date;
  rawPayload?: Record<string, unknown>;
};

export type OutboundMessage = {
  session: ChannelSession;
  recipientHandle: string;
  content: string;
  mediaType?: MediaType;
  mediaUrl?: string;
  subject?: string;
  // Threading externo — pra e-mail vira In-Reply-To/References. Adapter que
  // não suporta threading ignora.
  replyToExternalMessageId?: string;
  channelThreadId?: string;
};

export type SendResult =
  | {
      status: 'sent';
      sentAt: Date;
      externalMessageId: string;
    }
  | {
      status: 'queued';
      queuedAt: Date;
      externalMessageId?: string;
    }
  | {
      status: 'rejected';
      reason: string;
    };

// -----------------------------------------------------------------------------
// Interface principal
//
// Adapter é stateless entre chamadas; estado vive em `channel_sessions`.
// `connect`/`disconnect` modelam ciclo (IMAP loga; SMTP é one-shot e no-op).
// `healthCheck` pode bater no provedor real (IMAP NOOP) ou ser cheap (e-mail
// outbound só sabe se SMTP está vivo via send-test).
// -----------------------------------------------------------------------------

export interface ChannelAdapter {
  readonly channel: ChannelType;
  readonly capabilities: ChannelCapabilities;

  connect(session: ChannelSession): Promise<void>;
  disconnect(session: ChannelSession): Promise<void>;
  healthCheck(session: ChannelSession): Promise<ChannelHealth>;

  sendMessage(input: OutboundMessage): Promise<SendResult>;

  // Webhook/poller chama aqui pra transformar payload bruto do provedor em
  // array de mensagens normalizadas. NÃO persiste — quem persiste é
  // `ingestNormalizedMessages`.
  normalizeInbound(rawPayload: unknown): NormalizedInboundMessage[];
}
