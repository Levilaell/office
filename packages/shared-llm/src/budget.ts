import { calculateCost } from './pricing';
import type { LlmCallBudget, LlmMessage } from './types';

const stringifyContent = (content: LlmMessage['content']): string =>
  typeof content === 'string' ? content : JSON.stringify(content);

// Heurística ~4 chars/token. Subestima ligeiramente texto puro mas é suficiente
// pra preflight; o budget pos-call corrige usando os usage tokens reais.
export const estimateInputTokens = (messages: LlmMessage[], system?: string): number => {
  const parts: string[] = system ? [system] : [];
  for (const m of messages) parts.push(stringifyContent(m.content));
  const text = parts.join(' ');
  return Math.ceil(text.length / 4);
};

interface PreflightArgs {
  estimatedInputTokens: number;
  requestedMaxTokens: number;
  modelId: string;
  budget: LlmCallBudget;
}

export const preflightBudget = (args: PreflightArgs): void => {
  const { estimatedInputTokens, requestedMaxTokens, modelId, budget } = args;

  if (budget.maxTokens !== undefined && requestedMaxTokens > budget.maxTokens) {
    throw new Error(
      `Budget excedido: requestedMaxTokens=${requestedMaxTokens} > maxTokens=${budget.maxTokens}`,
    );
  }

  if (budget.maxCostUsd !== undefined) {
    const worstCase = calculateCost(modelId, {
      inputTokens: estimatedInputTokens,
      outputTokens: requestedMaxTokens,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
    });
    if (worstCase > budget.maxCostUsd) {
      throw new Error(
        `Budget excedido: worstCase=$${worstCase} > maxCostUsd=$${budget.maxCostUsd} (modelo=${modelId})`,
      );
    }
  }
};

export type { LlmCallBudget as Budget };
