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

export { getChannelAdapter } from './registry';

export {
  ingestNormalizedMessages,
  type IngestNormalizedMessagesInput,
  type IngestedMessage,
} from './ingest';

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
