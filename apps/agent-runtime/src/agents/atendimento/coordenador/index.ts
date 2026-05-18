// =============================================================================
// Handler do agente Coordenador de Atendimento.
//
// Composição:
//   1. Carrega contexto (conversation, message, history, settings, agent).
//   2. Roda graph LangGraph (pre_classify → classify? → decide).
//   3. Executa side-effects via `act` (mensagem outbound, eventos, classification).
//
// Lança erro só em invariantes (contexto inexistente, tenant mismatch). Erros
// de LLM (JSON inválido) são tratados dentro do graph e viram escalate_human.
// =============================================================================

import { coordenadorAtendimentoPrompt } from '@office/shared-prompts';
import type { AgentContext } from '../../types.js';
import { act, type ActOutput } from './act.js';
import { buildCoordinatorGraph } from './graph.js';
import { loadCoordenadorContext } from './tools/context.js';
import { renderConversationHistory } from './tools/context.js';
import { renderIntentsForPrompt } from './tools/intent-rendering.js';

export type CoordenadorInput = {
  conversationId: string;
  messageId: string;
  /** Opcional: tamanho do histórico carregado (default 5). */
  historyLimit?: number;
};

export type CoordenadorOutput = ActOutput;

export const runCoordenadorAtendimento = async (
  input: CoordenadorInput,
  ctx: AgentContext,
): Promise<CoordenadorOutput> => {
  const context = await loadCoordenadorContext(ctx.supabase, {
    tenantId: ctx.tenantId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    ...(input.historyLimit !== undefined && { historyLimit: input.historyLimit }),
  });

  const mediaType =
    typeof (context.message.metadata as Record<string, unknown> | null)?.media_type ===
    'string'
      ? ((context.message.metadata as Record<string, unknown>).media_type as string)
      : 'text';

  const historyRendered = renderConversationHistory({
    history: context.history,
    currentMessageId: context.message.id,
  });

  const graph = buildCoordinatorGraph(ctx, context);
  const finalState = await graph.invoke({
    text: context.message.content,
    mediaType,
    intentsRendered: renderIntentsForPrompt(),
    historyRendered,
    botName: context.displaySettings.bot_name,
    preClassify: null,
    classificationRaw: '',
    classification: null,
    classificationError: null,
    decision: null,
    llmMetrics: null,
  });

  if (!finalState.decision) {
    throw new Error(
      'coordenador: decision ausente após executar o graph (estado inválido)',
    );
  }

  const llmMetrics = finalState.llmMetrics
    ? {
        promptVersion: `${coordenadorAtendimentoPrompt.id}@${coordenadorAtendimentoPrompt.version}`,
        model: finalState.llmMetrics.modelId,
        costUsd: finalState.llmMetrics.costUsd,
      }
    : null;

  return act(ctx.supabase, {
    context,
    decision: finalState.decision,
    classification: finalState.classification,
    classificationError: finalState.classificationError,
    preClassifyHandled: finalState.preClassify?.handled === true,
    runId: ctx.runId,
    traceId: ctx.traceId,
    llmMetrics,
  });
};

export { CoordenadorContextError } from './tools/context.js';
