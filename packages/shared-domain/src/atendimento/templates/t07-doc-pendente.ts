import type { MessageTemplate, TemplateVariables } from './types';

const required = ['bot_name', 'doc_label', 'competencia_label'] as const;

/**
 * T07 — documento pendente. Especialista usa quando cliente pergunta status
 * de obrigação que depende de doc que ainda não foi enviado, ou quando
 * cliente pergunta se precisa enviar algo.
 *
 * - `doc_label`:         "NF de venda", "comprovante de pagamento"
 * - `competencia_label`: "outubro/2026", "o mês"
 */
export const T07_DOC_PENDENTE: MessageTemplate = {
  id: 'T07',
  version: '1.0.0',
  name: 'Documento pendente',
  required_variables: required,
  optional_variables: [],
  template:
    'Pra fechar {{competencia_label}}, ainda preciso do(a) {{doc_label}}. Quando der, me manda por aqui. Equipe {{bot_name}}.',
  channels: ['email', 'whatsapp', 'simulated_webhook', 'sms'],
  validate: (vars: TemplateVariables) => {
    const missing = required.filter((k) => !vars[k]);
    return missing.length === 0 ? { ok: true } : { ok: false, missing };
  },
};
