import type Anthropic from '@anthropic-ai/sdk';
import { resolveModelForTier, type LlmModelId } from '@office/shared-config';
import { SpanStatusCode, trace, type Tracer } from '@opentelemetry/api';
import { getAnthropicClient } from './client';
import { estimateInputTokens, preflightBudget } from './budget';
import { LLM_TRACER_SCOPE } from './instrumentation';
import { calculateCost } from './pricing';
import type {
  LlmCallBudget,
  LlmCallInput,
  LlmCallOutput,
  LlmStopReason,
  LlmUsage,
} from './types';

// Tracer precisa ser resolvido lazy: quando este módulo é avaliado em top-level,
// `initLlmTracing()` ainda pode não ter rodado, e `trace.getTracer()` capturaria
// um NoOp delegate — resultando em spans com traceId zerado.
let cachedTracer: Tracer | null = null;
const getLlmTracer = (): Tracer => {
  if (!cachedTracer) cachedTracer = trace.getTracer(LLM_TRACER_SCOPE);
  return cachedTracer;
};

const readPositiveInt = (raw: string | undefined, fallback: number): number => {
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const readPositiveFloat = (raw: string | undefined, fallback: number): number => {
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// `llmCall` envolve a chamada em um span pai (`llm.call`) com
// `tracer.startActiveSpan` para:
// 1. Estabelecer um traceId estável correlacionável no Langfuse, mesmo quando
//    o span do openinference (criado dentro do patched create) fica visível
//    só durante a execução do create.
// 2. Permitir capturar `trace.getActiveSpan()` após a chamada terminar (o
//    callback ainda está dentro do contexto do span pai).
//
// `output.spanId` refere-se ao span pai `llm.call`, não ao child criado
// pelo AnthropicInstrumentation. Use `traceId` para correlação ponta-a-ponta.
export const llmCall = (input: LlmCallInput): Promise<LlmCallOutput> => {
  return getLlmTracer().startActiveSpan('llm.call', async (parentSpan) => {
    const startedAt = Date.now();
    const modelId = resolveModelForTier(input.tier);

    parentSpan.setAttribute('llm.tier', input.tier);
    parentSpan.setAttribute('llm.model', modelId);
    if (input.metadata?.tenantId) {
      parentSpan.setAttribute('app.tenant_id', input.metadata.tenantId);
    }
    if (input.metadata?.accountId) {
      parentSpan.setAttribute('app.account_id', input.metadata.accountId);
    }
    if (input.metadata?.agentId) {
      parentSpan.setAttribute('app.agent_id', input.metadata.agentId);
    }
    if (input.metadata?.promptVersion) {
      parentSpan.setAttribute('app.prompt_version', input.metadata.promptVersion);
    }

    try {
      const defaultMaxTokens = readPositiveInt(
        process.env.LLM_DEFAULT_BUDGET_MAX_TOKENS,
        4000,
      );
      const defaultMaxCostUsd = readPositiveFloat(
        process.env.LLM_DEFAULT_BUDGET_MAX_COST_USD,
        0.1,
      );

      const requestedMaxTokens = input.maxTokens ?? defaultMaxTokens;

      const budget: LlmCallBudget = {
        maxTokens: input.budget?.maxTokens ?? defaultMaxTokens,
        maxCostUsd: input.budget?.maxCostUsd ?? defaultMaxCostUsd,
      };

      const estimatedInputTokens = estimateInputTokens(
        input.messages,
        input.system,
      );
      preflightBudget({
        estimatedInputTokens,
        requestedMaxTokens,
        modelId,
        budget,
      });

      const client = getAnthropicClient();
      const createParams: Anthropic.MessageCreateParamsNonStreaming = {
        model: modelId,
        max_tokens: requestedMaxTokens,
        messages: input.messages as Anthropic.MessageParam[],
      };
      if (input.system !== undefined) createParams.system = input.system;
      if (input.temperature !== undefined) {
        createParams.temperature = input.temperature;
      }
      if (input.metadata?.tenantId) {
        createParams.metadata = { user_id: `tenant:${input.metadata.tenantId}` };
      }

      const response = await client.messages.create(createParams);

      const usage: LlmUsage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
        cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
      };
      const costUsd = calculateCost(modelId, usage);
      parentSpan.setAttribute('llm.cost_usd', costUsd);
      parentSpan.setAttribute('llm.usage.input_tokens', usage.inputTokens);
      parentSpan.setAttribute('llm.usage.output_tokens', usage.outputTokens);

      if (budget.maxCostUsd !== undefined && costUsd > budget.maxCostUsd) {
        console.warn(
          `[llm] custo real ($${costUsd}) ultrapassou budget ($${budget.maxCostUsd}) — modelo=${modelId} trace=${input.metadata?.traceId ?? 'n/a'}`,
        );
      }

      const text = response.content
        .filter((c): c is Anthropic.TextBlock => c.type === 'text')
        .map((c) => c.text)
        .join('');

      const ctx = parentSpan.spanContext();
      parentSpan.setStatus({ code: SpanStatusCode.OK });

      const output: LlmCallOutput = {
        text,
        modelId: modelId as LlmModelId,
        usage,
        costUsd,
        latencyMs: Date.now() - startedAt,
        stopReason: response.stop_reason as LlmStopReason | null,
        traceId: input.metadata?.traceId ?? ctx.traceId,
        spanId: ctx.spanId,
      };
      return output;
    } catch (err) {
      parentSpan.recordException(err as Error);
      parentSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      parentSpan.end();
    }
  });
};
