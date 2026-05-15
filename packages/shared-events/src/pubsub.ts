import { EventEnvelope, isEventType, type EventType } from './schemas';
import { getRedis } from './redis';

export type EventHandler = (
  channel: string,
  eventType: EventType,
  payload: unknown,
  envelope: EventEnvelope,
) => Promise<void> | void;

export const publishEvent = async (
  eventType: EventType,
  channel: string,
  payload: unknown,
  traceId: string = crypto.randomUUID(),
): Promise<void> => {
  const envelope: EventEnvelope = {
    type: eventType,
    payload,
    traceId,
    timestamp: new Date().toISOString(),
  };
  await getRedis('publisher').publish(channel, JSON.stringify(envelope));
};

export type Subscription = { stop: () => Promise<void> };

/**
 * Subscribe a um padrão glob (ex: `tenant:*`). Mensagens malformadas são
 * dropadas com console.warn — log estruturado entra na Sprint 0.3c.
 */
export const subscribeEvents = (pattern: string, handler: EventHandler): Subscription => {
  const sub = getRedis('subscriber').duplicate();

  const onMessage = async (_pattern: string, channel: string, raw: string): Promise<void> => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn(`[shared-events] malformed JSON on ${channel}`);
      return;
    }
    const result = EventEnvelope.safeParse(parsed);
    if (!result.success) {
      console.warn(`[shared-events] invalid envelope on ${channel}: ${result.error.message}`);
      return;
    }
    if (!isEventType(result.data.type)) {
      console.warn(`[shared-events] unknown event type ${result.data.type} on ${channel}`);
      return;
    }
    try {
      await handler(channel, result.data.type, result.data.payload, result.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[shared-events] handler error on ${channel}: ${message}`);
    }
  };

  sub.on('pmessage', onMessage);
  void sub.psubscribe(pattern);

  return {
    stop: async (): Promise<void> => {
      sub.off('pmessage', onMessage);
      await sub.punsubscribe(pattern).catch(() => undefined);
      await sub.quit().catch(() => undefined);
    },
  };
};
