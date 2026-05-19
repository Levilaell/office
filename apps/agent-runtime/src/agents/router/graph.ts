import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import {
  appendAuditLog,
  appendLlmAuditLog,
  incrementRunUsage,
  type Json,
} from '@office/shared-domain';
import {
  publishEvent,
  type MessageRoutedPayload,
} from '@office/shared-events';
import { llmCall } from '@office/shared-llm';
import { routerPrompt } from '@office/shared-prompts';
import {
  DEPARTMENTS as SHARED_DEPARTMENTS,
  type Department,
} from '@office/shared-types';
import { z } from 'zod';
import type { AgentContext } from '../types.js';

// Re-export do enum canônico de shared-types — Roteador classifica em qualquer
// um dos 7 (6 departamentos operacionais + platform). Sprint Fase 2-prep
// alinhou o enum com shared-types (antes graph mantinha cópia de 6 elementos
// sem `platform`).
export const DEPARTMENTS = SHARED_DEPARTMENTS;
export type RouterDepartment = Department;

export const ROUTER_DECISION_SCHEMA = z.object({
  department: z.enum(SHARED_DEPARTMENTS),
  confidence: z.enum(['high', 'medium', 'low']),
  reasoning: z.string().min(1),
  alternatives: z.array(z.enum(SHARED_DEPARTMENTS)).optional(),
});
export type RouterDecision = z.infer<typeof ROUTER_DECISION_SCHEMA>;

// 0-1 score pro payload `message.routed` (schema do evento espera number).
// Calibragem provisória — refinar em eval contínuo quando houver tráfego
// real de canais (TD potencial).
const CONFIDENCE_SCORE: Record<RouterDecision['confidence'], number> = {
  high: 0.9,
  medium: 0.6,
  low: 0.3,
};

type LlmMetrics = {
  modelId: string;
  costUsd: number;
  latencyMs: number;
  traceId: string;
};

const RouterAnnotation = Annotation.Root({
  text: Annotation<string>(),
  accountId: Annotation<string | null>(),
  // Inbound de canal: conversationId/messageId presentes → o node `publish`
  // emite `message.routed` + audit_log próprio. Triagem interna (Fase 0
  // legado) deixa null e o publish vira no-op.
  conversationId: Annotation<string | null>(),
  messageId: Annotation<string | null>(),
  classificationRaw: Annotation<string>(),
  classification: Annotation<RouterDecision | null>(),
  validationError: Annotation<string | null>(),
  llmMetrics: Annotation<LlmMetrics | null>(),
  routedEventPublished: Annotation<boolean>(),
});

export type RouterGraphState = typeof RouterAnnotation.State;
export type RouterGraphUpdate = typeof RouterAnnotation.Update;

const stripFences = (raw: string): string => {
  const trimmed = raw.trim();
  // Prompt proíbe fences mas LLMs eventualmente injetam — tolerância
  // controlada pra não derrubar a triagem por formatação.
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fence?.[1]?.trim() ?? trimmed;
};

const tryParseDecision = (
  raw: string,
): { ok: true; value: RouterDecision } | { ok: false; error: string } => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `JSON inválido: ${message}` };
  }
  const result = ROUTER_DECISION_SCHEMA.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: `schema inválido: ${result.error.message}` };
  }
  return { ok: true, value: result.data };
};

/**
 * Constrói o graph do roteador. Três nós:
 *
 *  classify: chama LLM (tier=triage / Haiku) com o prompt versionado, persiste
 *            a resposta crua em `classificationRaw` e registra:
 *            - mensagem `system` (prompt renderizado)
 *            - mensagem `user` (texto da mensagem a classificar)
 *            - mensagem `assistant` (resposta do modelo + custo + modelo)
 *            - audit_log via appendLlmAuditLog (action='llm.call')
 *
 *  validate: parseia + valida Zod. Sucesso → classification preenchido.
 *            Falha → validationError preenchido.
 *
 *  publish:  CONDICIONAL. Se input carrega conversationId+messageId (mensagem
 *            inbound de canal), publica evento `message.routed` no canal
 *            `tenant:<id>` + grava audit_log próprio (action='message.routed').
 *            Sem esses campos (triagem interna legada), no-op silencioso.
 *            Sprint Fase 2-prep — supersedes ADR-019.
 */
export const buildRouterGraph = (ctx: AgentContext) => {
  const promptText = routerPrompt.render({});
  const promptVersion = `${routerPrompt.id}@${routerPrompt.version}`;

  const classify = async (
    state: RouterGraphState,
  ): Promise<Partial<RouterGraphUpdate>> => {
    await ctx.recordMessage('system', {
      prompt: promptText,
      version: routerPrompt.version,
    });
    await ctx.recordMessage('user', {
      text: state.text,
      accountId: state.accountId,
    });

    const out = await llmCall({
      tier: routerPrompt.tier,
      system: promptText,
      messages: [{ role: 'user', content: state.text }],
      maxTokens: 600,
      temperature: 0,
      metadata: {
        traceId: ctx.traceId,
        tenantId: ctx.tenantId,
        ...(ctx.accountId !== null && { accountId: ctx.accountId }),
        agentId: ctx.agentId,
        promptVersion,
      },
      budget: { maxTokens: 1500, maxCostUsd: 0.02 },
    });

    // Acumula turns/tokens/custo IMEDIATAMENTE após o llmCall — billable,
    // tem que ser registrado mesmo se audit ou recordMessage falharem em
    // seguida. Substitui o scan post-mortem de agent_messages que o worker
    // fazia antes (TD-002).
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
      resource: `task:${ctx.taskId}`,
      promptVersion,
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

    return {
      classificationRaw: out.text,
      llmMetrics: {
        modelId: out.modelId,
        costUsd: out.costUsd,
        latencyMs: out.latencyMs,
        traceId: out.traceId,
      },
    };
  };

  const validate = (state: RouterGraphState): Partial<RouterGraphUpdate> => {
    const result = tryParseDecision(state.classificationRaw);
    if (!result.ok) {
      return { validationError: result.error };
    }
    return { classification: result.value };
  };

  const publish = async (
    state: RouterGraphState,
  ): Promise<Partial<RouterGraphUpdate>> => {
    // Sem classificação válida ou sem identificação de mensagem inbound,
    // o node não publica nem audita. Triagem interna (legacy) cai aqui.
    if (state.classification === null) return {};
    if (
      state.conversationId === null ||
      state.messageId === null ||
      ctx.accountId === null
    ) {
      return {};
    }

    const confidenceScore = CONFIDENCE_SCORE[state.classification.confidence];
    const payload: MessageRoutedPayload = {
      tenantId: ctx.tenantId,
      accountId: ctx.accountId,
      conversationId: state.conversationId,
      messageId: state.messageId,
      destinationDepartment: state.classification.department,
      confidence: confidenceScore,
      reasoning: state.classification.reasoning,
      classifiedBy: ctx.agentId,
    };

    await publishEvent(
      'message.routed',
      `tenant:${ctx.tenantId}`,
      payload,
      ctx.traceId,
    );

    // Audit ESPECÍFICO da decisão de roteamento — separado do `llm.call`
    // gravado no node classify. Permite reconstruir, por mensagem,
    // qual departamento foi escolhido sem inferir do payload da llm.call.
    const metrics = state.llmMetrics;
    await appendAuditLog(ctx.supabase, {
      trace_id: ctx.traceId,
      tenant_id: ctx.tenantId,
      account_id: ctx.accountId,
      actor: `agent:${ctx.agentId}`,
      action: 'message.routed',
      resource: `message:${state.messageId}`,
      prompt_version: promptVersion,
      model: metrics?.modelId ?? null,
      cost_usd: metrics?.costUsd ?? null,
      metadata: {
        destinationDepartment: state.classification.department,
        confidence: confidenceScore,
        confidence_label: state.classification.confidence,
        reasoning: state.classification.reasoning,
        alternatives: state.classification.alternatives ?? [],
        conversationId: state.conversationId,
        latencyMs: metrics?.latencyMs ?? null,
        classifiedBy: ctx.agentId,
      } satisfies Json,
    });

    return { routedEventPublished: true };
  };

  return new StateGraph(RouterAnnotation)
    .addNode('classify', classify)
    .addNode('validate', validate)
    .addNode('publish', publish)
    .addEdge(START, 'classify')
    .addEdge('classify', 'validate')
    .addEdge('validate', 'publish')
    .addEdge('publish', END)
    .compile();
};

export type RouterGraph = ReturnType<typeof buildRouterGraph>;
