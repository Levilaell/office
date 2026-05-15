import { buildRouterGraph, type RouterDecision } from './graph.js';
import type { AgentContext } from '../types.js';

export type RouterInput = {
  text: string;
  accountId?: string;
};

export type RouterOutput = RouterDecision;

export class RouterValidationError extends Error {
  override readonly name = 'RouterValidationError';
  constructor(public readonly rawOutput: string, message: string) {
    super(message);
  }
}

/**
 * Executa o roteador. Retorna a classificação validada ou lança
 * RouterValidationError se o LLM falhar na estrutura (e o validate node
 * marcou validationError). O worker captura e marca o run como failed.
 */
export const runRouter = async (
  input: RouterInput,
  ctx: AgentContext,
): Promise<RouterOutput> => {
  const graph = buildRouterGraph(ctx);
  const state = await graph.invoke({
    text: input.text,
    accountId: input.accountId ?? null,
  });

  if (state.validationError !== null && state.validationError !== undefined) {
    throw new RouterValidationError(state.classificationRaw, state.validationError);
  }
  if (!state.classification) {
    throw new RouterValidationError(
      state.classificationRaw,
      'classification ausente após executar o graph',
    );
  }
  return state.classification;
};

export { DEPARTMENTS, type RouterDepartment } from './graph.js';
