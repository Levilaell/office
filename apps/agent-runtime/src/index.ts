// Tracing precisa ser inicializado ANTES de qualquer outra coisa.
import './instrumentation';

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { PORTS } from '@office/shared-config/constants';
import { health } from '@office/shared-domain';
import { llmCall, type LlmCallInput } from '@office/shared-llm';
import type { AgentTier } from '@office/shared-config';

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

const port = PORTS.agentRuntime;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[agent-runtime] listening on http://localhost:${info.port}`);
});
