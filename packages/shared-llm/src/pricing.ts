import type { LlmUsage } from './types';

interface Pricing {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok: number;
  cacheWritePerMTok: number;
}

// Fonte: https://platform.claude.com/docs/en/about-claude/pricing
// Cache write = 5min (1.25x base input). Cache read = 0.1x base input.
// Opus 4.7 usa NOVO tokenizer e cobra $5/$25 (mesma família de 4.5/4.6),
// NÃO $15/$75 do antigo Opus 4/4.1.
export const MODEL_PRICING: Record<string, Pricing> = {
  'claude-haiku-4-5-20251001': {
    inputPerMTok: 1.0,
    outputPerMTok: 5.0,
    cacheReadPerMTok: 0.1,
    cacheWritePerMTok: 1.25,
  },
  'claude-sonnet-4-6': {
    inputPerMTok: 3.0,
    outputPerMTok: 15.0,
    cacheReadPerMTok: 0.3,
    cacheWritePerMTok: 3.75,
  },
  'claude-opus-4-7': {
    inputPerMTok: 5.0,
    outputPerMTok: 25.0,
    cacheReadPerMTok: 0.5,
    cacheWritePerMTok: 6.25,
  },
};

export const calculateCost = (modelId: string, usage: LlmUsage): number => {
  const pricing = MODEL_PRICING[modelId];
  if (!pricing) {
    throw new Error(
      `Unknown model pricing: ${modelId}. Adicionar em packages/shared-llm/src/pricing.ts (MODEL_PRICING).`,
    );
  }
  const cost =
    (usage.inputTokens * pricing.inputPerMTok) / 1_000_000 +
    (usage.outputTokens * pricing.outputPerMTok) / 1_000_000 +
    (usage.cacheReadInputTokens * pricing.cacheReadPerMTok) / 1_000_000 +
    (usage.cacheCreationInputTokens * pricing.cacheWritePerMTok) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
};
