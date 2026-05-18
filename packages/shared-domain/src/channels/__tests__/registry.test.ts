import { describe, expect, it } from 'vitest';
import { getChannelAdapter } from '../registry';

describe('getChannelAdapter', () => {
  it('resolve SimulatedWebhookAdapter pra simulated_webhook', async () => {
    const adapter = await getChannelAdapter('simulated_webhook');
    expect(adapter.channel).toBe('simulated_webhook');
    expect(typeof adapter.normalizeInbound).toBe('function');
    expect(typeof adapter.sendMessage).toBe('function');
    expect(typeof adapter.connect).toBe('function');
    expect(typeof adapter.disconnect).toBe('function');
    expect(typeof adapter.healthCheck).toBe('function');
  });

  it('resolve EmailAdapter pra email_imap', async () => {
    const adapter = await getChannelAdapter('email_imap');
    expect(adapter.channel).toBe('email_imap');
    expect(typeof adapter.normalizeInbound).toBe('function');
    expect(typeof adapter.sendMessage).toBe('function');
  });

  it('throw em canal sem adapter ainda implementado', async () => {
    await expect(getChannelAdapter('whatsapp_evolution')).rejects.toThrow(
      /No adapter registered/,
    );
    await expect(getChannelAdapter('whatsapp_cloud')).rejects.toThrow(
      /No adapter registered/,
    );
  });

  it('capabilities sintaticamente válidas (campos obrigatórios presentes)', async () => {
    const sim = await getChannelAdapter('simulated_webhook');
    expect(typeof sim.capabilities.supportsTemplates).toBe('boolean');
    expect(typeof sim.capabilities.supportsOutboundOutsideWindow).toBe('boolean');
    expect(typeof sim.capabilities.maxMessageSize).toBe('number');
    expect(Array.isArray(sim.capabilities.supportedMediaTypes)).toBe(true);
  });
});
