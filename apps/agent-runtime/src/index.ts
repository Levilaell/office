// Tracing precisa ser inicializado ANTES de qualquer outra coisa.
import './instrumentation.js';
import { agentRuntimeEnv } from './instrumentation.js';

import { createAdaptorServer } from '@hono/node-server';
import { Hono } from 'hono';
import { Server as IOServer } from 'socket.io';
import { PORTS } from '@office/shared-config/constants';
import { health } from '@office/shared-domain';
import { llmCall, type LlmCallInput, shutdownLlmTracing } from '@office/shared-llm';
import {
  closeAgentTasksQueue,
  closeAllRedis,
  createAgentTasksWorker,
  subscribeEvents,
} from '@office/shared-events';
import type { AgentTier } from '@office/shared-config';
import { setupSocketIo } from './realtime/socket.js';
import { makeAgentTaskHandler } from './workers/agent-tasks.js';

const app = new Hono();

app.get('/health', (c) => c.json(health()));

const ALLOWED_TIERS: readonly AgentTier[] = ['triage', 'default', 'critical'];

const isTier = (value: unknown): value is AgentTier =>
  typeof value === 'string' && (ALLOWED_TIERS as readonly string[]).includes(value);

// Endpoint temporário pra validação manual em dev (smoke test).
// Será removido na 0.3c quando UI consumir via API real.
app.post('/llm/test', async (c) => {
  const body = (await c.req.json().catch(() => null)) as
    | { tier?: unknown; prompt?: unknown; system?: unknown }
    | null;
  if (!body || !isTier(body.tier) || typeof body.prompt !== 'string') {
    return c.json(
      { error: 'body inválido: { tier: triage|default|critical, prompt: string, system?: string }' },
      400,
    );
  }
  const input: LlmCallInput = {
    tier: body.tier,
    messages: [{ role: 'user', content: body.prompt }],
  };
  if (typeof body.system === 'string') input.system = body.system;
  try {
    const out = await llmCall(input);
    return c.json({
      text: out.text,
      modelId: out.modelId,
      costUsd: out.costUsd,
      latencyMs: out.latencyMs,
      stopReason: out.stopReason,
      traceId: out.traceId,
      spanId: out.spanId ?? null,
      usage: out.usage,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

// createAdaptorServer retorna um http.Server nativo. O mesmo server vira host
// do Socket.io — daí HTTP REST e WS compartilham o port 3001.
const httpServer = createAdaptorServer({ fetch: app.fetch });

const io = new IOServer(httpServer, {
  cors: {
    origin: agentRuntimeEnv.WEB_ORIGIN,
    credentials: true,
  },
  path: '/socket.io',
});

setupSocketIo(io, {
  clerkSecretKey: agentRuntimeEnv.CLERK_SECRET_KEY,
  supabaseUrl: agentRuntimeEnv.SUPABASE_URL,
  supabaseServiceRoleKey: agentRuntimeEnv.SUPABASE_SERVICE_ROLE_KEY,
});

const agentTaskHandler = makeAgentTaskHandler({
  supabaseUrl: agentRuntimeEnv.SUPABASE_URL,
  supabaseServiceRoleKey: agentRuntimeEnv.SUPABASE_SERVICE_ROLE_KEY,
});

const worker = createAgentTasksWorker(agentTaskHandler, {
  concurrency: agentRuntimeEnv.BULLMQ_CONCURRENCY,
});
worker.on('failed', (job, err) => {
  console.error(
    `[agent-runtime] worker job ${job?.id ?? '?'} failed: ${err.message}`,
  );
});

// Bridge Redis pub/sub → Socket.io rooms. Tudo publicado em `tenant:*`
// chega no socket.io e é repassado pros clientes na room correspondente.
const subscription = subscribeEvents('tenant:*', async (channel, eventType, payload) => {
  io.to(channel).emit(eventType, payload);
});

const port = PORTS.agentRuntime;
httpServer.listen(port, () => {
  console.log(`[agent-runtime] listening on http://localhost:${port}`);
  console.log(`[agent-runtime] socket.io path=/socket.io origin=${agentRuntimeEnv.WEB_ORIGIN}`);
});

let shuttingDown = false;
const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[agent-runtime] received ${signal}, shutting down`);
  await subscription.stop().catch(() => undefined);
  await worker.close().catch(() => undefined);
  await closeAgentTasksQueue().catch(() => undefined);
  io.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await closeAllRedis().catch(() => undefined);
  await shutdownLlmTracing().catch(() => undefined);
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
