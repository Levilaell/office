import type { MessageTemplate, TemplateVariables } from './types';

const required = ['bot_name'] as const;

/**
 * T04 — vou verificar. Mensagem-ponte que o Coordenador manda ANTES de
 * encaminhar pra especialista, pra cliente não ficar no escuro enquanto o
 * especialista (futuro) prepara resposta. Sprint 1.2 usa raramente — só
 * intents operacionais com alta confiança.
 */
export const T04_VOU_VERIFICAR: MessageTemplate = {
  id: 'T04',
  version: '1.0.0',
  name: 'Vou verificar e volto',
  required_variables: required,
  optional_variables: [],
  template:
    'Recebi sua mensagem, vou verificar e te retorno em instantes. Equipe {{bot_name}}.',
  channels: ['email', 'whatsapp', 'simulated_webhook', 'sms'],
  validate: (vars: TemplateVariables) => {
    const missing = required.filter((k) => !vars[k]);
    return missing.length === 0 ? { ok: true } : { ok: false, missing };
  },
};
