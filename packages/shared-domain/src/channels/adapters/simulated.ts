// =============================================================================
// SimulatedWebhookAdapter — canal "fake" usado em dev e teste.
//
// Não conecta com nada externo. `sendMessage` é no-op com id sintético.
// `normalizeInbound` valida o payload do endpoint `/api/inbound/simulate` e
// devolve uma única mensagem normalizada. É o adapter mais leve possível e
// serve de prova viva de que o contrato `ChannelAdapter` não exige nada de
// específico de canal real.
// =============================================================================

import { z } from 'zod';
import type {
  ChannelAdapter,
  ChannelCapabilities,
  ChannelHealth,
  ChannelSession,
  NormalizedInboundMessage,
  OutboundMessage,
  SendResult,
} from '../types';

export const SimulatedInboundPayloadSchema = z.object({
  channelHandle: z.string().min(1).max(200),
  subject: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(10_000),
});

export type SimulatedInboundPayload = z.infer<typeof SimulatedInboundPayloadSchema>;

export class SimulatedWebhookAdapter implements ChannelAdapter {
  readonly channel = 'simulated_webhook' as const;
  readonly capabilities: ChannelCapabilities = {
    supportsTemplates: false,
    supportsOutboundOutsideWindow: true,
    windowDurationHours: null,
    maxMessageSize: 10_000,
    supportedMediaTypes: ['text', 'system_event'],
  };

  async connect(_session: ChannelSession): Promise<void> {}

  async disconnect(_session: ChannelSession): Promise<void> {}

  async healthCheck(_session: ChannelSession): Promise<ChannelHealth> {
    return { status: 'connected', lastCheck: new Date() };
  }

  normalizeInbound(rawPayload: unknown): NormalizedInboundMessage[] {
    const parsed = SimulatedInboundPayloadSchema.parse(rawPayload);
    const id = `sim-${crypto.randomUUID()}`;
    return [
      {
        senderHandle: parsed.channelHandle,
        // Simulated não tem encadeamento real — handle é a "thread".
        channelThreadId: parsed.channelHandle,
        externalMessageId: id,
        content: parsed.content,
        mediaType: 'text',
        ...(parsed.subject !== undefined && { subject: parsed.subject }),
        receivedAt: new Date(),
        rawPayload: parsed,
      },
    ];
  }

  async sendMessage(_input: OutboundMessage): Promise<SendResult> {
    // No-op: simulated não envia de verdade. Útil pra testar fluxo outbound
    // sem provedor real.
    return {
      status: 'sent',
      sentAt: new Date(),
      externalMessageId: `sim-${crypto.randomUUID()}`,
    };
  }
}
