// =============================================================================
// Mock de LLM pra testes
//
// `llmCall` consulta este registry quando `process.env.LLM_MOCK_MODE='replay'`.
// Caller (teste) registra responses por matcher; a primeira resposta cujo
// matcher casa com o input é devolvida. Sem matcher, llmCall lança.
//
// Diferente de gravação de cassette real:
//   - Não há HTTP — Anthropic client nunca é instanciado em replay
//   - Não há check de hash — usamos matchers em memória, mais flexíveis
//     pra testes que querem casar por substring/regex
//
// Pra eval real (HTTP gravado), Sprint 1.5+ adiciona persistência de cassette
// em JSON. Esta Sprint roda eval em replay puro: valida estrutura, não
// accuracy do modelo.
// =============================================================================

import type { LlmCallInput, LlmCallOutput, LlmUsage } from './types';

export type LlmMockMatcher = (input: LlmCallInput) => boolean;

export type LlmMockResponseShape = {
  text: string;
  modelId?: string;
  costUsd?: number;
  latencyMs?: number;
  usage?: Partial<LlmUsage>;
};

export type LlmMockEntry = {
  matcher: LlmMockMatcher;
  response: LlmMockResponseShape;
};

const registry: LlmMockEntry[] = [];

export const registerLlmMockResponse = (entry: LlmMockEntry): void => {
  registry.push(entry);
};

export const clearLlmMockRegistry = (): void => {
  registry.length = 0;
};

export const isLlmMockMode = (): boolean =>
  process.env.LLM_MOCK_MODE === 'replay';

const fakeTraceId = (): string =>
  '00000000-0000-4000-8000-' + Math.floor(Math.random() * 1e12).toString(16).padStart(12, '0').slice(-12);

export const resolveMockResponse = (input: LlmCallInput): LlmCallOutput => {
  const entry = registry.find((e) => e.matcher(input));
  if (!entry) {
    const preview = input.messages
      .map((m) => `${m.role}:${typeof m.content === 'string' ? m.content.slice(0, 80) : '[block]'}`)
      .join(' | ');
    throw new Error(
      `LLM mock sem matcher pra input (tier=${input.tier}): ${preview}`,
    );
  }
  const r = entry.response;
  const usage: LlmUsage = {
    inputTokens: r.usage?.inputTokens ?? 100,
    outputTokens: r.usage?.outputTokens ?? 50,
    cacheReadInputTokens: r.usage?.cacheReadInputTokens ?? 0,
    cacheCreationInputTokens: r.usage?.cacheCreationInputTokens ?? 0,
  };
  return {
    text: r.text,
    // Forçamos um modelo padrão de mock — caller pode sobrescrever via entry.
    modelId: (r.modelId ?? 'mock-model') as LlmCallOutput['modelId'],
    usage,
    costUsd: r.costUsd ?? 0.001,
    latencyMs: r.latencyMs ?? 10,
    stopReason: 'end_turn',
    traceId: input.metadata?.traceId ?? fakeTraceId(),
    spanId: undefined,
  };
};

/**
 * Constrói um matcher simples baseado em substring presente no último
 * `user` message. Útil pra eval test onde cada fixture vira uma entry.
 */
export const matchByUserContent = (substring: string): LlmMockMatcher => (input) => {
  const last = input.messages[input.messages.length - 1];
  if (!last || last.role !== 'user') return false;
  if (typeof last.content !== 'string') return false;
  return last.content.includes(substring);
};
