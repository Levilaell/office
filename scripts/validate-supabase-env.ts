/**
 * Validação compartilhada de env vars do Supabase pros seeds.
 *
 * Sintoma comum: dev copia URL do dashboard (`supabase.com/dashboard/project/...`)
 * em vez do endpoint REST (`<ref>.supabase.co`). Seed tenta autenticar, recebe
 * HTML de login do dashboard, e a mensagem de erro é confusa.
 *
 * Esse helper falha rápido com mensagem clara antes de instanciar o client.
 */

export type ValidatedSupabaseEnv = {
  url: string;
  serviceRoleKey: string;
};

export type ValidationResult =
  | { ok: true; env: ValidatedSupabaseEnv }
  | { ok: false; error: string };

const looksLikeDashboardUrl = (raw: string): boolean => {
  const lower = raw.toLowerCase();
  return (
    lower.includes('/dashboard/') ||
    lower.includes('supabase.com/dashboard') ||
    lower.includes('/project/_/')
  );
};

const looksLikeRestEndpoint = (raw: string): boolean => {
  try {
    const u = new URL(raw);
    // Cloud: https://<ref>.supabase.co
    if (u.hostname.endsWith('.supabase.co')) return true;
    // Local: http://127.0.0.1:54321 ou http://localhost:54321
    if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') return true;
    return false;
  } catch {
    return false;
  }
};

/**
 * Pura: testa env vars sem side-effects. Útil pra testes unitários.
 */
export const checkSupabaseEnv = (input: {
  url?: string | undefined;
  serviceRoleKey?: string | undefined;
}): ValidationResult => {
  const { url, serviceRoleKey } = input;
  if (!url || !serviceRoleKey) {
    return {
      ok: false,
      error:
        'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios. Configure no .env.local.',
    };
  }
  if (looksLikeDashboardUrl(url)) {
    return {
      ok: false,
      error:
        `SUPABASE_URL parece ser URL de dashboard (${url}). ` +
        'Use o endpoint REST: https://<project-ref>.supabase.co (Project Settings → API → Project URL).',
    };
  }
  if (!looksLikeRestEndpoint(url)) {
    return {
      ok: false,
      error:
        `SUPABASE_URL com formato inesperado: ${url}. ` +
        'Esperado: https://<ref>.supabase.co (cloud) ou http://127.0.0.1:54321 (local).',
    };
  }
  if (serviceRoleKey.length < 50) {
    return {
      ok: false,
      error:
        `SUPABASE_SERVICE_ROLE_KEY parece truncada (${serviceRoleKey.length} chars). ` +
        'Esperado: JWT longo (>= 100 chars). Pega em Project Settings → API → service_role.',
    };
  }
  return { ok: true, env: { url, serviceRoleKey } };
};

/**
 * Imperativa: lê de process.env, valida, e mata o processo com erro claro
 * se algo estiver fora do esperado. Usar nos scripts top-level.
 */
export const validateSupabaseEnv = (): ValidatedSupabaseEnv => {
  const result = checkSupabaseEnv({
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!result.ok) {
    console.error(`✗ ${result.error}`);
    process.exit(1);
  }
  return result.env;
};
