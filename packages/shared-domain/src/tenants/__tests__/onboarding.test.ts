import { describe, expect, it } from 'vitest';
import { tenantNeedsOnboarding } from '../index';

// Sprint 1.6 — discriminator pro redirect do dashboard layout. Estritamente
// `=== false`. Tenants legados pré-feature (undefined / sem chave / null)
// passam direto sem ver o wizard.

describe('tenantNeedsOnboarding', () => {
  it('true quando onboarding_completed === false (estrito)', () => {
    expect(tenantNeedsOnboarding({ onboarding_completed: false })).toBe(true);
  });

  it('false quando onboarding_completed === true', () => {
    expect(tenantNeedsOnboarding({ onboarding_completed: true })).toBe(false);
  });

  it('false quando display_settings é {} (sem chave) — tenant legado', () => {
    expect(tenantNeedsOnboarding({})).toBe(false);
  });

  it('false quando display_settings é null', () => {
    expect(tenantNeedsOnboarding(null)).toBe(false);
  });

  it('false quando display_settings é undefined', () => {
    expect(tenantNeedsOnboarding(undefined)).toBe(false);
  });

  it('false quando onboarding_completed é truthy mas não literal true', () => {
    // Defensivo: refactor que vira `!completed` quebraria isso (string vazia,
    // 0, null seriam tratados como "precisa onboarding"). Este teste captura
    // a propriedade.
    expect(tenantNeedsOnboarding({ onboarding_completed: 'no' })).toBe(false);
    expect(tenantNeedsOnboarding({ onboarding_completed: 0 })).toBe(false);
    expect(tenantNeedsOnboarding({ onboarding_completed: null })).toBe(false);
  });

  it('false quando display_settings é array (defensive contra payload malformado)', () => {
    expect(tenantNeedsOnboarding(['onboarding_completed', false])).toBe(false);
  });

  it('ignora outros campos em display_settings', () => {
    expect(
      tenantNeedsOnboarding({
        bot_name: 'Demo',
        signature: 'Equipe',
        onboarding_completed: false,
        business_hours: { start: '08:00', end: '18:00' },
      }),
    ).toBe(true);
  });
});
