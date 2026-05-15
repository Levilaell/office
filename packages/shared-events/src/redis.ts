import { Redis, type RedisOptions } from 'ioredis';

/**
 * BullMQ exige conexões distintas pra blocking operations (BRPOPLPUSH etc).
 * Mantemos um cliente por papel: publisher / subscriber / bullmq.
 */
type ConnectionName = 'publisher' | 'subscriber' | 'bullmq';

const clients = new Map<ConnectionName, Redis>();

const resolveUrl = (): string => {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL não está definido');
  return url;
};

const baseOptions = (name: ConnectionName): RedisOptions => {
  switch (name) {
    case 'bullmq':
      // BullMQ proíbe enableOfflineQueue=true em consumers (avisa explicitamente).
      return { maxRetriesPerRequest: null, enableOfflineQueue: false };
    case 'subscriber':
      // Subscriber não pode ter retry queue acumulando — mensagens pub/sub são fire-and-forget.
      return { maxRetriesPerRequest: null };
    case 'publisher':
      return {};
  }
};

export const getRedis = (name: ConnectionName): Redis => {
  const existing = clients.get(name);
  if (existing) return existing;
  const client = new Redis(resolveUrl(), baseOptions(name));
  clients.set(name, client);
  return client;
};

export const closeAllRedis = async (): Promise<void> => {
  const entries = Array.from(clients.values());
  clients.clear();
  await Promise.all(entries.map((c) => c.quit().catch(() => undefined)));
};
