import type { MessageTemplate, TemplateVariables } from './types';

const required = [
  'bot_name',
  'obligation_label',
  'due_date_label',
  'status_label',
] as const;

const optional = ['amount_phrase'] as const;

/**
 * T06 — status de obrigação. Resposta principal do Especialista Operacional
 * pra intent `operacional.status_obrigacao`. Caller (graph do agente)
 * monta as variáveis a partir de `ObligationSnapshot`:
 *
 *  - `obligation_label`:  "DAS de outubro/2026"
 *  - `due_date_label`:    "dia 20/10/2026"
 *  - `status_label`:      "em aberto" | "pago" | "vencido"
 *  - `amount_phrase`:     " — valor R$ 487,30" ou string vazia se sem valor
 *
 * Frase neutra ("vencimento em X") funciona pra pending e paid sem soar
 * estranha. Especialista NUNCA renderiza com obligation_label vazio — o
 * validador rejeita e agente usa T_NO_DATA.
 */
export const T06_STATUS_OBRIGACAO: MessageTemplate = {
  id: 'T06',
  version: '1.0.0',
  name: 'Status de obrigação',
  required_variables: required,
  optional_variables: optional,
  template:
    '{{obligation_label}}: vencimento em {{due_date_label}}{{amount_phrase}}. Status: {{status_label}}. Equipe {{bot_name}}.',
  channels: ['email', 'whatsapp', 'simulated_webhook', 'sms'],
  validate: (vars: TemplateVariables) => {
    const missing = required.filter((k) => !vars[k]);
    return missing.length === 0 ? { ok: true } : { ok: false, missing };
  },
};
