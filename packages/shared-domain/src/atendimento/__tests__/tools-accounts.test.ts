// =============================================================================
// Testes da tool getAccountSnapshot
// =============================================================================

import { describe, it, expect } from 'vitest';
import { getAccountSnapshot } from '../tools/accounts';
import { FakeSupabase } from '../../conversations/__tests__/fake-supabase';

const TENANT = '11111111-1111-1111-1111-111111111111';
const ACCOUNT = 'aaaa1111-1111-1111-1111-111111111111';
const ENTITY_MATRIZ = 'eeee1111-1111-1111-1111-111111111111';
const ENTITY_FILIAL = 'eeee2222-2222-2222-2222-222222222222';

const baseCtx = {
  tenantId: TENANT,
  accountId: ACCOUNT,
  actor: 'agent:specialist',
  traceId: 'trace-1',
};

const makeFake = (): FakeSupabase => {
  const fake = new FakeSupabase();
  fake.tables.accounts = [
    {
      id: ACCOUNT,
      tenant_id: TENANT,
      cnpj: '12.345.678/0001-90',
      razao_social: 'Padaria Teste LTDA',
      nome_fantasia: 'Padaria Boa',
      regime_tributario: 'simples_nacional',
      status: 'active',
    },
  ];
  fake.tables.entities = [
    {
      id: ENTITY_MATRIZ,
      tenant_id: TENANT,
      account_id: ACCOUNT,
      type: 'matriz',
      inscricao_estadual: 'IE-MATRIZ',
      inscricao_municipal: 'IM-MATRIZ',
    },
    {
      id: ENTITY_FILIAL,
      tenant_id: TENANT,
      account_id: ACCOUNT,
      type: 'filial',
      inscricao_estadual: null,
      inscricao_municipal: 'IM-FILIAL',
    },
  ];
  return fake;
};

describe('getAccountSnapshot', () => {
  it('retorna snapshot com entities', async () => {
    const fake = makeFake();
    const result = await getAccountSnapshot(fake as never, baseCtx);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.snapshot.cnpj).toBe('12.345.678/0001-90');
    expect(result.snapshot.regimeTributario).toBe('simples_nacional');
    expect(result.snapshot.entities).toHaveLength(2);
    expect(result.snapshot.entities.map((e) => e.type)).toContain('matriz');
    expect(result.snapshot.entities.map((e) => e.type)).toContain('filial');
  });

  it('grava audit_log com action tool.read.account_snapshot', async () => {
    const fake = makeFake();
    await getAccountSnapshot(fake as never, baseCtx);
    const auditRows = fake.tables.audit_log;
    expect(auditRows.length).toBeGreaterThan(0);
    const audit = auditRows.find(
      (r) => (r.action as string) === 'tool.read.account_snapshot',
    );
    expect(audit).toBeDefined();
    expect(audit?.resource).toBe(`account:${ACCOUNT}`);
    expect(audit?.tenant_id).toBe(TENANT);
  });

  it('retorna not_found quando account inexistente', async () => {
    const fake = makeFake();
    const result = await getAccountSnapshot(fake as never, {
      ...baseCtx,
      accountId: '99999999-9999-9999-9999-999999999999',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });

  it('retorna tenant_mismatch quando account é de outro tenant', async () => {
    const fake = makeFake();
    const result = await getAccountSnapshot(fake as never, {
      ...baseCtx,
      tenantId: '22222222-2222-2222-2222-222222222222',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('tenant_mismatch');
  });
});
