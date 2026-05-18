import type { MessageTemplate, TemplateVariables } from './types';

const required = ['bot_name'] as const;

/**
 * T_NO_DATA — agente não encontrou a informação no sistema. Especialista
 * renderiza quando todas as tools retornam vazio e ele não tem base pra
 * inventar uma resposta. NÃO escala humano implicitamente — o agente que
 * usa este template TAMBÉM marca conversation como `assigned_to_human` no
 * `act` (mesma semântica do T05). Templates só comunicam; a decisão de
 * escalação vive no graph.
 */
export const T_NO_DATA: MessageTemplate = {
  id: 'T_NO_DATA',
  version: '1.0.0',
  name: 'Sem dados disponíveis',
  required_variables: required,
  optional_variables: [],
  template:
    'Não consegui encontrar essa informação no sistema agora. Vou pedir pra alguém da equipe verificar com calma e te retornar. Equipe {{bot_name}}.',
  channels: ['email', 'whatsapp', 'simulated_webhook', 'sms'],
  validate: (vars: TemplateVariables) => {
    const missing = required.filter((k) => !vars[k]);
    return missing.length === 0 ? { ok: true } : { ok: false, missing };
  },
};
