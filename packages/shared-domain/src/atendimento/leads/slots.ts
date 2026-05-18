// =============================================================================
// Slot-filling do Especialista Comercial.
//
// `LeadSlots` é a estrutura semantical guardada em `leads.qualification_data`
// (JSONB). Cada slot é opcional — `undefined` significa "ainda não perguntei
// ou cliente não respondeu"; valores literais (incluindo `'unknown'`)
// significam "perguntei, cliente respondeu".
//
// Distinção crucial pro agente:
//   - undefined  → vai perguntar
//   - 'unknown'  → cliente não soube; segue adiante, NÃO repergunta
//
// `getRequiredSlots` adapta a lista de obrigatórios conforme contexto:
// só pede `current_regime` se `has_existing_company === true`.
// =============================================================================

export type CompanySizeEstimate =
  | 'mei'
  | 'small'
  | 'medium'
  | 'large'
  | 'unknown';

export type CurrentRegime =
  | 'simples_nacional'
  | 'lucro_presumido'
  | 'lucro_real'
  | 'mei'
  | 'none'
  | 'unknown';

export type DecisionTimeline =
  | 'urgent'
  | 'this_month'
  | 'this_quarter'
  | 'no_rush'
  | 'unknown';

export interface LeadSlots {
  // Core (obrigatórios pra qualificar)
  contact_name?: string;
  has_existing_company?: boolean | null;
  company_size_estimate?: CompanySizeEstimate;
  current_regime?: CurrentRegime;
  main_pain?: string;
  decision_timeline?: DecisionTimeline;

  // Auxiliares (úteis mas não obrigatórios)
  company_cnpj?: string;
  monthly_revenue_estimate?: number;
  industry_segment?: string;
  has_current_accountant?: boolean;
  referrer?: string;
}

export const CORE_SLOTS: ReadonlyArray<keyof LeadSlots> = [
  'contact_name',
  'has_existing_company',
  'company_size_estimate',
  'main_pain',
  'decision_timeline',
] as const;

/**
 * Ordem RECOMENDADA pro agente perguntar quando estiver escolhendo o
 * próximo slot. Agente pode ignorar e perguntar fora de ordem se o
 * contexto da conversa fizer mais sentido (ex: cliente já mencionou o
 * nome de passagem).
 */
export const SLOT_ORDER: ReadonlyArray<keyof LeadSlots> = [
  'contact_name',
  'has_existing_company',
  'company_size_estimate',
  'current_regime',
  'main_pain',
  'decision_timeline',
] as const;

/**
 * `current_regime` só vira obrigatório quando `has_existing_company === true`.
 * Cliente que vai abrir empresa (false) ou ainda decidindo (null) não tem
 * regime tributário pra reportar.
 */
export const getRequiredSlots = (
  slots: LeadSlots,
): ReadonlyArray<keyof LeadSlots> => {
  const base = [...CORE_SLOTS];
  if (slots.has_existing_company === true) {
    base.push('current_regime');
  }
  return base;
};

export const getMissingSlots = (
  slots: LeadSlots,
): ReadonlyArray<keyof LeadSlots> =>
  getRequiredSlots(slots).filter((slot) => slots[slot] === undefined);

export const isQualified = (slots: LeadSlots): boolean =>
  getMissingSlots(slots).length === 0;

/**
 * Próximo slot a perguntar, respeitando a ordem recomendada e o estado
 * atual. Filtra por slots obrigatórios pra evitar perguntar `current_regime`
 * quando `has_existing_company !== true`.
 */
export const getNextSuggestedSlot = (
  slots: LeadSlots,
): keyof LeadSlots | null => {
  const required = new Set(getRequiredSlots(slots));
  for (const slot of SLOT_ORDER) {
    if (required.has(slot) && slots[slot] === undefined) return slot;
  }
  return null;
};

export const SLOT_QUESTIONS: Record<keyof LeadSlots, string> = {
  contact_name: 'Qual seu nome?',
  has_existing_company:
    'Você já tem uma empresa aberta ou está pensando em abrir?',
  company_size_estimate:
    'Pra entender melhor o porte: a empresa tem quantos funcionários ou qual o faturamento mensal aproximado?',
  current_regime:
    'Você sabe qual o regime tributário da empresa hoje? (Simples Nacional, Lucro Presumido, Lucro Real ou MEI)',
  main_pain:
    'O que te motivou a procurar um escritório de contabilidade agora? Qual a principal dor?',
  decision_timeline:
    'Tem alguma urgência ou prazo pra decidir? Algo tipo "preciso resolver essa semana", "este mês", "ainda olhando opções"?',
  company_cnpj: 'Qual o CNPJ da empresa? (se já tiver)',
  monthly_revenue_estimate: 'Qual o faturamento mensal aproximado?',
  industry_segment: 'Qual o ramo de atuação?',
  has_current_accountant: 'Você já tem um contador atual?',
  referrer: 'Como nos encontrou?',
};

/**
 * Helper de renderização: prefixa um "contexto" opcional (ex: agradeci-
 * mento por uma resposta anterior) antes da pergunta do slot. Agente
 * monta `contexto` livre baseado no que cliente acabou de dizer.
 */
export const renderSlotQuestion = (
  slot: keyof LeadSlots,
  context?: string,
): string => {
  const question = SLOT_QUESTIONS[slot];
  return context && context.trim().length > 0
    ? `${context.trim()}\n\n${question}`
    : question;
};
