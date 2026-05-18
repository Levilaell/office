// =============================================================================
// Catálogo de intents do departamento de Atendimento
//
// Sprint 1.2: conjunto fechado, constante em código. Customização por tenant
// vira tabela `intents` na Fase 2+ (overhead desnecessário agora). Tipo
// fortemente checado via `AtendimentoIntentSlug` evita typo em produção.
//
// `defaultDecision` é o caminho que o Coordenador segue por padrão pra cada
// intent. Pode ser sobreposto em tempo de execução (ex: confidence baixa
// promove respond_direct pra escalate_human).
//
// `targetAgent` aponta pro `agent_key` do especialista; resolução pra UUID
// acontece em runtime via `getAgentByKey`.
//
// `template` aponta pra um template do registry em `templates/` — permite
// Coordenador renderizar resposta direta sem nova chamada LLM.
// =============================================================================

import type { AtendimentoTemplateId } from './templates';

export type IntentDecision =
  | 'respond_direct'
  | 'handoff_specialist'
  | 'escalate_human'
  | 'ignore';

export type AtendimentoIntentDefinition = {
  slug: string;
  displayName: string;
  category: 'operacional' | 'comercial' | 'administrativo' | 'social' | 'especial';
  defaultDecision: IntentDecision;
  targetAgent?: string;
  template?: AtendimentoTemplateId;
  /** Marcador pra audit/UI: intents `requer_humano_sempre` ignoram tier de
   *  autonomia (ADR-017). Aplicação prática vem na Sprint 1.5. */
  alwaysHuman?: boolean;
};

export const ATENDIMENTO_INTENTS = [
  // -- Operacionais -----------------------------------------------------------
  {
    slug: 'operacional.status_obrigacao',
    displayName: 'Status de obrigação',
    category: 'operacional',
    defaultDecision: 'handoff_specialist',
    targetAgent: 'atendimento.especialista_operacional',
  },
  {
    slug: 'operacional.documento_pendente',
    displayName: 'Documento pendente',
    category: 'operacional',
    defaultDecision: 'handoff_specialist',
    targetAgent: 'atendimento.especialista_operacional',
  },
  {
    slug: 'operacional.envio_documento',
    displayName: 'Envio de documento',
    category: 'operacional',
    defaultDecision: 'handoff_specialist',
    targetAgent: 'atendimento.especialista_operacional',
  },
  {
    slug: 'operacional.duvida_geral',
    displayName: 'Dúvida operacional geral',
    category: 'operacional',
    defaultDecision: 'handoff_specialist',
    targetAgent: 'atendimento.especialista_operacional',
  },
  {
    slug: 'operacional.duvida_regime',
    displayName: 'Dúvida sobre regime tributário',
    category: 'operacional',
    defaultDecision: 'escalate_human',
    alwaysHuman: true,
  },

  // -- Comerciais -------------------------------------------------------------
  {
    slug: 'comercial.lead_novo',
    displayName: 'Lead novo',
    category: 'comercial',
    defaultDecision: 'handoff_specialist',
    targetAgent: 'atendimento.especialista_comercial',
  },
  {
    slug: 'comercial.lead_retorno',
    displayName: 'Lead em qualificação',
    category: 'comercial',
    defaultDecision: 'handoff_specialist',
    targetAgent: 'atendimento.especialista_comercial',
  },

  // -- Administrativos --------------------------------------------------------
  {
    slug: 'administrativo.cobranca',
    displayName: 'Cobrança da fatura do escritório',
    category: 'administrativo',
    defaultDecision: 'escalate_human',
  },
  {
    slug: 'administrativo.cadastro',
    displayName: 'Atualização de cadastro',
    category: 'administrativo',
    defaultDecision: 'escalate_human',
  },

  // -- Sociais (Coordenador responde direto) ----------------------------------
  {
    slug: 'social.saudacao',
    displayName: 'Saudação',
    category: 'social',
    defaultDecision: 'respond_direct',
    template: 'T02',
  },
  {
    slug: 'social.agradecimento',
    displayName: 'Agradecimento',
    category: 'social',
    defaultDecision: 'respond_direct',
    template: 'T_THANKS',
  },
  {
    slug: 'social.despedida',
    displayName: 'Despedida',
    category: 'social',
    defaultDecision: 'respond_direct',
    template: 'T_BYE',
  },

  // -- Especiais --------------------------------------------------------------
  {
    slug: 'urgente',
    displayName: 'Mensagem urgente',
    category: 'especial',
    defaultDecision: 'escalate_human',
    alwaysHuman: true,
  },
  {
    slug: 'fora_escopo',
    displayName: 'Fora de escopo',
    category: 'especial',
    defaultDecision: 'escalate_human',
  },
  {
    slug: 'requer_humano',
    displayName: 'Não-textual ou complexo, requer humano',
    category: 'especial',
    defaultDecision: 'escalate_human',
    alwaysHuman: true,
  },
] as const satisfies ReadonlyArray<AtendimentoIntentDefinition>;

export type AtendimentoIntentSlug = (typeof ATENDIMENTO_INTENTS)[number]['slug'];

const INDEX: Record<string, AtendimentoIntentDefinition> = Object.fromEntries(
  ATENDIMENTO_INTENTS.map((i) => [i.slug, i]),
);

export const getIntentDefinition = (
  slug: string,
): AtendimentoIntentDefinition | undefined => INDEX[slug];

export const isKnownIntent = (slug: string): slug is AtendimentoIntentSlug =>
  slug in INDEX;

export const ATENDIMENTO_INTENT_SLUGS: ReadonlyArray<AtendimentoIntentSlug> =
  ATENDIMENTO_INTENTS.map((i) => i.slug as AtendimentoIntentSlug);
