import type { MessageTemplate, TemplateVariables } from './types';

const required = ['lead_first_name', 'responsavel_name'] as const;

/**
 * T10 — fechamento quando lead foi qualificado. Pede horário pra
 * agendar call com humano comercial. `responsavel_name` é resolvido pelo
 * agente: idealmente vem de display_settings (futuro `commercial_lead_name`);
 * Fase 1 cai pra `signature` do tenant como fallback.
 *
 * NÃO agenda direto — Calendar é Fase 1.5/2 (ADR-014).
 */
export const T10_FECHAMENTO_QUALIFICADO: MessageTemplate = {
  id: 'T10',
  version: '1.0.0',
  name: 'Fechamento com lead qualificado',
  required_variables: required,
  optional_variables: [],
  template:
    'Perfeito, {{lead_first_name}}! Tenho as informações que precisava. Vou agendar uma conversa com {{responsavel_name}}, que vai te entender melhor e te apresentar como podemos ajudar. Qual o melhor dia e horário pra você nessa semana?',
  channels: ['email', 'whatsapp', 'simulated_webhook', 'sms'],
  validate: (vars: TemplateVariables) => {
    const missing = required.filter((k) => !vars[k]);
    return missing.length === 0 ? { ok: true } : { ok: false, missing };
  },
};
