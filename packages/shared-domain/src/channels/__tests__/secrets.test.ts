import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveSecretRef } from '../secrets';

describe('resolveSecretRef', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.SEED_TEST_VAR = 'seed-secret';
    process.env.CHANNEL_TEST_VAR = 'channel-secret';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'should-not-leak';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('null/empty ref retorna null', () => {
    expect(resolveSecretRef(null)).toBeNull();
    expect(resolveSecretRef(undefined)).toBeNull();
    expect(resolveSecretRef('')).toBeNull();
  });

  it('resolve env: com prefixo SEED_', () => {
    expect(resolveSecretRef('env:SEED_TEST_VAR')).toBe('seed-secret');
  });

  it('resolve env: com prefixo CHANNEL_', () => {
    expect(resolveSecretRef('env:CHANNEL_TEST_VAR')).toBe('channel-secret');
  });

  it('rejeita prefixo fora da whitelist (proteção contra DB corrompido)', () => {
    expect(() => resolveSecretRef('env:SUPABASE_SERVICE_ROLE_KEY')).toThrow(/whitelist/);
    expect(() => resolveSecretRef('env:CLERK_SECRET_KEY')).toThrow(/whitelist/);
    expect(() => resolveSecretRef('env:PATH')).toThrow(/whitelist/);
  });

  it('rejeita schemes desconhecidos', () => {
    expect(() => resolveSecretRef('vault:secret/email')).toThrow(/Unknown secrets_ref scheme/);
    expect(() => resolveSecretRef('plaintext-password')).toThrow();
  });

  it('var existe mas valor vazio retorna null', () => {
    process.env.SEED_EMPTY = '';
    expect(resolveSecretRef('env:SEED_EMPTY')).toBeNull();
  });

  it('var inexistente retorna null', () => {
    expect(resolveSecretRef('env:SEED_DOESNT_EXIST')).toBeNull();
  });
});
