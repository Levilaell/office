import {
  appendRunMessage,
  createRun,
  createServiceRoleClient,
  getAgentByKey,
  getTaskById,
  incrementRunUsage,
  recordTaskLifecycle,
  updateAgentState,
  updateRunStatus,
  updateTaskStatus,
  type Json,
  type ServiceRoleClient,
} from '@office/shared-domain';
import {
  AgentTaskJobPayload,
  publishEvent,
  type TaskCompletedPayload,
  type TaskFailedPayload,
  type TaskStatusChangedPayload,
  type AgentStateChangedPayload,
} from '@office/shared-events';
import { getAgentHandler } from '../agents/registry.js';
import type { AgentContext } from '../agents/types.js';

type Deps = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
};

let supabase: ServiceRoleClient | null = null;
const getSupabase = (deps: Deps): ServiceRoleClient => {
  if (supabase) return supabase;
  supabase = createServiceRoleClient({
    url: deps.supabaseUrl,
    serviceRoleKey: deps.supabaseServiceRoleKey,
  });
  return supabase;
};

type AgentStateValue = 'idle' | 'working' | 'awaiting_approval' | 'error' | 'paused';
type TaskStatusValue =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

const publishAgentState = async (
  tenantId: string,
  agentId: string,
  previousState: AgentStateValue,
  state: AgentStateValue,
  traceId: string,
): Promise<void> => {
  const payload: AgentStateChangedPayload = {
    agentId,
    tenantId,
    previousState,
    state,
  };
  await publishEvent('agent.state_changed', `tenant:${tenantId}`, payload, traceId);
};

const publishTaskStatusChanged = async (
  tenantId: string,
  taskId: string,
  previousStatus: TaskStatusValue,
  status: TaskStatusValue,
  traceId: string,
): Promise<void> => {
  const payload: TaskStatusChangedPayload = {
    taskId,
    tenantId,
    traceId,
    previousStatus,
    status,
  };
  await publishEvent('task.status_changed', `tenant:${tenantId}`, payload, traceId);
};

const publishTaskCompleted = async (
  tenantId: string,
  taskId: string,
  department: string,
  result: unknown,
  traceId: string,
): Promise<void> => {
  const payload: TaskCompletedPayload = {
    taskId,
    tenantId,
    traceId,
    department,
    result,
  };
  await publishEvent('task.completed', `tenant:${tenantId}`, payload, traceId);
};

const publishTaskFailed = async (
  tenantId: string,
  taskId: string,
  department: string,
  error: string,
  traceId: string,
): Promise<void> => {
  const payload: TaskFailedPayload = {
    taskId,
    tenantId,
    traceId,
    department,
    error,
  };
  await publishEvent('task.failed', `tenant:${tenantId}`, payload, traceId);
};

const buildContext = (
  client: ServiceRoleClient,
  args: {
    tenantId: string;
    accountId: string | null;
    taskId: string;
    runId: string;
    traceId: string;
    agentId: string;
    agentKey: string;
  },
): AgentContext => {
  let turn = 0;
  return {
    tenantId: args.tenantId,
    accountId: args.accountId,
    taskId: args.taskId,
    runId: args.runId,
    traceId: args.traceId,
    agentId: args.agentId,
    agentKey: args.agentKey,
    supabase: client,
    recordMessage: async (role, content) => {
      const index = turn;
      turn += 1;
      await appendRunMessage(client, {
        tenantId: args.tenantId,
        runId: args.runId,
        role,
        content,
        turnIndex: index,
      });
    },
  };
};

const extractDepartment = (result: unknown): string => {
  if (
    result !== null &&
    typeof result === 'object' &&
    'department' in (result as Record<string, unknown>)
  ) {
    const d = (result as Record<string, unknown>).department;
    if (typeof d === 'string') return d;
  }
  return 'platform';
};

/**
 * Handler do worker BullMQ pra fila `agent-tasks`.
 *
 * Lifecycle:
 *   pending → in_progress (publica task.status_changed)
 *           ↓
 *      agent.state idle → working (publica agent.state_changed)
 *           ↓
 *      cria agent_run (status=running)
 *           ↓
 *      invoca handler do agente (handler grava agent_messages + audit de llm)
 *           ↓
 *   completed | failed (publica task.completed/failed + status_changed)
 *           ↓
 *      agent.state → idle | error (publica agent.state_changed)
 *
 * Falhas no DURANTE (handler) marcam run como failed e task como failed;
 * falhas no SETUP (task ou agente não encontrado) só logam e retornam,
 * pra não bloquear o worker.
 */
export const makeAgentTaskHandler = (deps: Deps) =>
  async (payload: AgentTaskJobPayload): Promise<void> => {
    const client = getSupabase(deps);
    const parsed = AgentTaskJobPayload.parse(payload);
    const { taskId, tenantId, traceId, agentKey } = parsed;

    const task = await getTaskById(client, taskId);
    if (!task) {
      console.warn(
        `[workers/agent-tasks] task ${taskId} não encontrada (trace=${traceId})`,
      );
      return;
    }
    if (task.tenant_id !== tenantId) {
      // Tenant mismatch é sinal de payload forjado ou bug de quem enfileira.
      // Service role bypassa RLS — temos que validar manualmente.
      console.error(
        `[workers/agent-tasks] tenant mismatch task=${taskId} job.tenantId=${tenantId} task.tenant_id=${task.tenant_id}`,
      );
      return;
    }

    const agent = await getAgentByKey(client, tenantId, agentKey);
    if (!agent) {
      console.error(
        `[workers/agent-tasks] agente ${agentKey} não encontrado pro tenant ${tenantId} (trace=${traceId})`,
      );
      return;
    }

    const previousAgentState = agent.state as AgentStateValue;
    const previousTaskStatus = task.status as TaskStatusValue;

    let run: { id: string } | null = null;

    try {
      await updateTaskStatus(client, taskId, 'in_progress');
      await publishTaskStatusChanged(tenantId, taskId, previousTaskStatus, 'in_progress', traceId);

      await updateAgentState(client, agent.id, 'working');
      await publishAgentState(tenantId, agent.id, previousAgentState, 'working', traceId);

      run = await createRun(client, {
        tenantId,
        agentId: agent.id,
        taskId,
        traceId,
      });

      const ctx = buildContext(client, {
        tenantId,
        accountId: task.account_id,
        taskId,
        runId: run.id,
        traceId,
        agentId: agent.id,
        agentKey,
      });

      const handler = getAgentHandler(agentKey);
      const input = (task.payload as { text?: string; accountId?: string } | null) ?? {};
      const result = await handler(input, ctx);

      const department = extractDepartment(result);

      // Soma tokens/custo acumulados via audit metadata.
      // Pega o que entrou pelo agent_messages (assistant message).
      const { data: usageRows } = await client
        .from('agent_messages')
        .select('content')
        .eq('run_id', run.id)
        .eq('role', 'assistant');
      let totalTokens = 0;
      let totalCost = 0;
      for (const row of usageRows ?? []) {
        const content = row.content as
          | { usage?: { inputTokens?: number; outputTokens?: number }; costUsd?: number }
          | null;
        if (!content) continue;
        const input = content.usage?.inputTokens ?? 0;
        const output = content.usage?.outputTokens ?? 0;
        totalTokens += input + output;
        totalCost += content.costUsd ?? 0;
      }
      if (totalTokens > 0 || totalCost > 0) {
        await incrementRunUsage(client, run.id, 1, totalTokens, totalCost);
      } else {
        await incrementRunUsage(client, run.id, 1, 0, 0);
      }

      await updateRunStatus(client, run.id, 'completed', null);
      await updateTaskStatus(client, taskId, 'completed', result as Json);
      await publishTaskStatusChanged(tenantId, taskId, 'in_progress', 'completed', traceId);
      await publishTaskCompleted(tenantId, taskId, department, result, traceId);

      await updateAgentState(client, agent.id, 'idle');
      await publishAgentState(tenantId, agent.id, 'working', 'idle', traceId);

      await recordTaskLifecycle(client, {
        tenantId,
        accountId: task.account_id,
        taskId,
        traceId,
        actor: `agent:${agent.id}`,
        action: 'task.completed',
        metadata: {
          agentKey,
          department,
          runId: run.id,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[workers/agent-tasks] task=${taskId} agent=${agentKey} trace=${traceId} falhou: ${message}`,
      );

      try {
        if (run) {
          await updateRunStatus(client, run.id, 'failed', message);
        }
        await updateTaskStatus(client, taskId, 'failed', {
          error: message,
          traceId,
        });
        await publishTaskStatusChanged(tenantId, taskId, 'in_progress', 'failed', traceId);
        const department = 'platform';
        await publishTaskFailed(tenantId, taskId, department, message, traceId);

        await updateAgentState(client, agent.id, 'error', { lastError: message });
        await publishAgentState(tenantId, agent.id, 'working', 'error', traceId);

        await recordTaskLifecycle(client, {
          tenantId,
          accountId: task.account_id,
          taskId,
          traceId,
          actor: `agent:${agent.id}`,
          action: 'task.failed',
          metadata: {
            agentKey,
            error: message,
            ...(run && { runId: run.id }),
          },
        });
      } catch (cleanupErr) {
        const m = cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr);
        console.error(`[workers/agent-tasks] cleanup falhou: ${m}`);
      }

      // Sobe pra BullMQ marcar o job como failed e respeitar attempts.
      throw err;
    }
  };
