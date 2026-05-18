// =============================================================================
// Renderização de slots pro prompt do Especialista Comercial.
//
// `LeadSlots` é estrutura técnica (snake_case, enums internos). Pro LLM
// entender o "estado atual da qualificação", traduzimos pra texto natural
// em PT-BR: label legível + valor humano.
// =============================================================================

import {
  SLOT_QUESTIONS,
  getMissingSlots,
  type CompanySizeEstimate,
  type CurrentRegime,
  type DecisionTimeline,
  type LeadSlots,
} from '@office/shared-domain';

const SLOT_LABEL: Record<keyof LeadSlots, string> = {
  contact_name: 'Nome do contato',
  has_existing_company: 'Já tem empresa aberta',
  company_size_estimate: 'Porte da empresa',
  current_regime: 'Regime tributário atual',
  main_pain: 'Dor principal / motivo da busca',
  decision_timeline: 'Urgência da decisão',
  company_cnpj: 'CNPJ',
  monthly_revenue_estimate: 'Faturamento mensal estimado',
  industry_segment: 'Ramo de atuação',
  has_current_accountant: 'Tem contador atual',
  referrer: 'Como nos encontrou',
};

const COMPANY_SIZE_PT: Record<CompanySizeEstimate, string> = {
  mei: 'MEI',
  small: 'Pequena (até 9 funcionários)',
  medium: 'Média (10-49 funcionários)',
  large: 'Grande (50+ funcionários)',
  unknown: 'não soube informar',
};

const REGIME_PT: Record<CurrentRegime, string> = {
  simples_nacional: 'Simples Nacional',
  lucro_presumido: 'Lucro Presumido',
  lucro_real: 'Lucro Real',
  mei: 'MEI',
  none: 'sem empresa / nenhum regime',
  unknown: 'não soube informar',
};

const TIMELINE_PT: Record<DecisionTimeline, string> = {
  urgent: 'urgente',
  this_month: 'este mês',
  this_quarter: 'este trimestre',
  no_rush: 'sem pressa',
  unknown: 'não soube informar',
};

const formatValue = (
  key: keyof LeadSlots,
  value: unknown,
): string => {
  if (value === null) return 'ainda decidindo';
  if (typeof value === 'boolean') return value ? 'sim' : 'não';
  if (typeof value === 'number') return value.toString();

  if (key === 'company_size_estimate') {
    return COMPANY_SIZE_PT[value as CompanySizeEstimate] ?? String(value);
  }
  if (key === 'current_regime') {
    return REGIME_PT[value as CurrentRegime] ?? String(value);
  }
  if (key === 'decision_timeline') {
    return TIMELINE_PT[value as DecisionTimeline] ?? String(value);
  }
  return String(value);
};

export const renderCurrentSlots = (slots: LeadSlots): string => {
  const entries = Object.entries(slots).filter(
    ([, v]) => v !== undefined,
  ) as Array<[keyof LeadSlots, unknown]>;
  if (entries.length === 0) return '';
  return entries
    .map(
      ([key, value]) =>
        `- ${SLOT_LABEL[key]}: ${formatValue(key, value)}`,
    )
    .join('\n');
};

/**
 * Lista slots faltantes em ordem de prioridade (já vem ordenada por
 * getMissingSlots → SLOT_ORDER), com label + pergunta canonical pra
 * referência do LLM.
 */
export const renderMissingSlots = (slots: LeadSlots): string => {
  const missing = getMissingSlots(slots);
  if (missing.length === 0) return '';
  return missing
    .map(
      (key) =>
        `- ${key} (${SLOT_LABEL[key]}): "${SLOT_QUESTIONS[key]}"`,
    )
    .join('\n');
};
