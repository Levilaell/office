import type { MessageTemplate, TemplateVariables } from './types';

const required = ['bot_name'] as const;

/**
 * T02 — saudação. Curta, sem floreio. Coordenador responde direto quando
 * intent = social.saudacao. Nome do cliente é opcional na Fase 1 (passa
 * via vars se tiver; sem nome o template ainda funciona).
 */
export const T02_SAUDACAO: MessageTemplate = {
  id: 'T02',
  version: '1.0.0',
  name: 'Saudação',
  required_variables: required,
  optional_variables: [],
  template: 'Oi! Aqui é {{bot_name}}, em que posso te ajudar?',
  channels: ['email', 'whatsapp', 'simulated_webhook', 'sms'],
  validate: (vars: TemplateVariables) => {
    const missing = required.filter((k) => !vars[k]);
    return missing.length === 0 ? { ok: true } : { ok: false, missing };
  },
};
