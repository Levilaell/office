import type { MessageTemplate, TemplateVariables } from './types';

const required = ['content'] as const;

/**
 * T09 — pergunta de slot.
 *
 * Não é template "puro" no sentido dos outros — é um passthrough estrutu-
 * ral. A pergunta em si vem do helper `renderSlotQuestion(slot, context?)`
 * de `leads/slots.ts` (canonical) ou de geração livre pelo LLM (quando
 * agente decide adaptar à conversa). O template T09 existe pra que toda
 * mensagem outbound do Especialista Comercial carregue um template_id em
 * audit_log — slot questions ficam tagueadas como T09, independente da
 * forma exata do texto.
 *
 * O agente passa o conteúdo já renderizado em `content`. Validação só
 * exige que content seja string não-vazia.
 */
export const T09_PERGUNTA_SLOT: MessageTemplate = {
  id: 'T09',
  version: '1.0.0',
  name: 'Pergunta de slot (passthrough)',
  required_variables: required,
  optional_variables: [],
  template: '{{content}}',
  channels: ['email', 'whatsapp', 'simulated_webhook', 'sms'],
  validate: (vars: TemplateVariables) => {
    const missing = required.filter(
      (k) => !vars[k] || (typeof vars[k] === 'string' && (vars[k] as string).trim().length === 0),
    );
    return missing.length === 0 ? { ok: true } : { ok: false, missing };
  },
};
