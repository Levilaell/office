// =============================================================================
// LangGraph do Coordenador de Atendimento.
//
// Nós:
//   1. pre_classify (determinístico)  → se decidiu, pula classify
//   2. classify (LLM Sonnet)          → roda apenas quando pre_classify falha
//   3. decide                         → mapeia intent/confidence → decision
//
// O nó `act` (efeitos colaterais — manda mensagem, publica eventos, registra
// classification) vive fora do graph em `act.ts` e é invocado pelo handler.
// LangGraph cuida do raciocínio; efeitos ficam externos pra facilitar test e
// pra que o estado do graph permaneça uma estrutura plana de dados.
// =============================================================================

import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import {
  appendLlmAuditLog,
  incrementRunUsage,
  type Json,
} from '@office/shared-domain';
import { llmCall } from '@office/shared-llm';
import { coordenadorAtendimentoPrompt } from '@office/shared-prompts';
import { z } from 'zod';
import type { AgentContext } from '../../types.js';
import { decide, type DecideResult } from './decide.js';
import { preClassify, type PreClassifyResult } from './pre-classify.js';
import { renderConversationHistory, type CoordenadorContext } from './tools/context.js';
import { renderIntentsForPrompt } from './tools/intent-rendering.js';

export const CLASSIFICATION_SCHEMA = z.object({
  intent: z.string().min(1),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1).max(500),
  alternatives: z.array(z.string()).optional(),
});

export type ClassificationOutput = z.infer<typeof CLASSIFICATION_SCHEMA>;

const stripFences = (raw: string): string => {
  const trimmed = raw.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fence?.[1]?.trim() ?? trimmed;
};

const tryParseClassification = (
  raw: string,
):
  | { ok: true; value: ClassificationOutput }
  | { ok: false; error: string } => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `JSON inválido: ${message}` };
  }
  const result = CLASSIFICATION_SCHEMA.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: `schema inválido: ${result.error.message}` };
  }
  return { ok: true, value: result.data };
};

export type LlmMetricsState = {
  modelId: string;
  costUsd: number;
};

const CoordinatorAnnotation = Annotation.Root({
  text: Annotation<string>(),
  mediaType: Annotation<string>(),
  intentsRendered: Annotation<string>(),
  historyRendered: Annotation<string>(),
  botName: Annotation<string>(),
  preClassify: Annotation<PreClassifyResult | null>(),
  classificationRaw: Annotation<string>(),
  classification: Annotation<ClassificationOutput | null>(),
  classificationError: Annotation<string | null>(),
  decision: Annotation<DecideResult | null>(),
  llmMetrics: Annotation<LlmMetricsState | null>(),
});

export type CoordinatorGraphState = typeof CoordinatorAnnotation.State;
export type CoordinatorGraphUpdate = typeof CoordinatorAnnotation.Update;

export const buildCoordinatorGraph = (
  ctx: AgentContext,
  context: CoordenadorContext,
) => {
  const promptText = (input: {
    historyRendered: string;
    text: string;
    botName: string;
    intentsRendered: string;
  }): string =>
    coordenadorAtendimentoPrompt.render({
      botName: input.botName,
      conversationHistory: input.historyRendered,
      currentMessage: input.text,
      intentsRendered: input.intentsRendered,
    });

  const preClassifyNode = (
    state: CoordinatorGraphState,
  ): Partial<CoordinatorGraphUpdate> => {
    const result = preClassify({
      contentTrimmed: state.text.trim(),
      mediaType: state.mediaType,
    });
    return { preClassify: result };
  };

  const classifyNode = async (
    state: CoordinatorGraphState,
  ): Promise<Partial<CoordinatorGraphUpdate>> => {
    const system = promptText({
      historyRendered: state.historyRendered,
      text: state.text,
      botName: state.botName,
      intentsRendered: state.intentsRendered,
    });

    await ctx.recordMessage('system', {
      prompt: system,
      version: coordenadorAtendimentoPrompt.version,
    });
    await ctx.recordMessage('user', {
      text: state.text,
      mediaType: state.mediaType,
    });

    const out = await llmCall({
      tier: coordenadorAtendimentoPrompt.tier,
      system,
      messages: [{ role: 'user', content: state.text }],
      maxTokens: 800,
      temperature: 0,
      metadata: {
        traceId: ctx.traceId,
        tenantId: ctx.tenantId,
        ...(ctx.accountId !== null && { accountId: ctx.accountId }),
        agentId: ctx.agentId,
        promptVersion: `${coordenadorAtendimentoPrompt.id}@${coordenadorAtendimentoPrompt.version}`,
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
      promptVersion: `${coordenadorAtendimentoPrompt.id}@${coordenadorAtendimentoPrompt.version}`,
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
    const parsed = tryParseClassification(out.text);
    if (!parsed.ok) {
      return {
        classificationRaw: out.text,
        classificationError: parsed.error,
        llmMetrics: metrics,
      };
    }
    return {
      classificationRaw: out.text,
      classification: parsed.value,
      llmMetrics: metrics,
    };
  };

  const decideNode = (
    state: CoordinatorGraphState,
  ): Partial<CoordinatorGraphUpdate> => {
    // Pre-classify decidiu? Pula direto pra decision.
    if (state.preClassify?.handled === true) {
      const result = decide({
        intent: state.preClassify.intent,
        confidence: null,
      });
      return { decision: result };
    }

    // LLM falhou? Escala humano automaticamente.
    if (state.classificationError !== null && state.classificationError !== undefined) {
      const result = decide({
        intent: 'requer_humano',
        confidence: null,
      });
      // Anota razão original do erro do LLM no rationale.
      return {
        decision: {
          ...result,
          rationale: `${result.rationale} (motivo: ${state.classificationError})`,
        },
      };
    }

    if (state.classification) {
      const result = decide({
        intent: state.classification.intent,
        confidence: state.classification.confidence,
      });
      return { decision: result };
    }

    // Nada bateu — ainda escala humano por segurança.
    return {
      decision: decide({ intent: 'requer_humano', confidence: null }),
    };
  };

  const shouldRunLlm = (state: CoordinatorGraphState): string => {
    return state.preClassify?.handled === true ? 'decide' : 'classify';
  };

  return new StateGraph(CoordinatorAnnotation)
    .addNode('pre_classify', preClassifyNode)
    .addNode('classify', classifyNode)
    .addNode('decide', decideNode)
    .addEdge(START, 'pre_classify')
    .addConditionalEdges('pre_classify', shouldRunLlm, {
      classify: 'classify',
      decide: 'decide',
    })
    .addEdge('classify', 'decide')
    .addEdge('decide', END)
    .compile();
};

export type CoordinatorGraph = ReturnType<typeof buildCoordinatorGraph>;
