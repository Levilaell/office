// =============================================================================
// Handler do agente Especialista Comercial de Atendimento.
//
// Composição:
//   1. Carrega contexto (conversation, message, history, lead opcional, agent).
//   2. Roda graph (pre_detect → [generate_turn?] → compose).
//   3. Materializa via `act`: cria lead se necessário, mergeia slots, envia
//      mensagem, publica eventos, audita.
// =============================================================================

import { especialistaComercialPrompt } from '@office/shared-prompts';
import type { AgentContext } from '../../types.js';
import { act, type ActOutput } from './act.js';
import { buildEspecialistaGraph } from './graph.js';
import { loadEspecialistaComercialContext } from './tools/context.js';

export type EspecialistaComercialInput = {
  conversationId: string;
  messageId: string;
  /** Default 5. */
  historyLimit?: number;
};

export type EspecialistaComercialOutput = ActOutput;

export const runEspecialistaComercial = async (
  input: EspecialistaComercialInput,
  ctx: AgentContext,
): Promise<EspecialistaComercialOutput> => {
  const context = await loadEspecialistaComercialContext(ctx.supabase, {
    tenantId: ctx.tenantId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    ...(input.historyLimit !== undefined && { historyLimit: input.historyLimit }),
  });

  const currentSlots = (context.lead?.qualification_data ?? {}) as Record<
    string,
    unknown
  >;

  const graph = buildEspecialistaGraph(ctx, context);
  const finalState = await graph.invoke({
    currentSlots,
    preDetectBranch: null,
    llmRaw: '',
    llmParseError: null,
    rawOutput: null,
    llmMetrics: null,
    composed: null,
  });

  if (!finalState.composed) {
    throw new Error(
      'especialista_comercial: composed ausente após executar o graph',
    );
  }

  const llmMetrics = finalState.llmMetrics
    ? {
        promptVersion: `${especialistaComercialPrompt.id}@${especialistaComercialPrompt.version}`,
        model: finalState.llmMetrics.modelId,
        costUsd: finalState.llmMetrics.costUsd,
      }
    : null;

  return act(ctx.supabase, {
    context,
    composed: finalState.composed,
    runId: ctx.runId,
    traceId: ctx.traceId,
    llmMetrics,
  });
};

export { EspecialistaComercialContextError } from './tools/context.js';
