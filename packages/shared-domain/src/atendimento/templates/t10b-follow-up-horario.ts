import type { MessageTemplate, TemplateVariables } from './types';

const required = ['responsavel_name'] as const;

/**
 * T10b — follow-up imediato depois que o lead sugere horário. Confirma
 * que vai confirmar com o responsável comercial e voltar; transita lead
 * pra status `scheduled_pending` no banco.
 */
export const T10B_FOLLOW_UP_HORARIO: MessageTemplate = {
  id: 'T10b',
  version: '1.0.0',
  name: 'Follow-up após cliente sugerir horário',
  required_variables: required,
  optional_variables: [],
  template:
    'Combinado! Vou confirmar com {{responsavel_name}} e te confirmo o horário exato em alguns minutos.',
  channels: ['email', 'whatsapp', 'simulated_webhook', 'sms'],
  validate: (vars: TemplateVariables) => {
    const missing = required.filter((k) => !vars[k]);
    return missing.length === 0 ? { ok: true } : { ok: false, missing };
  },
};
