import { describe, expect, it } from 'vitest';
import { normalizeExtractedSlots } from '../slot-extractor';

describe('normalizeExtractedSlots', () => {
  it('descarta chaves desconhecidas', () => {
    const out = normalizeExtractedSlots({
      contact_name: 'João',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      cor_predileta: 'azul',
      idade: 30,
    });
    expect(out).toEqual({ contact_name: 'João' });
  });

  it('normaliza company_size_estimate em PT-BR', () => {
    expect(
      normalizeExtractedSlots({ company_size_estimate: 'pequena' }),
    ).toEqual({ company_size_estimate: 'small' });
    expect(
      normalizeExtractedSlots({ company_size_estimate: 'média' }),
    ).toEqual({ company_size_estimate: 'medium' });
    expect(
      normalizeExtractedSlots({ company_size_estimate: 'Grande' }),
    ).toEqual({ company_size_estimate: 'large' });
    expect(
      normalizeExtractedSlots({ company_size_estimate: 'mei' }),
    ).toEqual({ company_size_estimate: 'mei' });
  });

  it('aceita enums já em formato canonical', () => {
    expect(
      normalizeExtractedSlots({ company_size_estimate: 'small' }),
    ).toEqual({ company_size_estimate: 'small' });
  });

  it('descarta company_size_estimate inválido', () => {
    expect(
      normalizeExtractedSlots({ company_size_estimate: 'enorme' }),
    ).toEqual({});
  });

  it('normaliza current_regime em PT-BR', () => {
    expect(
      normalizeExtractedSlots({ current_regime: 'Simples Nacional' }),
    ).toEqual({ current_regime: 'simples_nacional' });
    expect(
      normalizeExtractedSlots({ current_regime: 'presumido' }),
    ).toEqual({ current_regime: 'lucro_presumido' });
    expect(
      normalizeExtractedSlots({ current_regime: 'real' }),
    ).toEqual({ current_regime: 'lucro_real' });
    expect(
      normalizeExtractedSlots({ current_regime: 'não sei' }),
    ).toEqual({ current_regime: 'unknown' });
  });

  it('normaliza decision_timeline em PT-BR', () => {
    expect(
      normalizeExtractedSlots({ decision_timeline: 'urgente' }),
    ).toEqual({ decision_timeline: 'urgent' });
    expect(
      normalizeExtractedSlots({ decision_timeline: 'sem pressa' }),
    ).toEqual({ decision_timeline: 'no_rush' });
  });

  it('normaliza boolean has_existing_company de string', () => {
    expect(
      normalizeExtractedSlots({ has_existing_company: 'sim' }),
    ).toEqual({ has_existing_company: true });
    expect(
      normalizeExtractedSlots({ has_existing_company: 'não' }),
    ).toEqual({ has_existing_company: false });
    expect(
      normalizeExtractedSlots({ has_existing_company: 'pensando' }),
    ).toEqual({ has_existing_company: null });
  });

  it('preserva boolean nativo de has_existing_company', () => {
    expect(
      normalizeExtractedSlots({ has_existing_company: true }),
    ).toEqual({ has_existing_company: true });
    expect(
      normalizeExtractedSlots({ has_existing_company: false }),
    ).toEqual({ has_existing_company: false });
    expect(
      normalizeExtractedSlots({ has_existing_company: null }),
    ).toEqual({ has_existing_company: null });
  });

  it('normaliza monthly_revenue_estimate de string com R$', () => {
    expect(
      normalizeExtractedSlots({ monthly_revenue_estimate: 'R$ 50.000,00' }),
    ).toEqual({ monthly_revenue_estimate: 50000 });
    expect(
      normalizeExtractedSlots({ monthly_revenue_estimate: 12345.67 }),
    ).toEqual({ monthly_revenue_estimate: 12345.67 });
  });

  it('trim e descarta string vazia', () => {
    expect(normalizeExtractedSlots({ contact_name: '  ' })).toEqual({});
    expect(
      normalizeExtractedSlots({ contact_name: '  João Silva  ' }),
    ).toEqual({ contact_name: 'João Silva' });
  });

  it('limita string a 500 chars', () => {
    const longPain = 'x'.repeat(600);
    const out = normalizeExtractedSlots({ main_pain: longPain });
    expect((out.main_pain ?? '').length).toBe(500);
  });

  it('main_pain preserva texto livre', () => {
    const pain = 'meu contador some há 2 meses, perdi prazo do DAS';
    expect(normalizeExtractedSlots({ main_pain: pain })).toEqual({
      main_pain: pain,
    });
  });

  it('has_current_accountant só aceita true ou false (não null)', () => {
    expect(
      normalizeExtractedSlots({ has_current_accountant: 'sim' }),
    ).toEqual({ has_current_accountant: true });
    expect(
      normalizeExtractedSlots({ has_current_accountant: 'pensando' }),
    ).toEqual({}); // null não vira slot pra has_current_accountant
  });
});
