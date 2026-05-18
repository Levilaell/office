import type { MessageTemplate, TemplateVariables } from './types';

const required = ['lead_first_name'] as const;

/**
 * T08 — saudação inicial de qualificação quando o lead já passou o nome
 * (ou Coordenador conseguiu extrair). Calorosa mas direta — entra no fluxo
 * de slot-filling sem prolongar saudação.
 *
 * Variante T08b é usada quando nome não está disponível ainda.
 */
export const T08_SAUDACAO_LEAD: MessageTemplate = {
  id: 'T08',
  version: '1.0.0',
  name: 'Saudação inicial de qualificação',
  required_variables: required,
  optional_variables: [],
  template:
    'Que ótimo ter você por aqui, {{lead_first_name}}! Pra te ajudar da melhor forma, posso fazer algumas perguntas rápidas?',
  channels: ['email', 'whatsapp', 'simulated_webhook', 'sms'],
  validate: (vars: TemplateVariables) => {
    const missing = required.filter((k) => !vars[k]);
    return missing.length === 0 ? { ok: true } : { ok: false, missing };
  },
};
