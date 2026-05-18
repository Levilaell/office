import type {
  AuthenticatedClient,
  Database,
  Json,
  ServiceRoleClient,
} from '@office/shared-db';
import type { RunStatus } from '@office/shared-types';

export type AgentRun = Database['public']['Tables']['agent_runs']['Row'];
export type AgentRunInsert = Database['public']['Tables']['agent_runs']['Insert'];

export type AgentMessage = Database['public']['Tables']['agent_messages']['Row'];
export type AgentMessageInsert = Database['public']['Tables']['agent_messages']['Insert'];

type AnyClient = AuthenticatedClient | ServiceRoleClient;

export type CreateRunInput = {
  tenantId: string;
  agentId: string;
  taskId: string;
  traceId: string;
};

export const createRun = async (
  supabase: AnyClient,
  input: CreateRunInput,
): Promise<AgentRun> => {
  const { data, error } = await supabase
    .from('agent_runs')
    .insert({
      tenant_id: input.tenantId,
      agent_id: input.agentId,
      task_id: input.taskId,
      trace_id: input.traceId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateRunStatus = async (
  supabase: AnyClient,
  runId: string,
  status: RunStatus,
  error?: string | null,
): Promise<AgentRun | null> => {
  const patch: Database['public']['Tables']['agent_runs']['Update'] = { status };
  if (status !== 'running') patch.completed_at = new Date().toISOString();
  if (error !== undefined) patch.error_message = error;
  const { data, error: queryError } = await supabase
    .from('agent_runs')
    .update(patch)
    .eq('id', runId)
    .select()
    .maybeSingle();
  if (queryError) throw queryError;
  return data;
};

/**
 * Lançada quando o run referenciado sumiu (cascade delete, race com cleanup).
 * Caller decide se vira fail da task ou se é silenciado — não silenciamos por
 * default porque tokens/custo perdidos viram bug invisível de billing.
 */
export class RunNotFoundError extends Error {
  override readonly name = 'RunNotFoundError';
  constructor(public readonly runId: string) {
    super(`agent_run ${runId} não encontrado`);
  }
}

export type RunUsageDelta = {
  /** Default 1 — uma "turn" = uma chamada de LLM. Pra ações sem LLM, passar 0. */
  turns?: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
};

/**
 * Acumula uso (turns/tokens/custo) num run após CADA chamada de LLM.
 *
 * Read-modify-write não é atômico em multi-writer, mas runs são single-threaded
 * por design (um worker BullMQ processa uma run por vez). Atomicidade real
 * exigiria função Postgres + migration — fora do escopo desta refactor.
 *
 * Semântica de `turns`: número de chamadas de LLM no run, NÃO número de
 * execuções do handler. O budget `agents.budget.maxTurns` (default 10) e a
 * regra de loop detection (`rules/agents-architecture.md`) operam sobre esta
 * contagem.
 */
export const incrementRunUsage = async (
  supabase: AnyClient,
  runId: string,
  delta: RunUsageDelta,
): Promise<AgentRun> => {
  const { data: current, error: readError } = await supabase
    .from('agent_runs')
    .select('turns, tokens_used, cost_usd')
    .eq('id', runId)
    .maybeSingle();
  if (readError) throw readError;
  if (!current) throw new RunNotFoundError(runId);

  const turnsDelta = delta.turns ?? 1;
  const tokensDelta = delta.tokensIn + delta.tokensOut;

  const { data, error } = await supabase
    .from('agent_runs')
    .update({
      turns: current.turns + turnsDelta,
      tokens_used: current.tokens_used + tokensDelta,
      cost_usd: Number(current.cost_usd) + delta.costUsd,
    })
    .eq('id', runId)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new RunNotFoundError(runId);
  return data;
};

export type AppendRunMessageInput = {
  tenantId: string;
  runId: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: Json;
  turnIndex: number;
};

export const appendRunMessage = async (
  supabase: AnyClient,
  input: AppendRunMessageInput,
): Promise<AgentMessage> => {
  const { data, error } = await supabase
    .from('agent_messages')
    .insert({
      tenant_id: input.tenantId,
      run_id: input.runId,
      role: input.role,
      content: input.content,
      turn_index: input.turnIndex,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};
