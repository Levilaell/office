// =============================================================================
// LangGraph do Especialista Operacional.
//
// Nós:
//   1. consult_tools (paralelo lógico: chama tools de obligations + documents)
//   2. generate_response (LLM Sonnet com prompt versionado)
//
// O handler invoca o graph DEPOIS de já ter carregado contexto (conversation,
// account, etc) e validado que account_id existe. Cenários de curto-circuito
// (sem account, dúvida regulatória) NÃO entram no graph — handler escala
// diretamente via act.
//
// Side-effects (criar draft, enviar mensagem, publicar evento) vivem em
// `act.ts`, fora do graph, pelo mesmo motivo do Coordenador.
// =============================================================================

import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import {
  appendLlmAuditLog,
  getDocumentsForAccount,
  getObligationsForAccount,
  incrementRunUsage,
  type DocumentSnapshot,
  type Json,
  type ObligationSnapshot,
} from '@office/shared-domain';
import { llmCall } from '@office/shared-llm';
import { especialistaOperacionalPrompt } from '@office/shared-prompts';
import { z } from 'zod';
import type { AgentContext } from '../../types.js';
import type { EspecialistaOperacionalContext } from './tools/context.js';
import {
  formatAccountSummary,
  formatDocumentsList,
  formatObligationsList,
} from './tools/formatting.js';

// -----------------------------------------------------------------------------
// Schema de saída do LLM. Em paralelo ao spec do Coordenador: rígido, JSON
// estrito. Refinements garantem que `content` exista quando ação requer
// e `escalation_reason` exista quando ação é escalate.
// -----------------------------------------------------------------------------
export const ESPECIALISTA_RESPONSE_SCHEMA = z
  .object({
    action: z.enum(['respond', 'escalate_human', 'request_clarification']),
    content: z.string().min(1).max(2000).optional(),
    template_used: z.string().nullable(),
    data_used: z.array(z.string()).default([]),
    confidence: z.number().min(0).max(1),
    reasoning: z.string().min(1).max(500),
    escalation_reason: z.string().min(1).max(500).optional(),
  })
  .refine(
    (val) => val.action !== 'escalate_human' || !!val.escalation_reason,
    { message: 'escalate_human requer escalation_reason' },
  )
  .refine(
    (val) => val.action === 'escalate_human' || !!val.content,
    { message: 'respond/request_clarification requer content' },
  );

export type EspecialistaResponse = z.infer<typeof ESPECIALISTA_RESPONSE_SCHEMA>;

const stripFences = (raw: string): string => {
  const trimmed = raw.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fence?.[1]?.trim() ?? trimmed;
};

const tryParseResponse = (
  raw: string,
):
  | { ok: true; value: EspecialistaResponse }
  | { ok: false; error: string } => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `JSON inválido: ${message}` };
  }
  const result = ESPECIALISTA_RESPONSE_SCHEMA.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: `schema inválido: ${result.error.message}` };
  }
  return { ok: true, value: result.data };
};

export type LlmMetricsState = {
  modelId: string;
  costUsd: number;
};

const EspecialistaAnnotation = Annotation.Root({
  text: Annotation<string>(),
  historyRendered: Annotation<string>(),
  intent: Annotation<string>(),
  botName: Annotation<string>(),
  // Outputs de consult_tools — sempre populados (vazios se intent não exige).
  obligations: Annotation<ObligationSnapshot[]>({
    default: () => [],
    reducer: (_, next) => next,
  }),
  documents: Annotation<DocumentSnapshot[]>({
    default: () => [],
    reducer: (_, next) => next,
  }),
  // LLM
  responseRaw: Annotation<string>({ default: () => '', reducer: (_, n) => n }),
  responseParsed: Annotation<EspecialistaResponse | null>({
    default: () => null,
    reducer: (_, n) => n,
  }),
  responseError: Annotation<string | null>({
    default: () => null,
    reducer: (_, n) => n,
  }),
  llmMetrics: Annotation<LlmMetricsState | null>({
    default: () => null,
    reducer: (_, n) => n,
  }),
});

export type EspecialistaGraphState = typeof EspecialistaAnnotation.State;
export type EspecialistaGraphUpdate = typeof EspecialistaAnnotation.Update;

// Heurística simples pra evitar chamar todas as tools quando intent é
// específico. Especialista que conhece o catálogo de intents do Coordenador.
const INTENT_REQUIRES_OBLIGATIONS: ReadonlyArray<string> = [
  'operacional.status_obrigacao',
  'operacional.duvida_geral',
];
const INTENT_REQUIRES_DOCUMENTS: ReadonlyArray<string> = [
  'operacional.documento_pendente',
  'operacional.envio_documento',
  'operacional.duvida_geral',
];

export const buildEspecialistaGraph = (
  ctx: AgentContext,
  context: EspecialistaOperacionalContext,
) => {
  const actor = `agent:${ctx.agentId}`;
  // accountId é validado pelo handler antes de invocar o graph. Asserção
  // segura porque graph não roda se accountSnapshot é null.
  const accountId = context.accountSnapshot?.id ?? context.conversation.account_id;

  const consultToolsNode = async (
    state: EspecialistaGraphState,
  ): Promise<Partial<EspecialistaGraphUpdate>> => {
    const intent = state.intent;
    const tasks: Array<Promise<ObligationSnapshot[] | DocumentSnapshot[]>> = [];

    const needsObligations = INTENT_REQUIRES_OBLIGATIONS.includes(intent);
    const needsDocuments = INTENT_REQUIRES_DOCUMENTS.includes(intent);

    if (needsObligations) {
      tasks.push(
        getObligationsForAccount(
          ctx.supabase,
          {
            tenantId: ctx.tenantId,
            accountId,
            actor,
            traceId: ctx.traceId,
          },
        ),
      );
    }
    if (needsDocuments) {
      tasks.push(
        getDocumentsForAccount(ctx.supabase, {
          tenantId: ctx.tenantId,
          accountId,
          actor,
          traceId: ctx.traceId,
        }),
      );
    }

    if (tasks.length === 0) {
      // Intent operacional sem tool conhecida → carrega ambos pra
      // dar ao LLM contexto máximo. Custo é OK (read simples).
      tasks.push(
        getObligationsForAccount(ctx.supabase, {
          tenantId: ctx.tenantId,
          accountId,
          actor,
          traceId: ctx.traceId,
        }),
      );
      tasks.push(
        getDocumentsForAccount(ctx.supabase, {
          tenantId: ctx.tenantId,
          accountId,
          actor,
          traceId: ctx.traceId,
        }),
      );
    }

    const results = await Promise.all(tasks);

    let obligations: ObligationSnapshot[] = [];
    let documents: DocumentSnapshot[] = [];
    if (needsObligations || tasks.length === 2) {
      obligations = results[0] as ObligationSnapshot[];
    }
    if (needsDocuments || tasks.length === 2) {
      const idx = needsObligations ? 1 : 0;
      documents = results[idx] as DocumentSnapshot[];
    }

    return { obligations, documents };
  };

  const generateResponseNode = async (
    state: EspecialistaGraphState,
  ): Promise<Partial<EspecialistaGraphUpdate>> => {
    const prompt = especialistaOperacionalPrompt.render({
      botName: state.botName,
      conversationHistory: state.historyRendered,
      currentMessage: state.text,
      intent: state.intent,
      accountSummary: formatAccountSummary(context.accountSnapshot),
      obligationsList: formatObligationsList(state.obligations),
      documentsList: formatDocumentsList(state.documents),
    });

    await ctx.recordMessage('system', {
      prompt,
      version: especialistaOperacionalPrompt.version,
    });
    await ctx.recordMessage('user', {
      text: state.text,
      intent: state.intent,
    });

    const out = await llmCall({
      tier: especialistaOperacionalPrompt.tier,
      system: prompt,
      messages: [{ role: 'user', content: state.text }],
      maxTokens: 1500,
      temperature: 0,
      metadata: {
        traceId: ctx.traceId,
        tenantId: ctx.tenantId,
        ...(ctx.accountId !== null && { accountId: ctx.accountId }),
        agentId: ctx.agentId,
        promptVersion: `${especialistaOperacionalPrompt.id}@${especialistaOperacionalPrompt.version}`,
      },
      budget: { maxTokens: 1500, maxCostUsd: 0.08 },
    });

    await incrementRunUsage(ctx.supabase, ctx.runId, {
      tokensIn: out.usage.inputTokens,
      tokensOut: out.usage.outputTokens,
      costUsd: out.costUsd,
    });

    await appendLlmAuditLog(ctx.supabase, out, {
      tenantId: ctx.tenantId,
      accountId: ctx.accountId,
      actor,
      action: 'llm.call',
      resource: `conversation:${context.conversation.id}`,
      promptVersion: `${especialistaOperacionalPrompt.id}@${especialistaOperacionalPrompt.version}`,
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
    const parsed = tryParseResponse(out.text);
    if (!parsed.ok) {
      return {
        responseRaw: out.text,
        responseError: parsed.error,
        llmMetrics: metrics,
      };
    }
    return {
      responseRaw: out.text,
      responseParsed: parsed.value,
      llmMetrics: metrics,
    };
  };

  return new StateGraph(EspecialistaAnnotation)
    .addNode('consult_tools', consultToolsNode)
    .addNode('generate_response', generateResponseNode)
    .addEdge(START, 'consult_tools')
    .addEdge('consult_tools', 'generate_response')
    .addEdge('generate_response', END)
    .compile();
};

export type EspecialistaGraph = ReturnType<typeof buildEspecialistaGraph>;
