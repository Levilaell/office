import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client } from 'pg';

const CONN = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const TENANT_A_ID = '11111111-1111-1111-1111-111111111111';
const TENANT_B_ID = '22222222-2222-2222-2222-222222222222';
const USER_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_B_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const claimsForUser = (clerkOrgId: string, sub: string): string =>
  JSON.stringify({ sub, role: 'authenticated', o: { id: clerkOrgId, rol: 'admin' } });

const db = new Client({ connectionString: CONN });

const seed = async (): Promise<void> => {
  await db.query(`
    TRUNCATE public.audit_log,
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
  await db.query(
    `INSERT INTO public.accounts (tenant_id, cnpj, razao_social) VALUES
       ($1, '00.000.000/0001-01', 'ACME A LTDA'),
       ($2, '00.000.000/0001-02', 'ACME B LTDA')`,
    [TENANT_A_ID, TENANT_B_ID],
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

beforeAll(async () => {
  await db.connect();
});

afterAll(async () => {
  await db.end();
});

beforeEach(async () => {
  await db.query('RESET ROLE');
  await seed();
});

describe('multi-tenant isolation', () => {
  it('user_a só vê accounts do tenant A', async () => {
    const cnpjs = await withClaims(claimsForUser('org_a', 'user_a'), async (c) => {
      const { rows } = await c.query<{ cnpj: string }>('SELECT cnpj FROM public.accounts');
      return rows.map((r) => r.cnpj);
    });
    expect(cnpjs).toEqual(['00.000.000/0001-01']);
  });

  it('user_b só vê accounts do tenant B', async () => {
    const cnpjs = await withClaims(claimsForUser('org_b', 'user_b'), async (c) => {
      const { rows } = await c.query<{ cnpj: string }>('SELECT cnpj FROM public.accounts');
      return rows.map((r) => r.cnpj);
    });
    expect(cnpjs).toEqual(['00.000.000/0001-02']);
  });

  it('user_a só vê o próprio tenant na tabela tenants', async () => {
    const names = await withClaims(claimsForUser('org_a', 'user_a'), async (c) => {
      const { rows } = await c.query<{ name: string }>('SELECT name FROM public.tenants');
      return rows.map((r) => r.name);
    });
    expect(names).toEqual(['Tenant A']);
  });

  it('user_a NÃO consegue INSERT em account de outro tenant', async () => {
    await expect(
      withClaims(claimsForUser('org_a', 'user_a'), (c) =>
        c.query(
          `INSERT INTO public.accounts (tenant_id, cnpj, razao_social)
           VALUES ($1, '99.999.999/0001-99', 'Hacker LTDA')`,
          [TENANT_B_ID],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('current_tenant_id() resolve o tenant do user', async () => {
    const id = await withClaims(claimsForUser('org_a', 'user_a'), async (c) => {
      const { rows } = await c.query<{ id: string }>('SELECT public.current_tenant_id() AS id');
      return rows[0]?.id;
    });
    expect(id).toBe(TENANT_A_ID);
  });
});

describe('audit_log immutability', () => {
  it('aceita INSERT com tenant_id correto', async () => {
    await withClaims(claimsForUser('org_a', 'user_a'), async (c) => {
      await c.query(
        `INSERT INTO public.audit_log (trace_id, tenant_id, actor, action, resource)
         VALUES ('t_ok', $1, 'user:user_a', 'test.create', 'self')`,
        [TENANT_A_ID],
      );
      const { rows } = await c.query<{ trace_id: string }>(
        'SELECT trace_id FROM public.audit_log',
      );
      expect(rows.map((r) => r.trace_id)).toEqual(['t_ok']);
    });
  });

  it('bloqueia INSERT com tenant_id de outro tenant', async () => {
    await expect(
      withClaims(claimsForUser('org_a', 'user_a'), (c) =>
        c.query(
          `INSERT INTO public.audit_log (trace_id, tenant_id, actor, action, resource)
           VALUES ('t_evil', $1, 'user:user_a', 'evil', 'x')`,
          [TENANT_B_ID],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('bloqueia UPDATE pelo role authenticated', async () => {
    await expect(
      withClaims(claimsForUser('org_a', 'user_a'), async (c) => {
        await c.query(
          `INSERT INTO public.audit_log (trace_id, tenant_id, actor, action, resource)
           VALUES ('t_upd', $1, 'user:user_a', 'test.create', 'self')`,
          [TENANT_A_ID],
        );
        return c.query(
          `UPDATE public.audit_log SET action = 'tampered' WHERE trace_id = 't_upd'`,
        );
      }),
    ).rejects.toThrow(/permission denied/i);
  });

  it('bloqueia DELETE pelo role authenticated', async () => {
    await expect(
      withClaims(claimsForUser('org_a', 'user_a'), async (c) => {
        await c.query(
          `INSERT INTO public.audit_log (trace_id, tenant_id, actor, action, resource)
           VALUES ('t_del', $1, 'user:user_a', 'test.create', 'self')`,
          [TENANT_A_ID],
        );
        return c.query(`DELETE FROM public.audit_log WHERE trace_id = 't_del'`);
      }),
    ).rejects.toThrow(/permission denied/i);
  });

  it('user_b não enxerga audit do tenant A', async () => {
    await db.query(
      `INSERT INTO public.audit_log (trace_id, tenant_id, actor, action, resource)
       VALUES ('t_isolated', $1, 'system', 'test', 'self')`,
      [TENANT_A_ID],
    );
    const visible = await withClaims(claimsForUser('org_b', 'user_b'), async (c) => {
      const { rows } = await c.query<{ trace_id: string }>(
        "SELECT trace_id FROM public.audit_log WHERE trace_id = 't_isolated'",
      );
      return rows.length;
    });
    expect(visible).toBe(0);
  });
});
