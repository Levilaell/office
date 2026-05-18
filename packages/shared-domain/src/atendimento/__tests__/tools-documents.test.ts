// =============================================================================
// Testes da tool getDocumentsForAccount
// =============================================================================

import { describe, it, expect } from 'vitest';
import { getDocumentsForAccount } from '../tools/documents';
import { FakeSupabase } from '../../conversations/__tests__/fake-supabase';

const TENANT = '11111111-1111-1111-1111-111111111111';
const ACCOUNT = 'aaaa1111-1111-1111-1111-111111111111';

const baseCtx = {
  tenantId: TENANT,
  accountId: ACCOUNT,
  actor: 'agent:specialist',
  traceId: 'trace-1',
};

const isoDaysFromNow = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const makeFake = (): FakeSupabase => {
  const fake = new FakeSupabase();
  fake.tables.documents = [
    {
      id: 'd1',
      tenant_id: TENANT,
      account_id: ACCOUNT,
      type: 'nf_venda',
      category: 'fiscal',
      reference_date: isoDaysFromNow(-15),
      status: 'received',
    },
    {
      id: 'd2',
      tenant_id: TENANT,
      account_id: ACCOUNT,
      type: 'comprovante_pagamento',
      category: 'financeiro',
      reference_date: isoDaysFromNow(-5),
      status: 'processed',
    },
    {
      id: 'd3',
      tenant_id: TENANT,
      account_id: ACCOUNT,
      type: 'contrato',
      category: 'societario',
      reference_date: null, // sem data
      status: 'received',
    },
  ];
  return fake;
};

describe('getDocumentsForAccount', () => {
  it('sem filtros retorna todos do account (ordenados por reference desc)', async () => {
    const fake = makeFake();
    const result = await getDocumentsForAccount(fake as never, baseCtx);
    expect(result).toHaveLength(3);
    // d2 vem antes (data mais recente). d3 vem depois (null com NULLS LAST).
    expect(result[0]?.id).toBe('d2');
  });

  it('filtra por category', async () => {
    const fake = makeFake();
    const result = await getDocumentsForAccount(fake as never, baseCtx, {
      category: 'fiscal',
    });
    expect(result.map((d) => d.id)).toEqual(['d1']);
  });

  it('filtra por type', async () => {
    const fake = makeFake();
    const result = await getDocumentsForAccount(fake as never, baseCtx, {
      type: 'contrato',
    });
    expect(result.map((d) => d.id)).toEqual(['d3']);
  });

  it('janela explícita exclui docs sem reference_date', async () => {
    const fake = makeFake();
    const result = await getDocumentsForAccount(fake as never, baseCtx, {
      from: isoDaysFromNow(-30),
      to: isoDaysFromNow(0),
    });
    expect(result.map((d) => d.id).sort()).toEqual(['d1', 'd2']);
  });

  it('filtra por status', async () => {
    const fake = makeFake();
    const result = await getDocumentsForAccount(fake as never, baseCtx, {
      status: ['received'],
    });
    expect(result.map((d) => d.id).sort()).toEqual(['d1', 'd3']);
  });

  it('grava audit_log com filtros', async () => {
    const fake = makeFake();
    await getDocumentsForAccount(fake as never, baseCtx, {
      type: 'nf_venda',
    });
    const audit = fake.tables.audit_log.find(
      (r) => (r.action as string) === 'tool.read.documents',
    );
    expect(audit).toBeDefined();
    expect((audit?.metadata as { filter_type: string }).filter_type).toBe('nf_venda');
  });
});
