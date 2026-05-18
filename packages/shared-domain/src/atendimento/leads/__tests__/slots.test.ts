import { describe, expect, it } from 'vitest';
import {
  CORE_SLOTS,
  getMissingSlots,
  getNextSuggestedSlot,
  getRequiredSlots,
  isQualified,
  renderSlotQuestion,
  SLOT_ORDER,
  SLOT_QUESTIONS,
  type LeadSlots,
} from '../slots';

describe('getRequiredSlots', () => {
  it('retorna apenas slots core quando has_existing_company !== true', () => {
    expect(getRequiredSlots({})).toEqual(CORE_SLOTS);
    expect(getRequiredSlots({ has_existing_company: false })).toEqual(
      CORE_SLOTS,
    );
    expect(getRequiredSlots({ has_existing_company: null })).toEqual(
      CORE_SLOTS,
    );
  });

  it('inclui current_regime apenas quando has_existing_company === true', () => {
    const required = getRequiredSlots({ has_existing_company: true });
    expect(required).toContain('current_regime');
    expect(required.length).toBe(CORE_SLOTS.length + 1);
  });
});

describe('getMissingSlots', () => {
  it('retorna todos os core slots quando nada foi preenchido', () => {
    expect(getMissingSlots({})).toEqual(CORE_SLOTS);
  });

  it('considera "unknown" como preenchido (não regride pra missing)', () => {
    const slots: LeadSlots = {
      contact_name: 'João',
      has_existing_company: true,
      company_size_estimate: 'unknown',
      current_regime: 'unknown',
      main_pain: 'preciso de contador',
      decision_timeline: 'unknown',
    };
    expect(getMissingSlots(slots)).toEqual([]);
  });

  it('reflete dependência de current_regime em has_existing_company', () => {
    const baseFilled: LeadSlots = {
      contact_name: 'João',
      company_size_estimate: 'small',
      main_pain: 'erro de DAS',
      decision_timeline: 'this_month',
    };
    // false: current_regime não é obrigatório
    expect(
      getMissingSlots({ ...baseFilled, has_existing_company: false }),
    ).toEqual([]);
    // true: current_regime obrigatório E ausente
    expect(
      getMissingSlots({ ...baseFilled, has_existing_company: true }),
    ).toEqual(['current_regime']);
  });
});

describe('isQualified', () => {
  it('false quando algum core está faltando', () => {
    expect(isQualified({})).toBe(false);
    expect(isQualified({ contact_name: 'João' })).toBe(false);
  });

  it('true quando todos os core (+ regime quando aplicável) preenchidos', () => {
    expect(
      isQualified({
        contact_name: 'João',
        has_existing_company: false,
        company_size_estimate: 'mei',
        main_pain: 'abrir empresa',
        decision_timeline: 'this_month',
      }),
    ).toBe(true);

    expect(
      isQualified({
        contact_name: 'Maria',
        has_existing_company: true,
        company_size_estimate: 'small',
        current_regime: 'simples_nacional',
        main_pain: 'mudar de contador',
        decision_timeline: 'no_rush',
      }),
    ).toBe(true);
  });

  it('false quando has_existing_company=true mas current_regime ausente', () => {
    expect(
      isQualified({
        contact_name: 'João',
        has_existing_company: true,
        company_size_estimate: 'small',
        main_pain: 'x',
        decision_timeline: 'urgent',
      }),
    ).toBe(false);
  });
});

describe('getNextSuggestedSlot', () => {
  it('respeita SLOT_ORDER quando ninguém respondeu', () => {
    expect(getNextSuggestedSlot({})).toBe(SLOT_ORDER[0]);
  });

  it('pula slot já preenchido', () => {
    expect(getNextSuggestedSlot({ contact_name: 'João' })).toBe(
      'has_existing_company',
    );
  });

  it('pula current_regime quando empresa não existe', () => {
    const slots: LeadSlots = {
      contact_name: 'João',
      has_existing_company: false,
      // próximo seria current_regime na ordem, mas não é required
    };
    expect(getNextSuggestedSlot(slots)).toBe('company_size_estimate');
  });

  it('inclui current_regime quando empresa existe', () => {
    const slots: LeadSlots = {
      contact_name: 'João',
      has_existing_company: true,
      company_size_estimate: 'small',
    };
    expect(getNextSuggestedSlot(slots)).toBe('current_regime');
  });

  it('retorna null quando qualificado', () => {
    expect(
      getNextSuggestedSlot({
        contact_name: 'João',
        has_existing_company: false,
        company_size_estimate: 'mei',
        main_pain: 'x',
        decision_timeline: 'urgent',
      }),
    ).toBeNull();
  });
});

describe('renderSlotQuestion', () => {
  it('retorna pergunta pura quando não há contexto', () => {
    expect(renderSlotQuestion('contact_name')).toBe(SLOT_QUESTIONS.contact_name);
    expect(renderSlotQuestion('contact_name', '')).toBe(
      SLOT_QUESTIONS.contact_name,
    );
    expect(renderSlotQuestion('contact_name', '   ')).toBe(
      SLOT_QUESTIONS.contact_name,
    );
  });

  it('prefixa contexto com newlines duplos', () => {
    const out = renderSlotQuestion(
      'company_size_estimate',
      'Boa, João!',
    );
    expect(out).toBe(`Boa, João!\n\n${SLOT_QUESTIONS.company_size_estimate}`);
  });

  it('trima contexto sem perder espaços internos', () => {
    const out = renderSlotQuestion('contact_name', '  Olá, tudo bem?   ');
    expect(out).toBe(`Olá, tudo bem?\n\n${SLOT_QUESTIONS.contact_name}`);
  });
});
