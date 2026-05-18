import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import {
  appendLlmAuditLog,
  incrementRunUsage,
  type Json,
} from '@office/shared-domain';
import { llmCall } from '@office/shared-llm';
import { routerPrompt } from '@office/shared-prompts';
import { z } from 'zod';
import type { AgentContext } from '../types.js';

export const DEPARTMENTS = [
  'atendimento',
  'societario',
  'pessoal',
  'contabil',
  'fiscal',
  'financeiro_interno',
] as const;
export type RouterDepartment = (typeof DEPARTMENTS)[number];

// Schema externo usado pra validar a saída do LLM. Mantemos fora do graph
// porque os reducers do LangGraph trabalham com Annotation, não com Zod direto.
export const ROUTER_DECISION_SCHEMA = z.object({
  department: z.enum(DEPARTMENTS),
  confidence: z.enum(['high', 'medium', 'low']),
  reasoning: z.string().min(1),
  alternatives: z.array(z.enum(DEPARTMENTS)).optional(),
});
export type RouterDecision = z.infer<typeof ROUTER_DECISION_SCHEMA>;

const RouterAnnotation = Annotation.Root({
  text: Annotation<string>(),
  accountId: Annotation<string | null>(),
  classificationRaw: Annotation<string>(),
  classification: Annotation<RouterDecision | null>(),
  validationError: Annotation<string | null>(),
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
 * Constrói o graph minimal do roteador. Dois nós:
 *
 *  classify: chama LLM (tier=triage / Haiku) com o prompt versionado, persiste
 *            a resposta crua em `classificationRaw` e registra:
 *            - mensagem `system` (prompt renderizado)
 *            - mensagem `user` (texto da mensagem a classificar)
 *            - mensagem `assistant` (resposta do modelo + custo + modelo)
 *            - audit_log via appendLlmAuditLog
 *
 *  validate: parseia + valida Zod. Sucesso → classification preenchido.
 *            Falha → validationError preenchido (sem throw — quem invoca
 *            decide o que fazer; o handler do agente falha o run).
 */
export const buildRouterGraph = (ctx: AgentContext) => {
  const promptText = routerPrompt.render({});

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
        promptVersion: `${routerPrompt.id}@${routerPrompt.version}`,
      },
      budget: { maxTokens: 1500, maxCostUsd: 0.02 },
    });

    // Acumula turns/tokens/custo IMEDIATAMENTE após o llmCall — billable,
    // tem que ser registrado mesmo se audit ou recordMessage falharem em
    // seguida. Substitui o scan post-mortem de agent_messages que o worker
    // fazia antes (TD-002): aquele padrão quebrava em multi-call e dependia
    // do shape exato do JSON em `content`.
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
      promptVersion: `${routerPrompt.id}@${routerPrompt.version}`,
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

    return { classificationRaw: out.text };
  };

  const validate = (state: RouterGraphState): Partial<RouterGraphUpdate> => {
    const result = tryParseDecision(state.classificationRaw);
    if (!result.ok) {
      return { validationError: result.error };
    }
    return { classification: result.value };
  };

  return new StateGraph(RouterAnnotation)
    .addNode('classify', classify)
    .addNode('validate', validate)
    .addEdge(START, 'classify')
    .addEdge('classify', 'validate')
    .addEdge('validate', END)
    .compile();
};

export type RouterGraph = ReturnType<typeof buildRouterGraph>;
