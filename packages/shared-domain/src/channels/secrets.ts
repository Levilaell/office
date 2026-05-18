// =============================================================================
// Resolução de secrets_ref
//
// Fase 1: aceita só prefixo `env:<VAR_NAME>` com VAR_NAME na WHITELIST de
// prefixos (`SEED_`, `CHANNEL_`). Sem isso, valor controlado por linha de
// channel_sessions sob ataque dereferenciaria variável arbitrária do
// processo (e.g. `env:SUPABASE_SERVICE_ROLE_KEY`).
//
// Fase 2+: trocar por integração com Vault/secrets manager real e remover
// suporte a `env:`. Função aqui é o único ponto a alterar.
// =============================================================================

const ALLOWED_VAR_PATTERN = /^(SEED|CHANNEL)_[A-Z0-9_]+$/;

export const resolveSecretRef = (ref: string | null | undefined): string | null => {
  if (!ref) return null;
  if (ref.startsWith('env:')) {
    const varName = ref.slice(4);
    if (!ALLOWED_VAR_PATTERN.test(varName)) {
      throw new Error(
        `secrets_ref rejected: env:${varName} not in whitelist (SEED_*, CHANNEL_*)`,
      );
    }
    const value = process.env[varName];
    return typeof value === 'string' && value.length > 0 ? value : null;
  }
  throw new Error(`Unknown secrets_ref scheme: ${ref}`);
};
