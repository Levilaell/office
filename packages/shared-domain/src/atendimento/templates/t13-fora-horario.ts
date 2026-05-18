import type { MessageTemplate, TemplateVariables } from './types';

const required = ['bot_name', 'next_business_window'] as const;

/**
 * T13 — fora de horário. Quando tenant tem `business_hours` configurado e
 * mensagem chega fora dele, Coordenador responde indicando próximo horário
 * de atendimento e segura a tarefa real pra dentro da janela.
 *
 * `next_business_window` é frase pré-formatada (ex: "amanhã às 08h",
 * "segunda às 08h") — Coordenador calcula a partir de business_hours.
 */
export const T13_FORA_HORARIO: MessageTemplate = {
  id: 'T13',
  version: '1.0.0',
  name: 'Fora de horário',
  required_variables: required,
  optional_variables: [],
  template:
    'Recebi sua mensagem! Vou olhar com calma {{next_business_window}} e te respondo. Equipe {{bot_name}}.',
  channels: ['email', 'whatsapp', 'simulated_webhook', 'sms'],
  validate: (vars: TemplateVariables) => {
    const missing = required.filter((k) => !vars[k]);
    return missing.length === 0 ? { ok: true } : { ok: false, missing };
  },
};
