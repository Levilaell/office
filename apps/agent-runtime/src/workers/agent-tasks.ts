import {
  createServiceRoleClient,
  getTaskById,
  updateTaskStatus,
  type ServiceRoleClient,
} from '@office/shared-domain';
import type { AgentTaskJobPayload } from '@office/shared-events';

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

/**
 * Placeholder de handler. Na Sprint 0.3c o router de agente vai consumir aqui:
 * busca task → resolve agente alvo → cria run → executa LangGraph.
 * Por enquanto, só log + marca task como completed se ela existir.
 */
export const makeAgentTaskHandler = (deps: Deps) =>
  async (payload: AgentTaskJobPayload): Promise<void> => {
    const client = getSupabase(deps);
    const task = await getTaskById(client, payload.taskId);
    if (!task) {
      console.warn(
        `[workers/agent-tasks] task ${payload.taskId} não encontrada (trace=${payload.traceId})`,
      );
      return;
    }
    console.log(
      `[workers/agent-tasks] task received id=${payload.taskId} tenant=${payload.tenantId} trace=${payload.traceId} type=${task.task_type}`,
    );
    await updateTaskStatus(client, payload.taskId, 'completed', {
      placeholder: 'sprint-0.3b',
      traceId: payload.traceId,
    });
  };
