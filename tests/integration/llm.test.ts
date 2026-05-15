import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  initLlmTracing,
  llmCall,
  resetAnthropicClient,
  shutdownLlmTracing,
} from '@office/shared-llm';

const hasKeys =
  !!process.env.ANTHROPIC_API_KEY &&
  !!process.env.LANGFUSE_PUBLIC_KEY &&
  !!process.env.LANGFUSE_SECRET_KEY;

describe.skipIf(!hasKeys)('llm wrapper (real Anthropic call)', () => {
  beforeAll(() => {
    initLlmTracing({
      langfusePublicKey: process.env.LANGFUSE_PUBLIC_KEY ?? '',
      langfuseSecretKey: process.env.LANGFUSE_SECRET_KEY ?? '',
      langfuseHost: process.env.LANGFUSE_HOST ?? 'https://cloud.langfuse.com',
      serviceName: 'office-tests',
    });
    resetAnthropicClient();
  });

  afterAll(async () => {
    await shutdownLlmTracing();
  });

  it('chama Haiku e retorna texto + custo + trace_id OTEL válido', async () => {
    const out = await llmCall({
      tier: 'triage',
      messages: [{ role: 'user', content: 'Diga olá em português, em uma frase curta.' }],
      maxTokens: 100,
    });
    expect(out.text.length).toBeGreaterThan(0);
    expect(out.costUsd).toBeGreaterThan(0);
    expect(out.modelId).toContain('haiku');
    expect(out.usage.inputTokens).toBeGreaterThan(0);
    expect(out.usage.outputTokens).toBeGreaterThan(0);
    // Garante que o tracer ativo capturou o span — se o monkey-patch do
    // openinference não tiver pego, traceId vem vazio e o regex falha.
    expect(out.traceId).toMatch(/^[a-f0-9]{32}$/);
    // eslint-disable-next-line no-console
    console.log(
      `[llm.test] traceId=${out.traceId} model=${out.modelId} cost=$${out.costUsd}`,
    );
  });
});

describe('llm budget preflight', () => {
  it('bloqueia maxTokens acima do budget configurado', async () => {
    await expect(
      llmCall({
        tier: 'triage',
        messages: [{ role: 'user', content: 'oi' }],
        maxTokens: 100_000,
        budget: { maxTokens: 1000 },
      }),
    ).rejects.toThrow(/Budget excedido/);
  });

  it('bloqueia worst-case acima do budget de custo', async () => {
    await expect(
      llmCall({
        tier: 'critical',
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 4000,
        budget: { maxTokens: 4000, maxCostUsd: 0.01 },
      }),
    ).rejects.toThrow(/Budget excedido/);
  });
});
