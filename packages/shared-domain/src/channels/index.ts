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
