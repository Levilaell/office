import { createServiceRoleClient, health } from '@office/shared-domain';
import { closeAllRedis } from '@office/shared-events';
import { startPollLoop } from './imap-poller.js';

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
};

const parseInterval = (raw: string | undefined): number => {
  if (!raw) return 60_000;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 5_000) {
    console.warn(`[workers] IMAP_POLL_INTERVAL_MS inválido (${raw}), usando 60000`);
    return 60_000;
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
  const intervalMs = parseInterval(process.env.IMAP_POLL_INTERVAL_MS);
  console.log(`[workers] IMAP poller intervalMs=${intervalMs}`);

  const loop = startPollLoop({ supabase, intervalMs });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[workers] received ${signal}, shutting down`);
    await loop.stop();
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
