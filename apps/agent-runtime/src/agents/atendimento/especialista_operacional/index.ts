// =============================================================================
// Handler do agente Especialista Operacional de Atendimento.
//
// Recebe handoff do Coordenador (via worker que enfileira agent-tasks).
// Consulta dados canônicos via tools, gera resposta com LLM Sonnet, e
// executa side-effects via `act`.
//
// Curto-circuitos SEM LLM (decisões determinísticas pré-graph):
//   - account não encontrada / mismatch → escala humano com motivo claro
//   - intent operacional.duvida_regime → sempre humano (catálogo já garante,
//     mas defesa em profundidade aqui também)
// =============================================================================

import type { AgentContext } from '../../types.js';
import { act, type ActOutput } from './act.js';
import { buildEspecialistaGraph, type EspecialistaResponse } from './graph.js';
import {
  loadEspecialistaContext,
  renderConversationHistory,
} from './tools/context.js';

export type EspecialistaOperacionalInput = {
  conversationId: string;
  messageId: string;
  /** Intent classificado pelo Coordenador. */
  intent: string;
  /** Opcional: tamanho do histórico carregado (default 5). */
  historyLimit?: number;
};

export type EspecialistaOperacionalOutput = ActOutput;

const ALWAYS_HUMAN_INTENTS = new Set<string>([
  'operacional.duvida_regime',
  'urgente',
  'requer_humano',
]);

const buildSyntheticEscalation = (
  reason: string,
): EspecialistaResponse => ({
  action: 'escalate_human',
  template_used: null,
  data_used: [],
  confidence: 1,
  reasoning: `escalado deterministicamente: ${reason}`,
  escalation_reason: reason,
});

export const runEspecialistaOperacional = async (
  input: EspecialistaOperacionalInput,
  ctx: AgentContext,
): Promise<EspecialistaOperacionalOutput> => {
  const context = await loadEspecialistaContext(ctx.supabase, {
    tenantId: ctx.tenantId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    traceId: ctx.traceId,
    actor: `agent:${ctx.agentId}`,
    ...(input.historyLimit !== undefined && { historyLimit: input.historyLimit }),
  });

  // -------------------------------------------------------------------------
  // Curto-circuito 1: account indisponível
  // -------------------------------------------------------------------------
  if (context.accountSnapshot === null) {
    const reason =
      context.accountUnavailableReason === 'conversation_without_account'
        ? 'conversation sem account vinculada; Especialista Operacional não opera sem cliente identificado (ADR-014)'
        : context.accountUnavailableReason === 'tenant_mismatch'
          ? 'account aponta pra tenant diferente — possível vazamento de tenant; bloqueado'
          : 'account não encontrada no sistema';
    return act(ctx.supabase, {
      context,
      response: buildSyntheticEscalation(reason),
      preDecided: true,
      intent: input.intent,
      runId: ctx.runId,
      traceId: ctx.traceId,
      llmMetrics: null,
    });
  }

  // -------------------------------------------------------------------------
  // Curto-circuito 2: intent always-human
  // -------------------------------------------------------------------------
  if (ALWAYS_HUMAN_INTENTS.has(input.intent)) {
    return act(ctx.supabase, {
      context,
      response: buildSyntheticEscalation(
        `intent ${input.intent} sempre escala pra humano`,
      ),
      preDecided: true,
      intent: input.intent,
      runId: ctx.runId,
      traceId: ctx.traceId,
      llmMetrics: null,
    });
  }

  // -------------------------------------------------------------------------
  // Caminho normal: roda graph (consult_tools + generate_response)
  // -------------------------------------------------------------------------
  const historyRendered = renderConversationHistory({
    history: context.history,
    currentMessageId: context.message.id,
  });

  const graph = buildEspecialistaGraph(ctx, context);
  const finalState = await graph.invoke({
    text: context.message.content,
    historyRendered,
    intent: input.intent,
    botName: context.displaySettings.bot_name,
  });

  const llmMetrics = finalState.llmMetrics
    ? {
        promptVersion: `atendimento.especialista_operacional.respond@1.0.0`,
        model: finalState.llmMetrics.modelId,
        costUsd: finalState.llmMetrics.costUsd,
      }
    : null;

  // LLM falhou (output inválido) → escala humano automaticamente.
  if (finalState.responseError !== null && finalState.responseError !== undefined) {
    return act(ctx.supabase, {
      context,
      response: buildSyntheticEscalation(
        `output inválido do LLM: ${finalState.responseError}`,
      ),
      preDecided: false,
      intent: input.intent,
      runId: ctx.runId,
      traceId: ctx.traceId,
      llmMetrics,
    });
  }

  if (!finalState.responseParsed) {
    // Estado inválido — escala por segurança.
    return act(ctx.supabase, {
      context,
      response: buildSyntheticEscalation(
        'response ausente após rodar graph',
      ),
      preDecided: false,
      intent: input.intent,
      runId: ctx.runId,
      traceId: ctx.traceId,
      llmMetrics,
    });
  }

  return act(ctx.supabase, {
    context,
    response: finalState.responseParsed,
    preDecided: false,
    intent: input.intent,
    runId: ctx.runId,
    traceId: ctx.traceId,
    llmMetrics,
  });
};

export {
  EspecialistaContextError,
  ESPECIALISTA_OPERACIONAL_AGENT_KEY,
} from './tools/context.js';
