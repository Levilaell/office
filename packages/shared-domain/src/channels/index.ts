export {
  CHANNEL_TYPES,
  CHANNEL_SESSION_STATUSES,
  MEDIA_TYPES,
  channelTypeToConversationChannel,
  isChannelSessionStatus,
  isChannelType,
  isMediaType,
  type ChannelAdapter,
  type ChannelCapabilities,
  type ChannelHealth,
  type ChannelSession,
  type ChannelSessionStatus,
  type ChannelType,
  type MediaType,
  type NormalizedInboundMessage,
  type OutboundMessage,
  type SendResult,
} from './types';

export {
  ingestNormalizedMessages,
  type IngestNormalizedMessagesInput,
  type IngestedMessage,
} from './ingest';

export { resolveSecretRef } from './secrets';

// `getChannelAdapter` e adapters concretos NÃO são re-exportados aqui de
// propósito.
//
// Cliente Next.js (realtime-provider, mappers) importa `@office/shared-domain`
// pra type guards (isChannelType, isChannelSessionStatus). Se reexportarmos
// registry/adapters aqui, o webpack — mesmo com import() dinâmico — segue o
// grafo e puxa imapflow → módulos Node-only (tls/net/fs) pro bundle do
// client.
//
// Server-side (worker, API routes, agent-runtime) importa via subpath:
//   import { getChannelAdapter } from '@office/shared-domain/channels/registry';
//   import { EmailAdapter } from '@office/shared-domain/channels/adapters/email';
// O `exports` field em package.json formaliza esses paths.

export {
  getActiveChannelSessionsForTenant,
  getChannelSession,
  getChannelSessionsByChannel,
  listChannelSessionsForTenant,
  toChannelSession,
  updateChannelSessionStatus,
  upsertChannelSession,
  type ChannelSessionRow,
  type ChannelSessionInsert,
  type ChannelSessionUpdate,
  type UpsertChannelSessionInput,
  type UpdateChannelSessionStatusInput,
} from './sessions';

export {
  sendAgentMessage,
  type SendAgentMessageInput,
  type SendAgentMessageResult,
} from './outbound';
