import type { MessageTemplate, TemplateVariables } from './types';

const required = ['bot_name', 'doc_label'] as const;

/**
 * T03 — confirmação de recebimento de documento. Especialista Operacional
 * renderiza quando cliente notifica envio de doc e a tool confirma que doc
 * já está no sistema (ou logo deve estar — Fase 1 não tem OCR/parser
 * automático, então "está em análise" é literal).
 *
 * `doc_label` é texto pré-formatado pelo caller ("NF 12345", "comprovante de
 * pagamento de outubro"). Template não monta string a partir de partes
 * estruturadas pra reduzir complexidade do agente.
 */
export const T03_DOC_RECEBIDO: MessageTemplate = {
  id: 'T03',
  version: '1.0.0',
  name: 'Documento recebido',
  required_variables: required,
  optional_variables: [],
  template:
    'Recebi seu(a) {{doc_label}}. Está em análise — te aviso assim que processar. Equipe {{bot_name}}.',
  channels: ['email', 'whatsapp', 'simulated_webhook', 'sms'],
  validate: (vars: TemplateVariables) => {
    const missing = required.filter((k) => !vars[k]);
    return missing.length === 0 ? { ok: true } : { ok: false, missing };
  },
};
