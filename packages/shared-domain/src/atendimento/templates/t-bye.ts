import type { MessageTemplate, TemplateVariables } from './types';

const required = ['bot_name'] as const;

/**
 * T_BYE — resposta a despedida. Encerra com cordialidade sem prolongar.
 * Coordenador escolhe quando intent = social.despedida.
 */
export const T_BYE: MessageTemplate = {
  id: 'T_BYE',
  version: '1.0.0',
  name: 'Resposta a despedida',
  required_variables: required,
  optional_variables: [],
  template: 'Até mais! Qualquer coisa, é só chamar. Equipe {{bot_name}}.',
  channels: ['email', 'whatsapp', 'simulated_webhook', 'sms'],
  validate: (vars: TemplateVariables) => {
    const missing = required.filter((k) => !vars[k]);
    return missing.length === 0 ? { ok: true } : { ok: false, missing };
  },
};
