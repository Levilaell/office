import { createServiceRoleClient, health } from '@office/shared-domain';
import { closeAllRedis } from '@office/shared-events';
import { startPollLoop } from './imap-poller.js';
import { startExpirationLoop } from './drafts-expiration-poller.js';

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
};

const parseInterval = (
  raw: string | undefined,
  defaultMs: number,
  minMs: number,
  label: string,
): number => {
  if (!raw) return defaultMs;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < minMs) {
    console.warn(`[workers] ${label} inválido (${raw}), usando ${defaultMs}`);
    return defaultMs;
  }
  return n;
};

const main = async (): Promise<void> => {
  const result = health();
  console.log(`[workers] boot ok=${result.ok}`);

  const supabase = createServiceRoleClient({
    url: requireEnv('SUPABASE_URL'),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  });

  const imapIntervalMs = parseInterval(
    process.env.IMAP_POLL_INTERVAL_MS,
    60_000,
    5_000,
    'IMAP_POLL_INTERVAL_MS',
  );
  console.log(`[workers] IMAP poller intervalMs=${imapIntervalMs}`);
  const imapLoop = startPollLoop({ supabase, intervalMs: imapIntervalMs });

  const expirationIntervalMs = parseInterval(
    process.env.DRAFTS_EXPIRATION_POLL_INTERVAL_MS,
    30_000,
    5_000,
    'DRAFTS_EXPIRATION_POLL_INTERVAL_MS',
  );
  console.log(`[workers] drafts expiration poller intervalMs=${expirationIntervalMs}`);
  const expirationLoop = startExpirationLoop({
    supabase,
    intervalMs: expirationIntervalMs,
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[workers] received ${signal}, shutting down`);
    await Promise.all([imapLoop.stop(), expirationLoop.stop()]);
    await closeAllRedis().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
};

void main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[workers] fatal: ${message}`);
  process.exit(1);
});
