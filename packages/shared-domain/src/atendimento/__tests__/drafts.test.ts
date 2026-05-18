// =============================================================================
// Testes do repositório message_drafts (Sprint 1.3)
//
// Cobre: criar, listar pendentes, aprovar (caminho ok + race), markAutoApproved.
// Fake supabase do shared-domain/conversations já tem o mínimo necessário —
// reusamos.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  approveDraft,
  createDraft,
  getDraftById,
  listPendingDrafts,
  markDraftAutoApproved,
} from '../drafts';
import { FakeSupabase } from '../../conversations/__tests__/fake-supabase';

const TENANT = '11111111-1111-1111-1111-111111111111';
const TENANT_OUTRO = '22222222-2222-2222-2222-222222222222';
const CONV = '33333333-3333-3333-3333-333333333333';
const AGENT = '44444444-4444-4444-4444-444444444444';
const USER = '55555555-5555-5555-5555-555555555555';
const MSG = '66666666-6666-6666-6666-666666666666';

type AnyFake = FakeSupabase & {
  tables: { message_drafts: Array<Record<string, unknown> & { id: string }> };
};

const makeFake = (): AnyFake => {
  const fake = new FakeSupabase() as AnyFake;
  fake.tables.message_drafts = [];
  return fake;
};

describe('createDraft', () => {
  it('insere row com defaults aplicados', async () => {
    const fake = makeFake();
    const draft = await createDraft(fake as never, {
      tenantId: TENANT,
      conversationId: CONV,
      agentId: AGENT,
      proposedContent: 'Olá, seu DAS de outubro vence dia 20.',
      reasoning: 'cliente perguntou status; consultou obligations',
      confidence: 0.87,
      sourceMessageId: MSG,
    });

    expect(draft.tenant_id).toBe(TENANT);
    expect(draft.proposed_content).toContain('DAS');
    expect(draft.confidence).toBe(0.87);
    expect(fake.inserts).toHaveLength(1);
    expect(fake.inserts[0]?.table).toBe('message_drafts');
  });

  it('respeita status explícito (auto_approved no fluxo Fase 1)', async () => {
    const fake = makeFake();
    const draft = await createDraft(fake as never, {
      tenantId: TENANT,
      conversationId: CONV,
      agentId: AGENT,
      proposedContent: 'msg',
      status: 'auto_approved',
    });
    expect(draft.status).toBe('auto_approved');
  });
});

describe('getDraftById', () => {
  it('retorna null quando draft inexistente', async () => {
    const fake = makeFake();
    const out = await getDraftById(fake as never, 'inexistente');
    expect(out).toBeNull();
  });

  it('retorna draft criado', async () => {
    const fake = makeFake();
    const created = await createDraft(fake as never, {
      tenantId: TENANT,
      conversationId: CONV,
      agentId: AGENT,
      proposedContent: 'oi',
    });
    const fetched = await getDraftById(fake as never, created.id);
    expect(fetched?.id).toBe(created.id);
  });
});

describe('listPendingDrafts', () => {
  it('filtra por tenant + status=pending', async () => {
    const fake = makeFake();
    // Tenant A — pending
    await createDraft(fake as never, {
      tenantId: TENANT,
      conversationId: CONV,
      agentId: AGENT,
      proposedContent: 'msg pending',
    });
    // Tenant A — auto_approved (não deve aparecer)
    await createDraft(fake as never, {
      tenantId: TENANT,
      conversationId: CONV,
      agentId: AGENT,
      proposedContent: 'msg approved',
      status: 'auto_approved',
    });
    // Tenant B — pending (vazamento de tenant é teste de RLS mais formal,
    // aqui só validamos filtro de query).
    await createDraft(fake as never, {
      tenantId: TENANT_OUTRO,
      conversationId: CONV,
      agentId: AGENT,
      proposedContent: 'outro tenant',
    });

    const result = await listPendingDrafts(fake as never, TENANT);
    expect(result).toHaveLength(1);
    expect(result[0]?.proposed_content).toBe('msg pending');
  });

  it('filtra opcionalmente por conversationId', async () => {
    const fake = makeFake();
    await createDraft(fake as never, {
      tenantId: TENANT,
      conversationId: CONV,
      agentId: AGENT,
      proposedContent: 'A',
    });
    await createDraft(fake as never, {
      tenantId: TENANT,
      conversationId: '99999999-9999-9999-9999-999999999999',
      agentId: AGENT,
      proposedContent: 'B',
    });
    const result = await listPendingDrafts(fake as never, TENANT, {
      conversationId: CONV,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.proposed_content).toBe('A');
  });
});

describe('approveDraft', () => {
  it('aprova draft pending → approved', async () => {
    const fake = makeFake();
    const created = await createDraft(fake as never, {
      tenantId: TENANT,
      conversationId: CONV,
      agentId: AGENT,
      proposedContent: 'msg',
    });
    const result = await approveDraft(fake as never, created.id, USER);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.status).toBe('approved');
      expect(result.draft.resolved_by).toBe(USER);
      expect(result.draft.resolved_at).not.toBeNull();
    }
  });

  it('retorna not_found pra draft inexistente', async () => {
    const fake = makeFake();
    const result = await approveDraft(
      fake as never,
      '00000000-0000-0000-0000-000000000000',
      USER,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });

  it('retorna not_pending em race (draft já auto_approved)', async () => {
    const fake = makeFake();
    const created = await createDraft(fake as never, {
      tenantId: TENANT,
      conversationId: CONV,
      agentId: AGENT,
      proposedContent: 'msg',
      status: 'auto_approved',
    });
    const result = await approveDraft(fake as never, created.id, USER);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_pending');
  });
});

describe('markDraftAutoApproved', () => {
  it('marca draft com final_message_id e timestamp', async () => {
    const fake = makeFake();
    const created = await createDraft(fake as never, {
      tenantId: TENANT,
      conversationId: CONV,
      agentId: AGENT,
      proposedContent: 'msg',
    });
    const finalMsgId = '77777777-7777-7777-7777-777777777777';
    const updated = await markDraftAutoApproved(
      fake as never,
      created.id,
      finalMsgId,
      { reason: 'tier=sugestivo na Fase 1' },
    );
    expect(updated.status).toBe('auto_approved');
    expect(updated.final_message_id).toBe(finalMsgId);
    expect(updated.resolved_at).not.toBeNull();
  });
});
