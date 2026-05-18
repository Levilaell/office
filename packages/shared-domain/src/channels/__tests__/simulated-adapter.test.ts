import { describe, expect, it } from 'vitest';
import { SimulatedWebhookAdapter } from '../adapters/simulated';

describe('SimulatedWebhookAdapter', () => {
  const adapter = new SimulatedWebhookAdapter();

  describe('capabilities', () => {
    it('declara só text e system_event como mídia suportada', () => {
      expect(adapter.capabilities.supportedMediaTypes).toEqual(['text', 'system_event']);
    });

    it('sem templates, sem janela', () => {
      expect(adapter.capabilities.supportsTemplates).toBe(false);
      expect(adapter.capabilities.windowDurationHours).toBeNull();
      expect(adapter.capabilities.supportsOutboundOutsideWindow).toBe(true);
    });
  });

  describe('normalizeInbound', () => {
    it('aceita payload completo e retorna 1 NormalizedInboundMessage', () => {
      const result = adapter.normalizeInbound({
        channelHandle: 'cliente@example.com',
        subject: 'DAS de maio',
        content: 'Bom dia, preciso de ajuda',
      });

      expect(result).toHaveLength(1);
      const msg = result[0]!;
      expect(msg.senderHandle).toBe('cliente@example.com');
      expect(msg.channelThreadId).toBe('cliente@example.com');
      expect(msg.content).toBe('Bom dia, preciso de ajuda');
      expect(msg.subject).toBe('DAS de maio');
      expect(msg.mediaType).toBe('text');
      expect(msg.externalMessageId).toMatch(/^sim-/);
      expect(msg.receivedAt).toBeInstanceOf(Date);
      expect(msg.rawPayload).toMatchObject({
        channelHandle: 'cliente@example.com',
        subject: 'DAS de maio',
        content: 'Bom dia, preciso de ajuda',
      });
    });

    it('aceita payload sem subject (opcional)', () => {
      const result = adapter.normalizeInbound({
        channelHandle: 'cliente@example.com',
        content: 'oi',
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.subject).toBeUndefined();
    });

    it('throw em payload inválido (channelHandle vazio)', () => {
      expect(() =>
        adapter.normalizeInbound({
          channelHandle: '',
          content: 'oi',
        }),
      ).toThrow();
    });

    it('throw em payload inválido (content faltando)', () => {
      expect(() =>
        adapter.normalizeInbound({
          channelHandle: 'cliente@example.com',
        }),
      ).toThrow();
    });

    it('throw em payload null/undefined', () => {
      expect(() => adapter.normalizeInbound(null)).toThrow();
      expect(() => adapter.normalizeInbound(undefined)).toThrow();
    });
  });

  describe('sendMessage', () => {
    it('retorna status sent com externalMessageId sintético', async () => {
      const result = await adapter.sendMessage({
        session: {
          id: 'sess',
          tenantId: 'tenant',
          channel: 'simulated_webhook',
          identifier: null,
          connectionMetadata: {},
          secretsRef: null,
        },
        recipientHandle: 'cliente@example.com',
        content: 'resposta',
      });

      expect(result.status).toBe('sent');
      if (result.status === 'sent') {
        expect(result.externalMessageId).toMatch(/^sim-/);
        expect(result.sentAt).toBeInstanceOf(Date);
      }
    });
  });

  describe('healthCheck', () => {
    it('sempre retorna connected', async () => {
      const health = await adapter.healthCheck({
        id: 'sess',
        tenantId: 'tenant',
        channel: 'simulated_webhook',
        identifier: null,
        connectionMetadata: {},
        secretsRef: null,
      });
      expect(health.status).toBe('connected');
    });
  });
});
