// =============================================================================
// Sprint Fase 2-prep — Suite RLS pras tabelas adicionadas na Fase 1.
//
// Cobre TD-032. Tabelas: conversations, messages, conversation_classifications,
// channel_sessions, obligations, documents, message_drafts, leads.
//
// Pra cada tabela, três testes obrigatórios:
//
//   1. SELECT — tenant A vê só os próprios registros (RLS de leitura)
//   2. INSERT — tenant A inserindo com tenant_id do tenant B → row-level security
//   3. UPDATE — tenant A tentando UPDATE em registro do tenant B → 0 rows
//
// Exceção: `conversation_classifications` é INSERT-only (REVOKE UPDATE/DELETE
// pro role authenticated). O teste #3 valida `permission denied`.
//
// Modelo de execução idêntico ao `tests/integration/rls.test.ts` — pg local
// (Supabase Docker), seed inserido como superuser, queries de teste rodam
// com `SET LOCAL ROLE authenticated` + claims JWT do Clerk.
// =============================================================================

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client } from 'pg';

const CONN = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const USER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const ACCT_A = '33333333-3333-3333-3333-333333333333';
const ACCT_B = '44444444-4444-4444-4444-444444444444';
const AGENT_A = '55555555-5555-5555-5555-555555555555';
const AGENT_B = '66666666-6666-6666-6666-666666666666';
const CONV_A = '77777777-7777-7777-7777-777777777777';
const CONV_B = '88888888-8888-8888-8888-888888888888';
const MSG_A = '99999999-9999-9999-9999-999999999999';
const MSG_B = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const claimsForUser = (orgId: string, sub: string): string =>
  JSON.stringify({ sub, role: 'authenticated', o: { id: orgId, rol: 'admin' } });

const db = new Client({ connectionString: CONN });

const seed = async (): Promise<void> => {
  await db.query(`
    TRUNCATE public.leads,
             public.message_drafts,
             public.conversation_classifications,
             public.documents,
             public.obligations,
             public.channel_sessions,
             public.messages,
             public.conversations,
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
    [TENANT_A, TENANT_B],
  );
  await db.query(
    `INSERT INTO public.users (id, clerk_user_id, email) VALUES
       ($1, 'user_a', 'a@example.com'),
       ($2, 'user_b', 'b@example.com')`,
    [USER_A, USER_B],
  );
  await db.query(
    `INSERT INTO public.tenant_users (tenant_id, user_id, role) VALUES
       ($1, $3, 'owner_tenant'),
       ($2, $4, 'owner_tenant')`,
    [TENANT_A, TENANT_B, USER_A, USER_B],
  );
  await db.query(
    `INSERT INTO public.accounts (id, tenant_id, cnpj, razao_social) VALUES
       ($1, $3, '00.000.000/0001-01', 'ACME A LTDA'),
       ($2, $4, '00.000.000/0001-02', 'ACME B LTDA')`,
    [ACCT_A, ACCT_B, TENANT_A, TENANT_B],
  );
  await db.query(
    `INSERT INTO public.agents (id, tenant_id, agent_key, role, department, name, description, tier, autonomy_tier, budget, tools)
     VALUES
       ($1, $3, 'router', 'router', 'platform', 'Roteador A', '...', 'triage', 'autonomo', '{}'::jsonb, '[]'::jsonb),
       ($2, $4, 'router', 'router', 'platform', 'Roteador B', '...', 'triage', 'autonomo', '{}'::jsonb, '[]'::jsonb)`,
    [AGENT_A, AGENT_B, TENANT_A, TENANT_B],
  );
  await db.query(
    `INSERT INTO public.conversations (id, tenant_id, account_id, channel, channel_handle)
     VALUES
       ($1, $3, $5, 'simulated_webhook', 'a@cli.example.com'),
       ($2, $4, $6, 'simulated_webhook', 'b@cli.example.com')`,
    [CONV_A, CONV_B, TENANT_A, TENANT_B, ACCT_A, ACCT_B],
  );
  await db.query(
    `INSERT INTO public.messages (id, tenant_id, account_id, conversation_id, direction, sender_type, content)
     VALUES
       ($1, $3, $5, $7, 'inbound', 'end_client', 'Olá A'),
       ($2, $4, $6, $8, 'inbound', 'end_client', 'Olá B')`,
    [MSG_A, MSG_B, TENANT_A, TENANT_B, ACCT_A, ACCT_B, CONV_A, CONV_B],
  );
  await db.query(
    `INSERT INTO public.channel_sessions (tenant_id, channel, status, identifier)
     VALUES
       ($1, 'email_imap', 'disconnected', 'a@example.com'),
       ($2, 'email_imap', 'disconnected', 'b@example.com')`,
    [TENANT_A, TENANT_B],
  );
  await db.query(
    `INSERT INTO public.obligations (tenant_id, account_id, type, category, competencia, due_date)
     VALUES
       ($1, $3, 'DAS', 'fiscal_federal',  '2026-04', '2026-05-20'),
       ($2, $4, 'DAS', 'fiscal_federal',  '2026-04', '2026-05-20')`,
    [TENANT_A, TENANT_B, ACCT_A, ACCT_B],
  );
  await db.query(
    `INSERT INTO public.documents (tenant_id, account_id, type, category, status)
     VALUES
       ($1, $3, 'comprovante_pagamento', 'fiscal_federal', 'pending'),
       ($2, $4, 'comprovante_pagamento', 'fiscal_federal', 'pending')`,
    [TENANT_A, TENANT_B, ACCT_A, ACCT_B],
  );
  await db.query(
    `INSERT INTO public.message_drafts (tenant_id, conversation_id, agent_id, proposed_content, status)
     VALUES
       ($1, $3, $5, 'Boa tarde A', 'pending'),
       ($2, $4, $6, 'Boa tarde B', 'pending')`,
    [TENANT_A, TENANT_B, CONV_A, CONV_B, AGENT_A, AGENT_B],
  );
  await db.query(
    `INSERT INTO public.conversation_classifications
       (tenant_id, conversation_id, message_id, agent_id, intent, decision)
     VALUES
       ($1, $3, $5, $7, 'social.saudacao', 'respond_direct'),
       ($2, $4, $6, $8, 'social.saudacao', 'respond_direct')`,
    [TENANT_A, TENANT_B, CONV_A, CONV_B, MSG_A, MSG_B, AGENT_A, AGENT_B],
  );
  await db.query(
    `INSERT INTO public.leads (tenant_id, primary_conversation_id, source, status)
     VALUES
       ($1, $3, 'simulated_webhook', 'new'),
       ($2, $4, 'simulated_webhook', 'new')`,
    [TENANT_A, TENANT_B, CONV_A, CONV_B],
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

const AS_A = claimsForUser('org_a', 'user_a');
const AS_B = claimsForUser('org_b', 'user_b');

// -----------------------------------------------------------------------------
// conversations
// -----------------------------------------------------------------------------
describe('RLS — conversations', () => {
  it('tenant A só vê própria conversation', async () => {
    const ids = await withClaims(AS_A, async (c) => {
      const { rows } = await c.query<{ id: string }>('SELECT id FROM public.conversations');
      return rows.map((r) => r.id);
    });
    expect(ids).toEqual([CONV_A]);
  });

  it('tenant A não consegue INSERT em conversation do tenant B', async () => {
    await expect(
      withClaims(AS_A, (c) =>
        c.query(
          `INSERT INTO public.conversations (tenant_id, account_id, channel, channel_handle)
           VALUES ($1, $2, 'simulated_webhook', 'evil')`,
          [TENANT_B, ACCT_B],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('tenant A UPDATE em conversation do tenant B → 0 rows', async () => {
    const affected = await withClaims(AS_A, async (c) => {
      const res = await c.query(
        `UPDATE public.conversations SET subject = 'tampered' WHERE id = $1`,
        [CONV_B],
      );
      return res.rowCount ?? 0;
    });
    expect(affected).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// messages
// -----------------------------------------------------------------------------
describe('RLS — messages', () => {
  it('tenant A só vê próprias messages', async () => {
    const ids = await withClaims(AS_A, async (c) => {
      const { rows } = await c.query<{ id: string }>('SELECT id FROM public.messages');
      return rows.map((r) => r.id);
    });
    expect(ids).toEqual([MSG_A]);
  });

  it('tenant A não consegue INSERT em message do tenant B', async () => {
    await expect(
      withClaims(AS_A, (c) =>
        c.query(
          `INSERT INTO public.messages (tenant_id, account_id, conversation_id, direction, sender_type, content)
           VALUES ($1, $2, $3, 'inbound', 'end_client', 'evil')`,
          [TENANT_B, ACCT_B, CONV_B],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('tenant A UPDATE em message do tenant B → 0 rows', async () => {
    const affected = await withClaims(AS_A, async (c) => {
      const res = await c.query(
        `UPDATE public.messages SET content = 'tampered' WHERE id = $1`,
        [MSG_B],
      );
      return res.rowCount ?? 0;
    });
    expect(affected).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// channel_sessions
// -----------------------------------------------------------------------------
describe('RLS — channel_sessions', () => {
  it('tenant B só vê própria session', async () => {
    const identifiers = await withClaims(AS_B, async (c) => {
      const { rows } = await c.query<{ identifier: string }>(
        'SELECT identifier FROM public.channel_sessions',
      );
      return rows.map((r) => r.identifier);
    });
    expect(identifiers).toEqual(['b@example.com']);
  });

  it('tenant A não consegue INSERT session com tenant_id do B', async () => {
    await expect(
      withClaims(AS_A, (c) =>
        c.query(
          `INSERT INTO public.channel_sessions (tenant_id, channel, status, identifier)
           VALUES ($1, 'email_imap', 'connected', 'hack@evil.com')`,
          [TENANT_B],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('tenant A UPDATE em session do tenant B → 0 rows', async () => {
    const affected = await withClaims(AS_A, async (c) => {
      const res = await c.query(
        `UPDATE public.channel_sessions SET status = 'connected' WHERE tenant_id = $1`,
        [TENANT_B],
      );
      return res.rowCount ?? 0;
    });
    expect(affected).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// obligations
// -----------------------------------------------------------------------------
describe('RLS — obligations', () => {
  it('tenant A só vê próprias obligations', async () => {
    const tenants = await withClaims(AS_A, async (c) => {
      const { rows } = await c.query<{ tenant_id: string }>(
        'SELECT tenant_id FROM public.obligations',
      );
      return rows.map((r) => r.tenant_id);
    });
    expect(tenants).toEqual([TENANT_A]);
  });

  it('tenant A não consegue INSERT obligation com tenant_id do B', async () => {
    await expect(
      withClaims(AS_A, (c) =>
        c.query(
          `INSERT INTO public.obligations (tenant_id, account_id, type, category, competencia, due_date)
           VALUES ($1, $2, 'DAS', 'fiscal_federal', '2026-04', '2026-05-20')`,
          [TENANT_B, ACCT_B],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('tenant A UPDATE em obligation do tenant B → 0 rows', async () => {
    const affected = await withClaims(AS_A, async (c) => {
      const res = await c.query(
        `UPDATE public.obligations SET status = 'paid' WHERE tenant_id = $1`,
        [TENANT_B],
      );
      return res.rowCount ?? 0;
    });
    expect(affected).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// documents
// -----------------------------------------------------------------------------
describe('RLS — documents', () => {
  it('tenant B só vê próprios documents', async () => {
    const tenants = await withClaims(AS_B, async (c) => {
      const { rows } = await c.query<{ tenant_id: string }>(
        'SELECT tenant_id FROM public.documents',
      );
      return rows.map((r) => r.tenant_id);
    });
    expect(tenants).toEqual([TENANT_B]);
  });

  it('tenant B não consegue INSERT document com tenant_id do A', async () => {
    await expect(
      withClaims(AS_B, (c) =>
        c.query(
          `INSERT INTO public.documents (tenant_id, account_id, type, category, status)
           VALUES ($1, $2, 'comprovante_pagamento', 'fiscal_federal', 'pending')`,
          [TENANT_A, ACCT_A],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('tenant B UPDATE em document do tenant A → 0 rows', async () => {
    const affected = await withClaims(AS_B, async (c) => {
      const res = await c.query(
        `UPDATE public.documents SET status = 'received' WHERE tenant_id = $1`,
        [TENANT_A],
      );
      return res.rowCount ?? 0;
    });
    expect(affected).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// message_drafts
// -----------------------------------------------------------------------------
describe('RLS — message_drafts', () => {
  it('tenant A só vê próprios drafts', async () => {
    const contents = await withClaims(AS_A, async (c) => {
      const { rows } = await c.query<{ proposed_content: string }>(
        'SELECT proposed_content FROM public.message_drafts',
      );
      return rows.map((r) => r.proposed_content);
    });
    expect(contents).toEqual(['Boa tarde A']);
  });

  it('tenant A não consegue INSERT draft com tenant_id do B', async () => {
    await expect(
      withClaims(AS_A, (c) =>
        c.query(
          `INSERT INTO public.message_drafts (tenant_id, conversation_id, agent_id, proposed_content, status)
           VALUES ($1, $2, $3, 'evil', 'pending')`,
          [TENANT_B, CONV_B, AGENT_B],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('tenant A UPDATE em draft do tenant B → 0 rows', async () => {
    const affected = await withClaims(AS_A, async (c) => {
      const res = await c.query(
        `UPDATE public.message_drafts SET status = 'approved' WHERE tenant_id = $1`,
        [TENANT_B],
      );
      return res.rowCount ?? 0;
    });
    expect(affected).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// leads
// -----------------------------------------------------------------------------
describe('RLS — leads', () => {
  it('tenant A só vê próprios leads', async () => {
    const tenants = await withClaims(AS_A, async (c) => {
      const { rows } = await c.query<{ tenant_id: string }>(
        'SELECT tenant_id FROM public.leads',
      );
      return rows.map((r) => r.tenant_id);
    });
    expect(tenants).toEqual([TENANT_A]);
  });

  it('tenant A não consegue INSERT lead com tenant_id do B', async () => {
    await expect(
      withClaims(AS_A, (c) =>
        c.query(
          `INSERT INTO public.leads (tenant_id, source, status)
           VALUES ($1, 'simulated_webhook', 'new')`,
          [TENANT_B],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('tenant A UPDATE em lead do tenant B → 0 rows', async () => {
    const affected = await withClaims(AS_A, async (c) => {
      const res = await c.query(
        `UPDATE public.leads SET status = 'qualified' WHERE tenant_id = $1`,
        [TENANT_B],
      );
      return res.rowCount ?? 0;
    });
    expect(affected).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// conversation_classifications — INSERT-only
//
// Modelo difere: REVOKE UPDATE/DELETE pro authenticated, então UPDATE em
// qualquer registro (próprio ou alheio) bate em permission denied.
// -----------------------------------------------------------------------------
describe('RLS — conversation_classifications (INSERT-only)', () => {
  it('tenant B só vê próprias classifications', async () => {
    const tenants = await withClaims(AS_B, async (c) => {
      const { rows } = await c.query<{ tenant_id: string }>(
        'SELECT tenant_id FROM public.conversation_classifications',
      );
      return rows.map((r) => r.tenant_id);
    });
    expect(tenants).toEqual([TENANT_B]);
  });

  it('tenant A não consegue INSERT classification com tenant_id do B', async () => {
    await expect(
      withClaims(AS_A, (c) =>
        c.query(
          `INSERT INTO public.conversation_classifications
             (tenant_id, conversation_id, agent_id, intent, decision)
           VALUES ($1, $2, $3, 'social.saudacao', 'respond_direct')`,
          [TENANT_B, CONV_B, AGENT_B],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('authenticated NÃO pode UPDATE em conversation_classifications (REVOKE)', async () => {
    await expect(
      withClaims(AS_A, (c) =>
        c.query(
          `UPDATE public.conversation_classifications SET intent = 'tampered' WHERE tenant_id = $1`,
          [TENANT_A],
        ),
      ),
    ).rejects.toThrow(/permission denied/i);
  });
});
