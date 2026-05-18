// =============================================================================
// Pós-processamento determinístico do `extracted_slots` retornado pelo LLM.
//
// Filtra chaves desconhecidas, normaliza enums, faz sanity check de tipos.
// LLM Haiku pode retornar enum em portunhol ("Médio" em vez de "medium") ou
// boolean como string. Aqui normalizamos.
// =============================================================================

import type {
  CompanySizeEstimate,
  CurrentRegime,
  DecisionTimeline,
  LeadSlots,
} from '@office/shared-domain';

const KNOWN_SLOTS = new Set<keyof LeadSlots>([
  'contact_name',
  'has_existing_company',
  'company_size_estimate',
  'current_regime',
  'main_pain',
  'decision_timeline',
  'company_cnpj',
  'monthly_revenue_estimate',
  'industry_segment',
  'has_current_accountant',
  'referrer',
]);

const COMPANY_SIZE_VALUES: ReadonlyArray<CompanySizeEstimate> = [
  'mei',
  'small',
  'medium',
  'large',
  'unknown',
];

const COMPANY_SIZE_ALIASES: Record<string, CompanySizeEstimate> = {
  mei: 'mei',
  pequena: 'small',
  pequeno: 'small',
  small: 'small',
  média: 'medium',
  media: 'medium',
  medium: 'medium',
  grande: 'large',
  large: 'large',
  'não sei': 'unknown',
  nao_sei: 'unknown',
  unknown: 'unknown',
  desconhecido: 'unknown',
};

const REGIME_VALUES: ReadonlyArray<CurrentRegime> = [
  'simples_nacional',
  'lucro_presumido',
  'lucro_real',
  'mei',
  'none',
  'unknown',
];

const REGIME_ALIASES: Record<string, CurrentRegime> = {
  simples: 'simples_nacional',
  'simples nacional': 'simples_nacional',
  simples_nacional: 'simples_nacional',
  presumido: 'lucro_presumido',
  'lucro presumido': 'lucro_presumido',
  lucro_presumido: 'lucro_presumido',
  real: 'lucro_real',
  'lucro real': 'lucro_real',
  lucro_real: 'lucro_real',
  mei: 'mei',
  none: 'none',
  nenhum: 'none',
  'não tem': 'none',
  'nao tem': 'none',
  unknown: 'unknown',
  desconhecido: 'unknown',
  'não sei': 'unknown',
  'nao sei': 'unknown',
};

const TIMELINE_VALUES: ReadonlyArray<DecisionTimeline> = [
  'urgent',
  'this_month',
  'this_quarter',
  'no_rush',
  'unknown',
];

const TIMELINE_ALIASES: Record<string, DecisionTimeline> = {
  urgent: 'urgent',
  urgente: 'urgent',
  imediato: 'urgent',
  this_month: 'this_month',
  'este mês': 'this_month',
  'este mes': 'this_month',
  this_quarter: 'this_quarter',
  trimestre: 'this_quarter',
  no_rush: 'no_rush',
  'sem pressa': 'no_rush',
  'no rush': 'no_rush',
  unknown: 'unknown',
  'não sei': 'unknown',
  'nao sei': 'unknown',
};

const normalizeEnum = <T extends string>(
  raw: unknown,
  aliases: Record<string, T>,
  allowed: ReadonlyArray<T>,
): T | undefined => {
  if (typeof raw !== 'string') return undefined;
  const key = raw.trim().toLowerCase();
  if ((allowed as ReadonlyArray<string>).includes(key)) return key as T;
  return aliases[key];
};

const normalizeBoolean = (raw: unknown): boolean | null | undefined => {
  if (typeof raw === 'boolean') return raw;
  if (raw === null) return null;
  if (typeof raw === 'string') {
    const k = raw.trim().toLowerCase();
    if (k === 'true' || k === 'sim' || k === 'yes') return true;
    if (k === 'false' || k === 'não' || k === 'nao' || k === 'no') return false;
    if (k === 'null' || k === 'undecided' || k === 'pensando') return null;
  }
  return undefined;
};

const normalizeString = (raw: unknown): string | undefined => {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > 500) return trimmed.slice(0, 500);
  return trimmed;
};

const normalizeNumber = (raw: unknown): number | undefined => {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    // remove R$, espaços, vírgula → ponto
    const cleaned = raw.replace(/[R$\s.]/g, '').replace(',', '.');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

/**
 * Normaliza `extracted_slots` do LLM em `LeadSlots`. Descarta chaves
 * desconhecidas, enums não mapeáveis, valores tipados errados.
 */
export const normalizeExtractedSlots = (
  raw: Record<string, unknown>,
): LeadSlots => {
  const out: LeadSlots = {};

  for (const [key, value] of Object.entries(raw)) {
    if (!KNOWN_SLOTS.has(key as keyof LeadSlots)) continue;

    switch (key as keyof LeadSlots) {
      case 'contact_name': {
        const v = normalizeString(value);
        if (v !== undefined) out.contact_name = v;
        break;
      }
      case 'has_existing_company': {
        const v = normalizeBoolean(value);
        if (v !== undefined) out.has_existing_company = v;
        break;
      }
      case 'company_size_estimate': {
        const v = normalizeEnum(value, COMPANY_SIZE_ALIASES, COMPANY_SIZE_VALUES);
        if (v) out.company_size_estimate = v;
        break;
      }
      case 'current_regime': {
        const v = normalizeEnum(value, REGIME_ALIASES, REGIME_VALUES);
        if (v) out.current_regime = v;
        break;
      }
      case 'main_pain': {
        const v = normalizeString(value);
        if (v !== undefined) out.main_pain = v;
        break;
      }
      case 'decision_timeline': {
        const v = normalizeEnum(value, TIMELINE_ALIASES, TIMELINE_VALUES);
        if (v) out.decision_timeline = v;
        break;
      }
      case 'company_cnpj': {
        const v = normalizeString(value);
        if (v !== undefined) out.company_cnpj = v;
        break;
      }
      case 'monthly_revenue_estimate': {
        const v = normalizeNumber(value);
        if (v !== undefined) out.monthly_revenue_estimate = v;
        break;
      }
      case 'industry_segment': {
        const v = normalizeString(value);
        if (v !== undefined) out.industry_segment = v;
        break;
      }
      case 'has_current_accountant': {
        const v = normalizeBoolean(value);
        if (v === true || v === false) out.has_current_accountant = v;
        break;
      }
      case 'referrer': {
        const v = normalizeString(value);
        if (v !== undefined) out.referrer = v;
        break;
      }
    }
  }

  return out;
};
