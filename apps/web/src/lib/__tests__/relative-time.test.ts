import { describe, expect, it } from 'vitest';
import { relativeFuture, relativeTime } from '../relative-time';

const NOW = new Date('2026-05-15T12:00:00.000Z');

describe('relativeTime', () => {
  it('retorna "agora" quando diferença é menor que 1 minuto', () => {
    const iso = new Date(NOW.getTime() - 30_000).toISOString();
    expect(relativeTime(iso, NOW)).toBe('agora');
  });

  it('retorna "agora" quando ISO está no futuro (clock skew)', () => {
    const iso = new Date(NOW.getTime() + 10_000).toISOString();
    expect(relativeTime(iso, NOW)).toBe('agora');
  });

  it('retorna "há N min" pra dezenas de minutos', () => {
    const iso = new Date(NOW.getTime() - 8 * 60_000).toISOString();
    expect(relativeTime(iso, NOW)).toBe('há 8 min');
  });

  it('retorna "há 59 min" no limite inferior de horas', () => {
    const iso = new Date(NOW.getTime() - 59 * 60_000).toISOString();
    expect(relativeTime(iso, NOW)).toBe('há 59 min');
  });

  it('retorna "há N h" pra horas', () => {
    const iso = new Date(NOW.getTime() - 3 * 60 * 60_000).toISOString();
    expect(relativeTime(iso, NOW)).toBe('há 3 h');
  });

  it('retorna "há 1 dia" no singular', () => {
    const iso = new Date(NOW.getTime() - 26 * 60 * 60_000).toISOString();
    expect(relativeTime(iso, NOW)).toBe('há 1 dia');
  });

  it('retorna "há N dias" no plural', () => {
    const iso = new Date(NOW.getTime() - 3 * 24 * 60 * 60_000).toISOString();
    expect(relativeTime(iso, NOW)).toBe('há 3 dias');
  });

  it('retorna data formatada quando passou mais de 7 dias', () => {
    const iso = new Date(NOW.getTime() - 30 * 24 * 60 * 60_000).toISOString();
    const out = relativeTime(iso, NOW);
    expect(out).not.toMatch(/^há /);
    expect(out).not.toBe('agora');
  });
});

describe('relativeFuture', () => {
  it('retorna "expirado" quando ISO já passou', () => {
    const iso = new Date(NOW.getTime() - 60_000).toISOString();
    expect(relativeFuture(iso, NOW)).toBe('expirado');
  });

  it('retorna "expirado" no exato instante', () => {
    const iso = NOW.toISOString();
    expect(relativeFuture(iso, NOW)).toBe('expirado');
  });

  it('retorna "em N min" pra minutos no futuro', () => {
    const iso = new Date(NOW.getTime() + 15 * 60_000).toISOString();
    expect(relativeFuture(iso, NOW)).toBe('em 15 min');
  });

  it('retorna "em N h" pra horas no futuro', () => {
    const iso = new Date(NOW.getTime() + 4 * 60 * 60_000).toISOString();
    expect(relativeFuture(iso, NOW)).toBe('em 4 h');
  });

  it('retorna "em N dias" pra dias no futuro', () => {
    const iso = new Date(NOW.getTime() + 5 * 24 * 60 * 60_000).toISOString();
    expect(relativeFuture(iso, NOW)).toBe('em 5 dias');
  });

  it('retorna "em 1 dia" no singular', () => {
    const iso = new Date(NOW.getTime() + 30 * 60 * 60_000).toISOString();
    expect(relativeFuture(iso, NOW)).toBe('em 1 dia');
  });
});
