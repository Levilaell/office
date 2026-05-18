// =============================================================================
// Testes da tool getRecentInteractionsForAccount
// =============================================================================

import { describe, it, expect } from 'vitest';
import { getRecentInteractionsForAccount } from '../tools/interactions';
import { FakeSupabase } from '../../conversations/__tests__/fake-supabase';

const TENANT = '11111111-1111-1111-1111-111111111111';
const ACCOUNT = 'aaaa1111-1111-1111-1111-111111111111';
const CONV_EMAIL = 'cccc1111-1111-1111-1111-111111111111';
const CONV_WHATS = 'cccc2222-2222-2222-2222-222222222222';

const baseCtx = {
  tenantId: TENANT,
  accountId: ACCOUNT,
  actor: 'agent:specialist',
  traceId: 'trace-1',
};

const makeFake = (): FakeSupabase => {
  const fake = new FakeSupabase();
  fake.tables.conversations = [
    {
      id: CONV_EMAIL,
      tenant_id: TENANT,
      account_id: ACCOUNT,
      channel: 'email',
      channel_handle: 'cliente@example.com',
    },
    {
      id: CONV_WHATS,
      tenant_id: TENANT,
      account_id: ACCOUNT,
      channel: 'whatsapp',
      channel_handle: '+5511999998888',
    },
  ];
  fake.tables.messages = [
    {
      id: 'm1',
      tenant_id: TENANT,
      account_id: ACCOUNT,
      conversation_id: CONV_EMAIL,
      direction: 'inbound',
      sender_type: 'end_client',
      content: 'Oi, queria o DAS',
      created_at: '2026-05-10T10:00:00Z',
    },
    {
      id: 'm2',
      tenant_id: TENANT,
      account_id: ACCOUNT,
      conversation_id: CONV_EMAIL,
      direction: 'outbound',
      sender_type: 'agent',
      content: 'Vou verificar',
      created_at: '2026-05-10T10:05:00Z',
    },
    {
      id: 'm3',
      tenant_id: TENANT,
      account_id: ACCOUNT,
      conversation_id: CONV_WHATS,
      direction: 'inbound',
      sender_type: 'end_client',
      content: 'E meu INSS?',
      created_at: '2026-05-11T08:00:00Z',
    },
  ];
  return fake;
};

describe('getRecentInteractionsForAccount', () => {
  it('retorna mensagens das múltiplas conversations', async () => {
    const fake = makeFake();
    const result = await getRecentInteractionsForAccount(fake as never, baseCtx);
    expect(result).toHaveLength(3);
    // Mais recente primeiro
    expect(result[0]?.id).toBe('m3');
    expect(result[0]?.channel).toBe('whatsapp');
  });

  it('respeita limit', async () => {
    const fake = makeFake();
    const result = await getRecentInteractionsForAccount(fake as never, baseCtx, {
      limit: 2,
    });
    expect(result).toHaveLength(2);
  });

  it('grava audit_log', async () => {
    const fake = makeFake();
    await getRecentInteractionsForAccount(fake as never, baseCtx);
    const audit = fake.tables.audit_log.find(
      (r) => (r.action as string) === 'tool.read.recent_interactions',
    );
    expect(audit).toBeDefined();
    expect((audit?.metadata as { count: number }).count).toBe(3);
  });

  it('lista vazia quando sem mensagens', async () => {
    const fake = new FakeSupabase();
    const result = await getRecentInteractionsForAccount(fake as never, baseCtx);
    expect(result).toEqual([]);
  });
});
