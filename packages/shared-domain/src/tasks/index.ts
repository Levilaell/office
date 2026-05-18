import type {
  AuthenticatedClient,
  Database,
  Json,
  ServiceRoleClient,
} from '@office/shared-db';
import type { TaskStatus } from '@office/shared-types';

export type Task = Database['public']['Tables']['tasks']['Row'];
export type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
export type TaskUpdate = Database['public']['Tables']['tasks']['Update'];

type AnyClient = AuthenticatedClient | ServiceRoleClient;

export type CreateTaskInput = {
  tenantId: string;
  accountId?: string | null;
  traceId: string;
  taskType: string;
  priority?: number;
  payload?: Json;
  parentTaskId?: string | null;
  dueAt?: string | null;
  /**
   * Opcional: pré-atribui a task a um agente no mesmo INSERT, mudando o
   * status pra `assigned`. Evita o ciclo create→update do TD-001 quando
   * o caller já sabe a quem despachar (ex: triagem sempre vai pro router).
   */
  assignedAgentId?: string | null;
};

export const createTask = async (
  supabase: AnyClient,
  input: CreateTaskInput,
): Promise<Task> => {
  const insert: TaskInsert = {
    tenant_id: input.tenantId,
    account_id: input.accountId ?? null,
    trace_id: input.traceId,
    task_type: input.taskType,
    ...(input.priority !== undefined && { priority: input.priority }),
    ...(input.payload !== undefined && { payload: input.payload }),
    parent_task_id: input.parentTaskId ?? null,
    due_at: input.dueAt ?? null,
    ...(input.assignedAgentId !== undefined &&
      input.assignedAgentId !== null && {
        assigned_agent_id: input.assignedAgentId,
        status: 'assigned',
      }),
  };
  const { data, error } = await supabase.from('tasks').insert(insert).select().single();
  if (error) throw error;
  return data;
};

export const getTaskById = async (
  supabase: AnyClient,
  taskId: string,
): Promise<Task | null> => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const updateTaskStatus = async (
  supabase: AnyClient,
  taskId: string,
  status: TaskStatus,
  result?: Json | null,
): Promise<Task | null> => {
  const patch: TaskUpdate = { status };
  if (status === 'in_progress') patch.started_at = new Date().toISOString();
  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    patch.completed_at = new Date().toISOString();
  }
  if (result !== undefined) patch.result = result;
  const { data, error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', taskId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const assignTask = async (
  supabase: AnyClient,
  taskId: string,
  agentId: string,
): Promise<Task | null> => {
  const { data, error } = await supabase
    .from('tasks')
    .update({ assigned_agent_id: agentId, status: 'assigned' })
    .eq('id', taskId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
};

export type ListPendingTasksFilters = {
  tenantId?: string;
  limit?: number;
};

export const listPendingTasks = async (
  supabase: AnyClient,
  filters: ListPendingTasksFilters = {},
): Promise<Task[]> => {
  let query = supabase
    .from('tasks')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });
  if (filters.tenantId) query = query.eq('tenant_id', filters.tenantId);
  if (filters.limit) query = query.limit(filters.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
};
