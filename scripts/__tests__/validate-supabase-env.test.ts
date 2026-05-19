import { describe, expect, it } from 'vitest';
import { checkSupabaseEnv } from '../validate-supabase-env';

const VALID_KEY = 'a'.repeat(80);

describe('checkSupabaseEnv', () => {
  it('aceita endpoint REST cloud + key longa', () => {
    const result = checkSupabaseEnv({
      url: 'https://abc123.supabase.co',
      serviceRoleKey: VALID_KEY,
    });
    expect(result.ok).toBe(true);
  });

  it('aceita endpoint local', () => {
    const result = checkSupabaseEnv({
      url: 'http://127.0.0.1:54321',
      serviceRoleKey: VALID_KEY,
    });
    expect(result.ok).toBe(true);
  });

  it('aceita endpoint local via localhost', () => {
    const result = checkSupabaseEnv({
      url: 'http://localhost:54321',
      serviceRoleKey: VALID_KEY,
    });
    expect(result.ok).toBe(true);
  });

  it('rejeita URL de dashboard', () => {
    const result = checkSupabaseEnv({
      url: 'https://supabase.com/dashboard/project/abc123',
      serviceRoleKey: VALID_KEY,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/dashboard/i);
  });

  it('rejeita URL com path /project/_/', () => {
    const result = checkSupabaseEnv({
      url: 'https://app.supabase.com/project/_/settings/api',
      serviceRoleKey: VALID_KEY,
    });
    expect(result.ok).toBe(false);
  });

  it('rejeita URL de host desconhecido', () => {
    const result = checkSupabaseEnv({
      url: 'https://example.com/api',
      serviceRoleKey: VALID_KEY,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/formato inesperado/i);
  });

  it('rejeita service role key truncada', () => {
    const result = checkSupabaseEnv({
      url: 'https://abc123.supabase.co',
      serviceRoleKey: 'tooshort',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/truncada/i);
  });

  it('rejeita quando URL faltando', () => {
    const result = checkSupabaseEnv({
      url: undefined,
      serviceRoleKey: VALID_KEY,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/obrigatórios/i);
  });

  it('rejeita quando key faltando', () => {
    const result = checkSupabaseEnv({
      url: 'https://abc123.supabase.co',
      serviceRoleKey: undefined,
    });
    expect(result.ok).toBe(false);
  });
});
