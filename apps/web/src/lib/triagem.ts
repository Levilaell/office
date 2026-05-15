import 'server-only';
import {
  createTask,
  getRouterForTenant,
  recordTaskLifecycle,
  assignTask,
  type Json,
} from '@office/shared-domain';
import { enqueueAgentTask } from '@office/shared-events';
import { getServiceRoleSupabase } from './supabase';

export type EnqueueTriagemInput = {
  tenantId: string;
  accountId?: string;
  text: string;
  userId: string;
};

export type EnqueueTriagemResult = {
  taskId: string;
  traceId: string;
};

/**
 * Cria uma task de triagem pra o tenant e enfileira o job pro agent-runtime
 * processar via roteador. Retorna {taskId, traceId} pra o caller poder
 * acompanhar o estado via GET /api/tasks/:taskId.
 *
 * Server-only: a função usa service role pra ler/criar rows multi-tenant
 * (RLS já barra cross-tenant em rotas de user, mas a triagem é disparada
 * pela própria rota autenticada — tenantId vem do contexto Clerk validado).
 */
export const enqueueTriagem = async (
  input: EnqueueTriagemInput,
): Promise<EnqueueTriagemResult> => {
  const supabase = getServiceRoleSupabase();
  const traceId = crypto.randomUUID();

  const router = await getRouterForTenant(supabase, input.tenantId);
  if (!router) {
    throw new Error(
      `Tenant ${input.tenantId} não tem roteador seedado. Rode pnpm seed:agents ou complete o onboarding.`,
    );
  }

  const payload: { [key: string]: Json } = {
    text: input.text,
    agentKey: 'router',
  };
  if (input.accountId) payload.accountId = input.accountId;

  const task = await createTask(supabase, {
    tenantId: input.tenantId,
    accountId: input.accountId ?? null,
    traceId,
    taskType: 'triagem',
    priority: 5,
    payload,
  });

  await assignTask(supabase, task.id, router.id);

  await recordTaskLifecycle(supabase, {
    tenantId: input.tenantId,
    accountId: input.accountId ?? null,
    taskId: task.id,
    traceId,
    actor: `user:${input.userId}`,
    action: 'task.created',
    metadata: {
      taskType: 'triagem',
      agentKey: 'router',
      hasAccount: Boolean(input.accountId),
    },
  });

  await enqueueAgentTask({
    taskId: task.id,
    tenantId: input.tenantId,
    traceId,
    agentKey: 'router',
  });

  return { taskId: task.id, traceId };
};
