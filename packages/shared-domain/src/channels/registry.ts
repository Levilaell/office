// =============================================================================
// Registry de ChannelAdapters
//
// Resolve adapter por ChannelType. Dynamic imports são intencionais: o
// EmailAdapter pulla imapflow/nodemailer/mailparser (Node-only, peso real).
// Em Next.js, switch case síncrono na rota `/api/inbound/simulate` traria tudo
// pro bundle da função — cold start gordo na Vercel.
//
// Async aqui não complica callers — todos já estão em contexto async (route
// handler, worker poll loop).
// =============================================================================

import type { ChannelAdapter, ChannelType } from './types';

export const getChannelAdapter = async (channel: ChannelType): Promise<ChannelAdapter> => {
  switch (channel) {
    case 'simulated_webhook': {
      const { SimulatedWebhookAdapter } = await import('./adapters/simulated');
      return new SimulatedWebhookAdapter();
    }
    case 'email_imap': {
      const { EmailAdapter } = await import('./adapters/email');
      return new EmailAdapter();
    }
    case 'whatsapp_evolution':
    case 'whatsapp_cloud':
      throw new Error(`No adapter registered for channel: ${channel}`);
  }
};
