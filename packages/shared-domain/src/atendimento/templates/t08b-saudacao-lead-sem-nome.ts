import type { MessageTemplate } from './types';

const required: ReadonlyArray<string> = [] as const;

/**
 * T08b — variante de T08 quando ainda não temos o nome do lead. Já entra
 * pedindo o nome — primeiro slot da qualificação. NÃO usa bot_name no
 * corpo (sem assinatura aqui — saudação é curta).
 */
export const T08B_SAUDACAO_LEAD_SEM_NOME: MessageTemplate = {
  id: 'T08b',
  version: '1.0.0',
  name: 'Saudação inicial de qualificação (sem nome)',
  required_variables: required,
  optional_variables: [],
  template:
    'Que ótimo ter você por aqui! Pra te ajudar melhor, qual seu nome?',
  channels: ['email', 'whatsapp', 'simulated_webhook', 'sms'],
  validate: () => ({ ok: true }),
};
