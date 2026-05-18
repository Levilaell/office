import { describe, expect, it } from 'vitest';
import {
  CHANNEL_TYPES,
  channelTypeToConversationChannel,
  isChannelSessionStatus,
  isChannelType,
  isMediaType,
} from '../types';

describe('CHANNEL_TYPES', () => {
  it('cobre os 4 valores esperados', () => {
    expect(CHANNEL_TYPES).toEqual([
      'simulated_webhook',
      'email_imap',
      'whatsapp_evolution',
      'whatsapp_cloud',
    ]);
  });
});

describe('isChannelType', () => {
  it('aceita valores válidos', () => {
    expect(isChannelType('simulated_webhook')).toBe(true);
    expect(isChannelType('email_imap')).toBe(true);
    expect(isChannelType('whatsapp_evolution')).toBe(true);
    expect(isChannelType('whatsapp_cloud')).toBe(true);
  });

  it('rejeita valores inválidos', () => {
    expect(isChannelType('email')).toBe(false);
    expect(isChannelType('whatsapp')).toBe(false);
    expect(isChannelType('sms')).toBe(false);
    expect(isChannelType('')).toBe(false);
    expect(isChannelType(null)).toBe(false);
    expect(isChannelType(undefined)).toBe(false);
    expect(isChannelType(123)).toBe(false);
  });
});

describe('channelTypeToConversationChannel', () => {
  it('mapeia adapter específico pra canal abstrato', () => {
    expect(channelTypeToConversationChannel('email_imap')).toBe('email');
    expect(channelTypeToConversationChannel('whatsapp_evolution')).toBe('whatsapp');
    expect(channelTypeToConversationChannel('whatsapp_cloud')).toBe('whatsapp');
    expect(channelTypeToConversationChannel('simulated_webhook')).toBe('simulated_webhook');
  });

  it('mapping é exaustivo — switch cobre todos CHANNEL_TYPES sem default', () => {
    // Garante que adicionar ChannelType novo sem atualizar o mapping é erro
    // de compilação. Aqui só asserta runtime: cada valor retorna string não vazia.
    for (const ct of CHANNEL_TYPES) {
      const result = channelTypeToConversationChannel(ct);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }
  });
});

describe('isMediaType', () => {
  it('aceita os tipos suportados', () => {
    expect(isMediaType('text')).toBe(true);
    expect(isMediaType('image')).toBe(true);
    expect(isMediaType('audio')).toBe(true);
    expect(isMediaType('document')).toBe(true);
    expect(isMediaType('video')).toBe(true);
    expect(isMediaType('location')).toBe(true);
    expect(isMediaType('system_event')).toBe(true);
  });

  it('rejeita outros valores', () => {
    expect(isMediaType('html')).toBe(false);
    expect(isMediaType('pdf')).toBe(false);
    expect(isMediaType(null)).toBe(false);
  });
});

describe('isChannelSessionStatus', () => {
  it('aceita status válidos', () => {
    expect(isChannelSessionStatus('connected')).toBe(true);
    expect(isChannelSessionStatus('disconnected')).toBe(true);
    expect(isChannelSessionStatus('qr_pending')).toBe(true);
    expect(isChannelSessionStatus('banned')).toBe(true);
    expect(isChannelSessionStatus('error')).toBe(true);
  });

  it('rejeita outros', () => {
    expect(isChannelSessionStatus('active')).toBe(false);
    expect(isChannelSessionStatus('')).toBe(false);
    expect(isChannelSessionStatus(null)).toBe(false);
  });
});
