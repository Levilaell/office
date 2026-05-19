import { describe, expect, it } from 'vitest';
import { isDemoModeEnabled } from '../env';

// Sprint 1.6 — gate do modo demo.

describe('isDemoModeEnabled', () => {
  it('true em dev sem flag', () => {
    expect(isDemoModeEnabled({ NODE_ENV: 'development' })).toBe(true);
  });

  it('true em test sem flag', () => {
    expect(isDemoModeEnabled({ NODE_ENV: 'test' })).toBe(true);
  });

  it('false em production sem flag', () => {
    expect(isDemoModeEnabled({ NODE_ENV: 'production' })).toBe(false);
  });

  it('true em production com ENABLE_DEMO_MODE=true', () => {
    expect(
      isDemoModeEnabled({
        NODE_ENV: 'production',
        ENABLE_DEMO_MODE: 'true',
      }),
    ).toBe(true);
  });

  it('false em production com ENABLE_DEMO_MODE=false', () => {
    expect(
      isDemoModeEnabled({
        NODE_ENV: 'production',
        ENABLE_DEMO_MODE: 'false',
      }),
    ).toBe(false);
  });

  it('false em production com ENABLE_DEMO_MODE com lixo', () => {
    expect(
      isDemoModeEnabled({
        NODE_ENV: 'production',
        ENABLE_DEMO_MODE: 'sim',
      }),
    ).toBe(false);
  });

  it('true em dev com ENABLE_DEMO_MODE=false (dev sempre permite)', () => {
    expect(
      isDemoModeEnabled({
        NODE_ENV: 'development',
        ENABLE_DEMO_MODE: 'false',
      }),
    ).toBe(true);
  });
});
