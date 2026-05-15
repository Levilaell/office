import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import {
  closeAgentTasksQueue,
  closeAllRedis,
  createAgentTasksWorker,
  enqueueAgentTask,
  subscribeEvents,
  type EventType,
} from '@office/shared-events';
import {
  createServiceRoleClient,
  createTask,
  recordTaskLifecycle,
  seedDefaultAgentsForTenant,
  getRouterForTenant,
} from '@office/shared-domain';
import {
  initLlmTracing,
  resetAnthropicClient,
  shutdownLlmTracing,
} from '@office/shared-llm';
import { makeAgentTaskHandler } from '../../apps/agent-runtime/src/workers/agent-tasks';

const PG_CONN = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const TENANT_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

const hasKeys =
  !!process.env.ANTHROPIC_API_KEY &&
  !!process.env.LANGFUSE_PUBLIC_KEY &&
  !!process.env.LANGFUSE_SECRET_KEY;

const db = new Client({ connectionString: PG_CONN });

const wipe = async (): Promise<void> => {
  await db.query(`
    TRUNCATE public.approvals,
             public.agent_messages,
             public.agent_runs,
             public.tasks,
             public.agents,
             public.audit_log,
             public.entities,
             public.accounts,
             public.tenant_users,
             public.users,
             public.tenants
    RESTART IDENTITY CASCADE
  `);
};

const insertTenant = async (): Promise<void> => {
  await db.query(
    `INSERT INTO public.tenants (id, clerk_org_id, name) VALUES ($1, 'org_router_e2e', 'Tenant E2E')`,
    [TENANT_ID],
  );
};

const waitForTaskStatus = async (
  taskId: string,
  expected: string,
  timeoutMs = 30000,
): Promise<{ status: string; result: unknown } | null> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { rows } = await db.query<{ status: string; result: unknown }>(
      'SELECT status, result FROM public.tasks WHERE id = $1',
      [taskId],
    );
    const row = rows[0];
    if (row && row.status === expected) return row;
    if (row && (row.status === 'failed' || row.status === 'completed')) return row;
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
};

beforeAll(async () => {
  process.env.REDIS_URL ??= 'redis://localhost:6379';
  await db.connect();
  if (hasKeys) {
    initLlmTracing({
      langfusePublicKey: process.env.LANGFUSE_PUBLIC_KEY ?? '',
      langfuseSecretKey: process.env.LANGFUSE_SECRET_KEY ?? '',
      langfuseHost: process.env.LANGFUSE_HOST ?? 'https://cloud.langfuse.com',
      serviceName: 'office-tests',
    });
    resetAnthropicClient();
  }
});

afterAll(async () => {
  await closeAgentTasksQueue().catch(() => undefined);
  await closeAllRedis().catch(() => undefined);
  await db.end();
  if (hasKeys) await shutdownLlmTracing();
});

beforeEach(async () => {
  await db.query('RESET ROLE');
  await wipe();
});

describe.skipIf(!hasKeys)('router e2e — kernel ponta a ponta', () => {
  it(
    'enfileira triagem → worker processa → classifica em fiscal → audit completo',
    async () => {
      await insertTenant();

      const supabaseUrl =
        process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
      const serviceRoleKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
      const supabase = createServiceRoleClient({
        url: supabaseUrl,
        serviceRoleKey,
      });

      await seedDefaultAgentsForTenant(supabase, TENANT_ID);
      const router = await getRouterForTenant(supabase, TENANT_ID);
      expect(router).not.toBeNull();
      expect(router?.agent_key).toBe('router');
      expect(router?.tier).toBe('triage');

      const traceId = crypto.randomUUID();
      const task = await createTask(supabase, {
        tenantId: TENANT_ID,
        traceId,
        taskType: 'triagem',
        priority: 5,
        payload: {
          text: 'Recebi um boleto de ICMS pra pagar, qual o vencimento?',
          agentKey: 'router',
        },
      });

      await recordTaskLifecycle(supabase, {
        tenantId: TENANT_ID,
        taskId: task.id,
        traceId,
        actor: 'system',
        action: 'task.created',
        metadata: { taskType: 'triagem', agentKey: 'router' },
      });

      // Subscriber paralelo escuta tudo do tenant durante a execução.
      const received: Array<{ channel: string; type: EventType }> = [];
      const sub = subscribeEvents('tenant:*', async (channel, type) => {
        received.push({ channel, type });
      });
      await new Promise((r) => setTimeout(r, 100));

      const handler = makeAgentTaskHandler({
        supabaseUrl,
        supabaseServiceRoleKey: serviceRoleKey,
      });
      const worker = createAgentTasksWorker(handler, { concurrency: 1 });
      await worker.waitUntilReady();

      try {
        await enqueueAgentTask({
          taskId: task.id,
          tenantId: TENANT_ID,
          traceId,
          agentKey: 'router',
        });

        const final = await waitForTaskStatus(task.id, 'completed', 60000);
        expect(final).not.toBeNull();
        expect(final?.status).toBe('completed');

        const result = final?.result as
          | { department?: string; confidence?: string; reasoning?: string }
          | null;
        expect(result).toBeTruthy();
        expect(result?.department).toBe('fiscal');
        expect(result?.confidence).toMatch(/^(high|medium|low)$/);
        expect((result?.reasoning ?? '').length).toBeGreaterThan(0);

        // log do payload pra a tarefa pedir
        // eslint-disable-next-line no-console
        console.log(
          `[router-e2e] traceId=${traceId} department=${result?.department} confidence=${result?.confidence} reasoning="${result?.reasoning}"`,
        );

        const { rows: runRows } = await db.query<{
          id: string;
          status: string;
          tokens_used: number;
          cost_usd: string;
        }>(
          'SELECT id, status, tokens_used, cost_usd FROM public.agent_runs WHERE task_id = $1',
          [task.id],
        );
        expect(runRows).toHaveLength(1);
        expect(runRows[0]?.status).toBe('completed');
        expect(runRows[0]?.tokens_used ?? 0).toBeGreaterThan(0);
        expect(Number(runRows[0]?.cost_usd ?? 0)).toBeGreaterThan(0);

        const { rows: msgRows } = await db.query<{ role: string }>(
          'SELECT role FROM public.agent_messages WHERE run_id = $1 ORDER BY turn_index ASC',
          [runRows[0]?.id],
        );
        expect(msgRows.length).toBeGreaterThanOrEqual(2);
        const roles = msgRows.map((r) => r.role);
        expect(roles).toContain('system');
        expect(roles).toContain('assistant');

        const { rows: auditRows } = await db.query<{ action: string; trace_id: string }>(
          'SELECT action, trace_id FROM public.audit_log WHERE trace_id = $1 ORDER BY created_at ASC',
          [traceId],
        );
        const actions = auditRows.map((r) => r.action);
        expect(actions).toContain('task.created');
        expect(actions).toContain('task.completed');
        expect(actions).toContain('llm.call');
        for (const row of auditRows) {
          expect(row.trace_id).toBe(traceId);
        }

        // Espera processar eventos pub/sub residuais.
        await new Promise((r) => setTimeout(r, 250));
        const channels = new Set(received.map((r) => r.channel));
        const types = new Set(received.map((r) => r.type));
        expect(channels.has(`tenant:${TENANT_ID}`)).toBe(true);
        expect(types.has('agent.state_changed')).toBe(true);
        expect(types.has('task.completed')).toBe(true);
      } finally {
        await worker.close();
        await sub.stop();
      }
    },
    90000,
  );
});
