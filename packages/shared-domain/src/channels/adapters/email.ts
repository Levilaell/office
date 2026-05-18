// =============================================================================
// EmailAdapter — IMAP polling + SMTP send.
//
// STUB nesta etapa. Implementação real entra na Tarefa 4 do Sprint 1.1
// (envolve imapflow/nodemailer/mailparser, parsing de Message-ID/References
// pra threading, e tratamento de anexos).
//
// Existe agora pra satisfazer o registry e permitir que o resto da sprint
// (migration, ingest helper, worker scaffolding) compile contra a interface
// final.
// =============================================================================

import type {
  ChannelAdapter,
  ChannelCapabilities,
  ChannelHealth,
  ChannelSession,
  NormalizedInboundMessage,
  OutboundMessage,
  SendResult,
} from '../types';

const NOT_IMPLEMENTED = 'EmailAdapter ainda não implementado — Tarefa 4 do Sprint 1.1';

export class EmailAdapter implements ChannelAdapter {
  readonly channel = 'email_imap' as const;
  readonly capabilities: ChannelCapabilities = {
    supportsTemplates: false,
    supportsOutboundOutsideWindow: true,
    windowDurationHours: null,
    maxMessageSize: 25_000_000,
    supportedMediaTypes: ['text', 'document', 'image'],
  };

  async connect(_session: ChannelSession): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async disconnect(_session: ChannelSession): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async healthCheck(_session: ChannelSession): Promise<ChannelHealth> {
    return {
      status: 'disconnected',
      lastCheck: new Date(),
      details: NOT_IMPLEMENTED,
    };
  }

  normalizeInbound(_rawPayload: unknown): NormalizedInboundMessage[] {
    throw new Error(NOT_IMPLEMENTED);
  }

  async sendMessage(_input: OutboundMessage): Promise<SendResult> {
    return { status: 'rejected', reason: NOT_IMPLEMENTED };
  }
}
