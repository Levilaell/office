import { buildRouterGraph, type RouterDecision } from './graph.js';
import type { AgentContext } from '../types.js';

export type RouterInput = {
  text: string;
  accountId?: string;
  // Sprint Fase 2-prep — quando o Roteador classifica mensagem inbound de
  // canal externo, esses campos viajam no payload da task pra que o graph
  // publique `message.routed` e grave audit_log dedicado. Ausentes em
  // triagens internas (Fase 0 legado) — graph entra em no-op no node publish.
  conversationId?: string;
  messageId?: string;
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
    conversationId: input.conversationId ?? null,
    messageId: input.messageId ?? null,
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
