import { describe, expect, it } from 'vitest';
import { resolveDisplaySettings } from '../display-settings';

describe('resolveDisplaySettings', () => {
  it('fallback: bot_name = tenant.name quando display_settings vazio', () => {
    const result = resolveDisplaySettings({
      tenantName: 'Levi Lael Contábil',
      displaySettings: {},
    });
    expect(result.bot_name).toBe('Levi Lael Contábil');
    expect(result.signature).toBe('Levi Lael Contábil');
    expect(result.business_hours).toBeNull();
  });

  it('usa bot_name explícito quando definido', () => {
    const result = resolveDisplaySettings({
      tenantName: 'Levi Lael Contábil',
      displaySettings: {
        bot_name: 'Equipe LL',
        signature: 'Equipe LL Contábil',
      },
    });
    expect(result.bot_name).toBe('Equipe LL');
    expect(result.signature).toBe('Equipe LL Contábil');
  });

  it('signature defaults to bot_name quando ausente', () => {
    const result = resolveDisplaySettings({
      tenantName: 'Fallback',
      displaySettings: { bot_name: 'Custom' },
    });
    expect(result.signature).toBe('Custom');
  });

  it('parsing válido de business_hours', () => {
    const result = resolveDisplaySettings({
      tenantName: 'X',
      displaySettings: {
        business_hours: {
          start: '08:00',
          end: '18:00',
          timezone: 'America/Sao_Paulo',
          days: [1, 2, 3, 4, 5],
        },
      },
    });
    expect(result.business_hours).toEqual({
      start: '08:00',
      end: '18:00',
      timezone: 'America/Sao_Paulo',
      days: [1, 2, 3, 4, 5],
    });
  });

  it('business_hours malformado retorna null sem lançar', () => {
    const result = resolveDisplaySettings({
      tenantName: 'X',
      displaySettings: {
        business_hours: { start: '25:99', end: 'foo' },
      },
    });
    expect(result.business_hours).toBeNull();
  });

  it('display_settings null trata como {}', () => {
    const result = resolveDisplaySettings({
      tenantName: 'X',
      displaySettings: null,
    });
    expect(result.bot_name).toBe('X');
    expect(result.business_hours).toBeNull();
  });
});
