/**
 * Seed de channel_session de e-mail pra dev (Sprint 1.1).
 *
 * Uso:
 *   pnpm seed:email-channel
 *
 * Cria/atualiza UMA sessão `email_imap` pra o tenant + account informados em
 * env vars, apontando pro provedor IMAP/SMTP configurado. Worker
 * (apps/workers) começa a poll-ar a inbox em até IMAP_POLL_INTERVAL_MS.
 *
 * Requer no ambiente:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   SEED_EMAIL_TENANT_ID     — UUID do tenant
 *   SEED_EMAIL_ACCOUNT_ID    — UUID do account default (rota inbound)
 *   SEED_EMAIL_ADDRESS       — endereço (também é o user IMAP/SMTP)
 *   SEED_EMAIL_DISPLAY_NAME  — opcional
 *   SEED_EMAIL_IMAP_HOST     — ex: imap.gmail.com
 *   SEED_EMAIL_IMAP_PORT     — opcional, default 993
 *   SEED_EMAIL_SMTP_HOST     — ex: smtp.gmail.com
 *   SEED_EMAIL_SMTP_PORT     — opcional, default 465
 *   SEED_EMAIL_PASSWORD      — App Password (Gmail/etc); fica em env.local,
 *                              channel_sessions.secrets_ref aponta via
 *                              `env:SEED_EMAIL_PASSWORD` (whitelist permite).
 *
 * Idempotente — pode rodar várias vezes; updates pela UNIQUE
 * (tenant_id, channel).
 */
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServiceRoleClient, upsertChannelSession } from '@office/shared-domain';

const envCandidates = [
  resolve(process.cwd(), '.env.local'),
  resolve(process.cwd(), 'apps/web/.env.local'),
  resolve(process.cwd(), 'apps/workers/.env.local'),
];
for (const path of envCandidates) {
  if (existsSync(path)) loadEnv({ path, override: false });
}

const require = (name: string): string => {
  const value = process.env[name];
  if (!value || value.startsWith('preencha-')) {
    console.error(`✗ ${name} não está definido (ou ainda tem o placeholder).`);
    console.error('  Configure no .env.local antes de rodar.');
    process.exit(1);
  }
  return value;
};

const optional = (name: string, fallback: string): string => process.env[name] || fallback;

const parsePort = (raw: string, name: string): number => {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 65535) {
    console.error(`✗ ${name} inválido: "${raw}"`);
    process.exit(1);
  }
  return n;
};

const main = async (): Promise<void> => {
  const supabaseUrl = require('SUPABASE_URL');
  const serviceRoleKey = require('SUPABASE_SERVICE_ROLE_KEY');
  const tenantId = require('SEED_EMAIL_TENANT_ID');
  const accountId = require('SEED_EMAIL_ACCOUNT_ID');
  const email = require('SEED_EMAIL_ADDRESS');
  // Senha não é guardada na DB — só presença é validada aqui (worker resolve
  // via resolveSecretRef('env:SEED_EMAIL_PASSWORD')).
  require('SEED_EMAIL_PASSWORD');

  const imapHost = optional('SEED_EMAIL_IMAP_HOST', 'imap.gmail.com');
  const imapPort = parsePort(optional('SEED_EMAIL_IMAP_PORT', '993'), 'SEED_EMAIL_IMAP_PORT');
  const smtpHost = optional('SEED_EMAIL_SMTP_HOST', 'smtp.gmail.com');
  const smtpPort = parsePort(optional('SEED_EMAIL_SMTP_PORT', '465'), 'SEED_EMAIL_SMTP_PORT');
  const displayName = optional('SEED_EMAIL_DISPLAY_NAME', 'Caixa principal');

  const supabase = createServiceRoleClient({ url: supabaseUrl, serviceRoleKey });

  const session = await upsertChannelSession(supabase, {
    tenantId,
    channel: 'email_imap',
    status: 'connected',
    identifier: email,
    displayName,
    connectionMetadata: {
      imap_host: imapHost,
      imap_port: imapPort,
      imap_secure: true,
      smtp_host: smtpHost,
      smtp_port: smtpPort,
      smtp_secure: true,
      default_account_id: accountId,
    },
    secretsRef: 'env:SEED_EMAIL_PASSWORD',
  });

  console.log(`✓ channel_session ${session.id} (tenant=${tenantId})`);
  console.log(`  channel=email_imap identifier=${email} status=${session.status}`);
  console.log(`  IMAP=${imapHost}:${imapPort}  SMTP=${smtpHost}:${smtpPort}`);
  console.log(`  default_account_id=${accountId}`);
  console.log('');
  console.log('Próximo passo: rode `pnpm dev` e envie um e-mail pra inbox.');
  console.log('Worker IMAP vai pegar a mensagem em até IMAP_POLL_INTERVAL_MS.');
};

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`✗ erro: ${message}`);
  process.exit(1);
});
