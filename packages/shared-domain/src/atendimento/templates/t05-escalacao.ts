import type { MessageTemplate, TemplateVariables } from './types';

const required = ['bot_name'] as const;

/**
 * T05 — escalação pra humano. Mensagem que o Coordenador manda quando
 * decide `escalate_human`. Comunica ao cliente que pessoa vai assumir,
 * sem dar prazo específico (que dependeria de disponibilidade do
 * escritório).
 */
export const T05_ESCALACAO: MessageTemplate = {
  id: 'T05',
  version: '1.0.0',
  name: 'Escalação pra humano',
  required_variables: required,
  optional_variables: [],
  template:
    'Vou pedir pra alguém da equipe dar uma olhada nisso e te retornar com cuidado. Equipe {{bot_name}}.',
  channels: ['email', 'whatsapp', 'simulated_webhook', 'sms'],
  validate: (vars: TemplateVariables) => {
    const missing = required.filter((k) => !vars[k]);
    return missing.length === 0 ? { ok: true } : { ok: false, missing };
  },
};
