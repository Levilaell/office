import type { MessageTemplate, TemplateVariables } from './types';

const required = ['bot_name'] as const;

/**
 * T_THANKS — resposta a agradecimento do cliente. Reconhece sem prolongar
 * a conversa. Coordenador escolhe quando intent = social.agradecimento.
 */
export const T_THANKS: MessageTemplate = {
  id: 'T_THANKS',
  version: '1.0.0',
  name: 'Resposta a agradecimento',
  required_variables: required,
  optional_variables: [],
  template: 'Imagina, é nosso trabalho. Qualquer coisa, é só chamar. Equipe {{bot_name}}.',
  channels: ['email', 'whatsapp', 'simulated_webhook', 'sms'],
  validate: (vars: TemplateVariables) => {
    const missing = required.filter((k) => !vars[k]);
    return missing.length === 0 ? { ok: true } : { ok: false, missing };
  },
};
