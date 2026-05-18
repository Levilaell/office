// =============================================================================
// LangGraph do Especialista Comercial.
//
// Nós:
//   1. pre_detect          → decide branch (skip LLM ou rodar)
//   2. generate_turn       → roda LLM (só quando branch=run_llm)
//   3. compose             → produz state final pro act
//
// Side-effects (criar lead, mergear slots, enviar mensagens, publicar
// eventos) vivem em `act.ts`. Graph é puro: estado plano de dados.
// =============================================================================

import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import {
  appendLlmAuditLog,
  incrementRunUsage,
  type Json,
  type LeadSlots,
} from '@office/shared-domain';
import { llmCall } from '@office/shared-llm';
import {
  ESPECIALISTA_COMERCIAL_ACTIONS,
  especialistaComercialPrompt,
} from '@office/shared-prompts';
import { z } from 'zod';
import type { AgentContext } from '../../types.js';
import { preDetect, type PreDetectBranch } from './pre-detect.js';
import { normalizeExtractedSlots } from './slot-extractor.js';
import type { EspecialistaComercialContext } from './tools/context.js';
import {
  renderCurrentSlots,
  renderMissingSlots,
} from './tools/slot-rendering.js';

export const ESPECIALISTA_OUTPUT_SCHEMA = z.object({
  action: z.enum(ESPECIALISTA_COMERCIAL_ACTIONS),
  content: z.string().min(1).max(2000),
  extracted_slots: z.record(z.string(), z.unknown()).default({}),
  next_target_slot: z.string().optional(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1).max(500),
  escalation_reason: z.string().optional(),
});

export type EspecialistaOutput = z.infer<typeof ESPECIALISTA_OUTPUT_SCHEMA>;

const stripFences = (raw: string): string => {
  const trimmed = raw.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fence?.[1]?.trim() ?? trimmed;
};

export const tryParseEspecialistaOutput = (
  raw: string,
):
  | { ok: true; value: EspecialistaOutput }
  | { ok: false; error: string } => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `JSON inválido: ${message}` };
  }
  const result = ESPECIALISTA_OUTPUT_SCHEMA.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: `schema inválido: ${result.error.message}` };
  }
  return { ok: true, value: result.data };
};

export type LlmMetricsState = {
  modelId: string;
  costUsd: number;
};

export type ComposedTurn = {
  /** Slots extraídos da mensagem atual (já normalizados). */
  extractedSlots: LeadSlots;
  /** Ação que o materialize vai executar — pode divergir do que o LLM
   *  pediu (override de mark_qualified inválido fica em materialize). */
  intendedAction: EspecialistaOutput['action'];
  /** Conteúdo gerado pelo LLM (ou null em branches sem LLM). */
  llmContent: string | null;
  /** Razão livre — vai pra audit_log. */
  reasoning: string;
  /** Razão de escalação humana, se aplicável. */
  escalationReason: string | null;
  /** Confidence reportada pelo LLM (null em branches sem LLM). */
  confidence: number | null;
  /** Output bruto do LLM pra audit (null em branches sem LLM). */
  rawOutput: EspecialistaOutput | null;
};

const EspecialistaAnnotation = Annotation.Root({
  // Inputs
  currentSlots: Annotation<LeadSlots>(),
  preDetectBranch: Annotation<PreDetectBranch | null>(),
  // LLM intermediate
  llmRaw: Annotation<string>(),
  llmParseError: Annotation<string | null>(),
  rawOutput: Annotation<EspecialistaOutput | null>(),
  llmMetrics: Annotation<LlmMetricsState | null>(),
  // Output
  composed: Annotation<ComposedTurn | null>(),
});

export type EspecialistaGraphState = typeof EspecialistaAnnotation.State;
export type EspecialistaGraphUpdate = typeof EspecialistaAnnotation.Update;

export const buildEspecialistaGraph = (
  ctx: AgentContext,
  context: EspecialistaComercialContext,
) => {
  const preDetectNode = (): Partial<EspecialistaGraphUpdate> => {
    const branch = preDetect({
      lead: context.lead,
      currentMessage: context.message.content,
    });
    return { preDetectBranch: branch };
  };

  const generateTurnNode = async (
    state: EspecialistaGraphState,
  ): Promise<Partial<EspecialistaGraphUpdate>> => {
    const currentSlots = state.currentSlots;
    const { getNextSuggestedSlot, SLOT_QUESTIONS } = await import(
      '@office/shared-domain'
    );
    const nextSlot = getNextSuggestedSlot(currentSlots);

    const system = especialistaComercialPrompt.render({
      botName: context.displaySettings.bot_name,
      conversationHistory: renderHistory(context),
      currentMessage: context.message.content,
      currentSlotsRendered: renderCurrentSlots(currentSlots),
      missingSlotsRendered: renderMissingSlots(currentSlots),
      nextSuggestedSlot: nextSlot,
      nextSlotQuestion: nextSlot ? SLOT_QUESTIONS[nextSlot] : null,
    });

    await ctx.recordMessage('system', {
      prompt: system,
      version: especialistaComercialPrompt.version,
    });
    await ctx.recordMessage('user', {
      text: context.message.content,
    });

    const out = await llmCall({
      tier: especialistaComercialPrompt.tier,
      system,
      messages: [{ role: 'user', content: context.message.content }],
      maxTokens: 800,
      temperature: 0,
      metadata: {
        traceId: ctx.traceId,
        tenantId: ctx.tenantId,
        ...(ctx.accountId !== null && { accountId: ctx.accountId }),
        agentId: ctx.agentId,
        promptVersion: `${especialistaComercialPrompt.id}@${especialistaComercialPrompt.version}`,
      },
      budget: { maxTokens: 1200, maxCostUsd: 0.05 },
    });

    await incrementRunUsage(ctx.supabase, ctx.runId, {
      tokensIn: out.usage.inputTokens,
      tokensOut: out.usage.outputTokens,
      costUsd: out.costUsd,
    });

    await appendLlmAuditLog(ctx.supabase, out, {
      tenantId: ctx.tenantId,
      accountId: ctx.accountId,
      actor: `agent:${ctx.agentId}`,
      action: 'llm.call',
      resource: `conversation:${context.conversation.id}`,
      promptVersion: `${especialistaComercialPrompt.id}@${especialistaComercialPrompt.version}`,
    });

    const assistantContent: Json = {
      text: out.text,
      modelId: out.modelId,
      costUsd: out.costUsd,
      latencyMs: out.latencyMs,
      usage: {
        inputTokens: out.usage.inputTokens,
        outputTokens: out.usage.outputTokens,
        cacheReadInputTokens: out.usage.cacheReadInputTokens,
        cacheCreationInputTokens: out.usage.cacheCreationInputTokens,
      },
    };
    await ctx.recordMessage('assistant', assistantContent);

    const metrics: LlmMetricsState = {
      modelId: out.modelId,
      costUsd: out.costUsd,
    };

    const parsed = tryParseEspecialistaOutput(out.text);
    if (!parsed.ok) {
      return {
        llmRaw: out.text,
        llmParseError: parsed.error,
        rawOutput: null,
        llmMetrics: metrics,
      };
    }
    return {
      llmRaw: out.text,
      llmParseError: null,
      rawOutput: parsed.value,
      llmMetrics: metrics,
    };
  };

  const composeNode = (
    state: EspecialistaGraphState,
  ): Partial<EspecialistaGraphUpdate> => {
    const branch = state.preDetectBranch;
    if (!branch) {
      // Defesa: pre_detect SEMPRE roda. Cair aqui sem branch é bug.
      return {
        composed: {
          extractedSlots: {},
          intendedAction: 'escalate_human',
          llmContent: null,
          reasoning: 'pre_detect branch ausente — escalando por segurança',
          escalationReason: 'pre_detect branch ausente (bug)',
          confidence: null,
          rawOutput: null,
        },
      };
    }

    if (branch.kind === 'silent_handoff') {
      return {
        composed: {
          extractedSlots: {},
          intendedAction: 'escalate_human',
          llmContent: null,
          reasoning: branch.reason,
          escalationReason: branch.reason,
          confidence: null,
          rawOutput: null,
        },
      };
    }

    if (branch.kind === 'schedule_response') {
      // Marker especial: act detecta intendedAction='mark_qualified' + branch
      // schedule_response e dispara markLeadScheduledPending + T10b.
      return {
        composed: {
          extractedSlots: {},
          intendedAction: 'mark_qualified',
          llmContent: null,
          reasoning: branch.reason,
          escalationReason: null,
          confidence: null,
          rawOutput: null,
        },
      };
    }

    // branch.kind === 'run_llm'
    if (state.llmParseError !== null && state.llmParseError !== undefined) {
      return {
        composed: {
          extractedSlots: {},
          intendedAction: 'escalate_human',
          llmContent: null,
          reasoning: `LLM produziu output inválido: ${state.llmParseError}`,
          escalationReason: `LLM produziu output inválido: ${state.llmParseError}`,
          confidence: null,
          rawOutput: null,
        },
      };
    }

    const raw = state.rawOutput;
    if (!raw) {
      // Sem rawOutput e sem parseError = sem LLM call ainda. Bug.
      return {
        composed: {
          extractedSlots: {},
          intendedAction: 'escalate_human',
          llmContent: null,
          reasoning: 'rawOutput ausente após run_llm — bug no graph',
          escalationReason: 'rawOutput ausente após run_llm',
          confidence: null,
          rawOutput: null,
        },
      };
    }

    return {
      composed: {
        extractedSlots: normalizeExtractedSlots(raw.extracted_slots),
        intendedAction: raw.action,
        llmContent: raw.content,
        reasoning: raw.reasoning,
        escalationReason: raw.escalation_reason ?? null,
        confidence: raw.confidence,
        rawOutput: raw,
      },
    };
  };

  const shouldRunLlm = (state: EspecialistaGraphState): string => {
    return state.preDetectBranch?.kind === 'run_llm' ? 'generate_turn' : 'compose';
  };

  return new StateGraph(EspecialistaAnnotation)
    .addNode('pre_detect', preDetectNode)
    .addNode('generate_turn', generateTurnNode)
    .addNode('compose', composeNode)
    .addEdge(START, 'pre_detect')
    .addConditionalEdges('pre_detect', shouldRunLlm, {
      generate_turn: 'generate_turn',
      compose: 'compose',
    })
    .addEdge('generate_turn', 'compose')
    .addEdge('compose', END)
    .compile();
};

const renderHistory = (context: EspecialistaComercialContext): string => {
  const filtered = context.history.filter((m) => m.id !== context.message.id);
  if (filtered.length === 0) return '';
  const senderLabel = (st: string): string => {
    switch (st) {
      case 'end_client':
        return 'cliente';
      case 'agent':
        return 'agente';
      case 'operator':
        return 'operador';
      case 'system':
        return 'sistema';
      default:
        return st;
    }
  };
  return filtered
    .map((m) => `${senderLabel(m.sender_type)}: ${m.content}`)
    .join('\n');
};

export type EspecialistaGraph = ReturnType<typeof buildEspecialistaGraph>;
