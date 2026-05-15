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
 * Soma deltas ao run sem perder concorrência: lê valor atual, soma, escreve.
 * Em alto throughput, trocar por SQL atômico (UPDATE ... SET turns = turns + $1).
 */
export const incrementRunUsage = async (
  supabase: AnyClient,
  runId: string,
  deltaTurns: number,
  deltaTokens: number,
  deltaCostUsd: number,
): Promise<AgentRun | null> => {
  const { data: current, error: readError } = await supabase
    .from('agent_runs')
    .select('turns, tokens_used, cost_usd')
    .eq('id', runId)
    .maybeSingle();
  if (readError) throw readError;
  if (!current) return null;

  const { data, error } = await supabase
    .from('agent_runs')
    .update({
      turns: current.turns + deltaTurns,
      tokens_used: current.tokens_used + deltaTokens,
      cost_usd: Number(current.cost_usd) + deltaCostUsd,
    })
    .eq('id', runId)
    .select()
    .maybeSingle();
  if (error) throw error;
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
