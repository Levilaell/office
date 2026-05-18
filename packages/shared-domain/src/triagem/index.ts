import { z } from 'zod';
import type { Json, ServiceRoleClient } from '@office/shared-db';
import { enqueueAgentTask } from '@office/shared-events';
import { getRouterForTenant } from '../agents';
import { recordTaskLifecycle } from '../audit';
import { createTask } from '../tasks';

/**
 * Triagem: ponto de entrada único pra qualquer mensagem externa virar uma
 * task pro agente Roteador classificar.
 *
 * Vive em `shared-domain` (não em apps/web) porque o caller pode ser:
 * - rota Next autenticada (`POST /api/triagem`)
 * - webhook de canal (WhatsApp, e-mail) — Sprint 1.0B
 * - script de backfill / replay
 *
 * O caller fornece o cliente Supabase service-role já configurado e a
 * identidade do ator (`userId` Clerk ou `system:<canal>`). Esta função não
 * resolve auth nem decide contexto — só executa a sequência de domínio.
 */

export const TriagemInputSchema = z.object({
  tenantId: z.string().uuid(),
  /**
   * Identificador do ator. Convenção: `userId` cru do Clerk pra usuários
   * autenticados (a função formata com `user:` no audit), ou string já
   * formatada pra atores não-humanos (ex: `system:webhook-whatsapp`).
   */
  actor: z.string().min(1),
  text: z.string().min(1).max(4000),
  accountId: z.string().uuid().optional(),
});
export type TriagemInput = z.infer<typeof TriagemInputSchema>;

export type TriagemResult = {
  taskId: string;
  traceId: string;
};

const formatActor = (raw: string): string =>
  raw.includes(':') ? raw : `user:${raw}`;

export const enqueueTriagem = async (
  supabase: ServiceRoleClient,
  rawInput: TriagemInput,
): Promise<TriagemResult> => {
  const input = TriagemInputSchema.parse(rawInput);

  const router = await getRouterForTenant(supabase, input.tenantId);
  if (!router) {
    throw new Error(
      `Tenant ${input.tenantId} não tem roteador seedado. Rode pnpm seed:agents ou complete o onboarding.`,
    );
  }

  const traceId = crypto.randomUUID();
  const actor = formatActor(input.actor);
  const accountId = input.accountId ?? null;

  const payload: { [key: string]: Json } = {
    text: input.text,
    agentKey: 'router',
  };
  if (input.accountId) payload.accountId = input.accountId;

  // INSERT único já com assigned_agent_id e status='assigned' — fecha TD-001
  // (antes eram createTask + assignTask em chamadas separadas, com race window
  // mínima e write a mais).
  const task = await createTask(supabase, {
    tenantId: input.tenantId,
    accountId,
    traceId,
    taskType: 'triagem',
    priority: 5,
    payload,
    assignedAgentId: router.id,
  });

  // Audit de DUAS transições lógicas — `created` e `assigned` — mesmo que o
  // INSERT seja um só. A reconstituição do histórico de uma task precisa
  // ver as duas; colapsar perde informação.
  await recordTaskLifecycle(supabase, {
    tenantId: input.tenantId,
    accountId,
    taskId: task.id,
    traceId,
    actor,
    action: 'task.created',
    metadata: {
      taskType: 'triagem',
      agentKey: 'router',
      hasAccount: Boolean(input.accountId),
    },
  });
  await recordTaskLifecycle(supabase, {
    tenantId: input.tenantId,
    accountId,
    taskId: task.id,
    traceId,
    actor,
    action: 'task.assigned',
    metadata: { agentId: router.id, agentKey: 'router' },
  });

  await enqueueAgentTask({
    taskId: task.id,
    tenantId: input.tenantId,
    traceId,
    agentKey: 'router',
  });

  return { taskId: task.id, traceId };
};
