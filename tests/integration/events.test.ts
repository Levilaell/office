import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import {
  closeAgentTasksQueue,
  closeAllRedis,
  createAgentTasksWorker,
  enqueueAgentTask,
  publishEvent,
  subscribeEvents,
  type EventType,
} from '@office/shared-events';

const PG_CONN = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const TENANT_A_ID = '11111111-1111-1111-1111-111111111111';
const TENANT_B_ID = '22222222-2222-2222-2222-222222222222';
const USER_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_B_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const claimsForUser = (clerkOrgId: string, sub: string): string =>
  JSON.stringify({ sub, role: 'authenticated', o: { id: clerkOrgId, rol: 'admin' } });

const db = new Client({ connectionString: PG_CONN });

const seed = async (): Promise<void> => {
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
  await db.query(
    `INSERT INTO public.tenants (id, clerk_org_id, name) VALUES
       ($1, 'org_a', 'Tenant A'),
       ($2, 'org_b', 'Tenant B')`,
    [TENANT_A_ID, TENANT_B_ID],
  );
  await db.query(
    `INSERT INTO public.users (id, clerk_user_id, email) VALUES
       ($1, 'user_a', 'a@example.com'),
       ($2, 'user_b', 'b@example.com')`,
    [USER_A_ID, USER_B_ID],
  );
  await db.query(
    `INSERT INTO public.tenant_users (tenant_id, user_id, role) VALUES
       ($1, $3, 'owner_tenant'),
       ($2, $4, 'owner_tenant')`,
    [TENANT_A_ID, TENANT_B_ID, USER_A_ID, USER_B_ID],
  );
};

const withClaims = async <T>(
  claims: string,
  fn: (client: Client) => Promise<T>,
): Promise<T> => {
  await db.query('BEGIN');
  await db.query("SET LOCAL ROLE authenticated");
  await db.query(`SET LOCAL request.jwt.claims = '${claims}'`);
  try {
    return await fn(db);
  } finally {
    await db.query('ROLLBACK');
  }
};

const seedAgentForTenant = async (
  tenantId: string,
  agentKey: string,
): Promise<string> => {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO public.agents (tenant_id, department, role, agent_key, name, tier)
     VALUES ($1, 'platform', 'router', $2, 'Router', 'default')
     RETURNING id`,
    [tenantId, agentKey],
  );
  if (!rows[0]) throw new Error('failed to seed agent');
  return rows[0].id;
};

beforeAll(async () => {
  process.env.REDIS_URL ??= 'redis://localhost:6379';
  await db.connect();
});

afterAll(async () => {
  await closeAgentTasksQueue().catch(() => undefined);
  await closeAllRedis().catch(() => undefined);
  await db.end();
});

beforeEach(async () => {
  await db.query('RESET ROLE');
  await seed();
});

// -----------------------------------------------------------------------------
// Redis pub/sub
// -----------------------------------------------------------------------------
describe('event bus — pub/sub', () => {
  it('publica e recebe envelope com payload validado no canal certo', async () => {
    const channel = `tenant:${TENANT_A_ID}`;
    const received: Array<{ channel: string; type: EventType; payload: unknown }> = [];

    const sub = subscribeEvents('tenant:*', async (ch, type, payload) => {
      received.push({ channel: ch, type, payload });
    });
    // dá tempo do psubscribe entrar em efeito
    await new Promise((r) => setTimeout(r, 100));

    await publishEvent('task.created.global', channel, {
      taskId: '99999999-9999-9999-9999-999999999999',
      tenantId: TENANT_A_ID,
      traceId: 'trace-1',
      taskType: 'demo',
      priority: 5,
    });

    // polling curto até receber
    for (let i = 0; i < 50 && received.length === 0; i += 1) {
      await new Promise((r) => setTimeout(r, 50));
    }

    await sub.stop();

    expect(received).toHaveLength(1);
    expect(received[0]?.channel).toBe(channel);
    expect(received[0]?.type).toBe('task.created.global');
    expect(received[0]?.payload).toMatchObject({ tenantId: TENANT_A_ID });
  });
});

// -----------------------------------------------------------------------------
// BullMQ
// -----------------------------------------------------------------------------
describe('event bus — BullMQ', () => {
  it('enqueue + worker processa o job com payload validado', async () => {
    let received:
      | { taskId: string; tenantId: string; traceId: string; agentKey: string }
      | null = null;

    const worker = createAgentTasksWorker(async (payload) => {
      received = payload;
    });
    await worker.waitUntilReady();

    const taskId = '77777777-7777-7777-7777-777777777777';
    const jobId = await enqueueAgentTask({
      taskId,
      tenantId: TENANT_A_ID,
      traceId: 'trace-bull-1',
      agentKey: 'router',
    });
    expect(jobId).toBeTruthy();

    for (let i = 0; i < 50 && !received; i += 1) {
      await new Promise((r) => setTimeout(r, 50));
    }

    await worker.close();

    expect(received).toEqual({
      taskId,
      tenantId: TENANT_A_ID,
      traceId: 'trace-bull-1',
      agentKey: 'router',
    });
  });
});

// -----------------------------------------------------------------------------
// RLS — isolamento entre tenants
// -----------------------------------------------------------------------------
describe('RLS — isolamento das tabelas de agentes', () => {
  beforeEach(async () => {
    await seedAgentForTenant(TENANT_A_ID, 'router-a');
    await seedAgentForTenant(TENANT_B_ID, 'router-b');
  });

  it('user_a vê só agents do tenant A', async () => {
    const keys = await withClaims(claimsForUser('org_a', 'user_a'), async (c) => {
      const { rows } = await c.query<{ agent_key: string }>(
        'SELECT agent_key FROM public.agents ORDER BY agent_key',
      );
      return rows.map((r) => r.agent_key);
    });
    expect(keys).toEqual(['router-a']);
  });

  it('tasks: user_a não enxerga task criada pelo service_role no tenant B', async () => {
    await db.query(
      `INSERT INTO public.tasks (tenant_id, trace_id, task_type) VALUES ($1, 't-iso-b', 'demo')`,
      [TENANT_B_ID],
    );
    const traces = await withClaims(claimsForUser('org_a', 'user_a'), async (c) => {
      const { rows } = await c.query<{ trace_id: string }>(
        "SELECT trace_id FROM public.tasks WHERE trace_id = 't-iso-b'",
      );
      return rows.map((r) => r.trace_id);
    });
    expect(traces).toEqual([]);
  });

  it('agent_runs/agent_messages: tenant A não vê run do tenant B', async () => {
    const { rows: agentBRows } = await db.query<{ id: string }>(
      "SELECT id FROM public.agents WHERE tenant_id = $1",
      [TENANT_B_ID],
    );
    const agentB = agentBRows[0]?.id;
    if (!agentB) throw new Error('agentB missing');
    const { rows: taskRows } = await db.query<{ id: string }>(
      `INSERT INTO public.tasks (tenant_id, trace_id, task_type) VALUES ($1, 't-run-b', 'demo')
       RETURNING id`,
      [TENANT_B_ID],
    );
    const taskB = taskRows[0]?.id;
    if (!taskB) throw new Error('taskB missing');
    await db.query(
      `INSERT INTO public.agent_runs (tenant_id, agent_id, task_id, trace_id)
       VALUES ($1, $2, $3, 't-run-b')`,
      [TENANT_B_ID, agentB, taskB],
    );
    const visible = await withClaims(claimsForUser('org_a', 'user_a'), async (c) => {
      const { rows } = await c.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM public.agent_runs WHERE trace_id = 't-run-b'",
      );
      return rows[0]?.count;
    });
    expect(visible).toBe('0');
  });

  it('approvals: user_a não consegue INSERT em approval do tenant B', async () => {
    const { rows: agentBRows } = await db.query<{ id: string }>(
      "SELECT id FROM public.agents WHERE tenant_id = $1",
      [TENANT_B_ID],
    );
    const agentB = agentBRows[0]?.id;
    if (!agentB) throw new Error('agentB missing');
    const { rows: taskRows } = await db.query<{ id: string }>(
      `INSERT INTO public.tasks (tenant_id, trace_id, task_type) VALUES ($1, 't-app-b', 'demo')
       RETURNING id`,
      [TENANT_B_ID],
    );
    const taskB = taskRows[0]?.id;
    if (!taskB) throw new Error('taskB missing');
    await expect(
      withClaims(claimsForUser('org_a', 'user_a'), (c) =>
        c.query(
          `INSERT INTO public.approvals (tenant_id, task_id, agent_id, trace_id, action_type, proposal)
           VALUES ($1, $2, $3, 't-evil', 'evil.action', '{}'::jsonb)`,
          [TENANT_B_ID, taskB, agentB],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });
});

// -----------------------------------------------------------------------------
// Approval lifecycle
// -----------------------------------------------------------------------------
describe('approvals lifecycle', () => {
  it('cria approval pending → decide approved e registra reviewer', async () => {
    const agentId = await seedAgentForTenant(TENANT_A_ID, 'router-a');
    const { rows: taskRows } = await db.query<{ id: string }>(
      `INSERT INTO public.tasks (tenant_id, trace_id, task_type) VALUES ($1, 't-app', 'demo')
       RETURNING id`,
      [TENANT_A_ID],
    );
    const taskId = taskRows[0]?.id;
    if (!taskId) throw new Error('task missing');

    await db.query(
      `INSERT INTO public.approvals (tenant_id, task_id, agent_id, trace_id, action_type, proposal)
       VALUES ($1, $2, $3, 't-app', 'send.message', '{"text":"oi"}'::jsonb)`,
      [TENANT_A_ID, taskId, agentId],
    );

    const before = await db.query<{ status: string; reviewer_user_id: string | null }>(
      "SELECT status, reviewer_user_id FROM public.approvals WHERE trace_id = 't-app'",
    );
    expect(before.rows[0]?.status).toBe('pending');
    expect(before.rows[0]?.reviewer_user_id).toBeNull();

    await db.query(
      `UPDATE public.approvals
         SET status = 'approved',
             decision = '{"note":"ok"}'::jsonb,
             reviewer_user_id = $1,
             decided_at = now()
       WHERE trace_id = 't-app'`,
      [USER_A_ID],
    );

    const after = await db.query<{ status: string; reviewer_user_id: string }>(
      "SELECT status, reviewer_user_id FROM public.approvals WHERE trace_id = 't-app'",
    );
    expect(after.rows[0]?.status).toBe('approved');
    expect(after.rows[0]?.reviewer_user_id).toBe(USER_A_ID);
  });
});
