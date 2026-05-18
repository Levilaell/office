// =============================================================================
// Testes da tool getObligationsForAccount
// =============================================================================

import { describe, it, expect } from 'vitest';
import { getObligationsForAccount } from '../tools/obligations';
import { FakeSupabase } from '../../conversations/__tests__/fake-supabase';

const TENANT = '11111111-1111-1111-1111-111111111111';
const ACCOUNT = 'aaaa1111-1111-1111-1111-111111111111';

const baseCtx = {
  tenantId: TENANT,
  accountId: ACCOUNT,
  actor: 'agent:specialist',
  traceId: 'trace-1',
};

const isoToday = (): string => new Date().toISOString().slice(0, 10);
const isoDaysFromNow = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const makeFake = (): FakeSupabase => {
  const fake = new FakeSupabase();
  fake.tables.obligations = [
    {
      id: 'ob1',
      tenant_id: TENANT,
      account_id: ACCOUNT,
      type: 'das',
      category: 'federal',
      competencia: '2026-10',
      due_date: isoDaysFromNow(10),
      amount: 487.3,
      status: 'pending',
    },
    {
      id: 'ob2',
      tenant_id: TENANT,
      account_id: ACCOUNT,
      type: 'inss',
      category: 'trabalhista',
      competencia: '2026-10',
      due_date: isoDaysFromNow(20),
      amount: 1230.0,
      status: 'pending',
    },
    {
      id: 'ob3',
      tenant_id: TENANT,
      account_id: ACCOUNT,
      type: 'das',
      category: 'federal',
      competencia: '2026-09',
      due_date: isoDaysFromNow(-90), // muito antiga, fora da janela
      amount: 412.0,
      status: 'paid',
    },
    {
      id: 'ob4',
      tenant_id: TENANT,
      account_id: ACCOUNT,
      type: 'dctfweb',
      category: 'federal',
      competencia: '2026-10',
      due_date: isoDaysFromNow(15),
      amount: null,
      status: 'paid', // paid — fora do default
    },
  ];
  return fake;
};

describe('getObligationsForAccount', () => {
  it('retorna apenas pending/overdue no default', async () => {
    const fake = makeFake();
    const result = await getObligationsForAccount(fake as never, baseCtx);
    expect(result.map((o) => o.id).sort()).toEqual(['ob1', 'ob2']);
  });

  it('respeita status custom', async () => {
    const fake = makeFake();
    const result = await getObligationsForAccount(fake as never, baseCtx, {
      status: ['paid'],
    });
    expect(result.map((o) => o.id)).toContain('ob4');
  });

  it('respeita filtro by type', async () => {
    const fake = makeFake();
    const result = await getObligationsForAccount(fake as never, baseCtx, {
      type: 'das',
    });
    expect(result.map((o) => o.id)).toEqual(['ob1']); // só pending DAS na janela
  });

  it('ordena por due_date ASC', async () => {
    const fake = makeFake();
    const result = await getObligationsForAccount(fake as never, baseCtx);
    expect(result[0]?.id).toBe('ob1'); // 10 dias
    expect(result[1]?.id).toBe('ob2'); // 20 dias
  });

  it('grava audit_log com count', async () => {
    const fake = makeFake();
    await getObligationsForAccount(fake as never, baseCtx);
    const audit = fake.tables.audit_log.find(
      (r) => (r.action as string) === 'tool.read.obligations',
    );
    expect(audit).toBeDefined();
    expect((audit?.metadata as { count: number }).count).toBe(2);
  });

  it('lista vazia retorna [] sem erro', async () => {
    const fake = makeFake();
    const result = await getObligationsForAccount(fake as never, baseCtx, {
      from: isoToday(),
      to: isoToday(),
      type: 'icms_inexistente',
    });
    expect(result).toEqual([]);
  });

  it('filtro respeita janela from/to custom', async () => {
    const fake = makeFake();
    // Janela 0..5 dias — só ob1 (10 dias) está fora.
    const result = await getObligationsForAccount(fake as never, baseCtx, {
      from: isoToday(),
      to: isoDaysFromNow(5),
    });
    expect(result).toEqual([]);
  });
});
