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
  approveDraftWithMessage,
  computeDraftExpiresAt,
  computeEditDiff,
  createDraft,
  editDraft,
  expireDraft,
  getDraftById,
  listDraftsByTenant,
  listExpiredPendingDrafts,
  listPendingDrafts,
  markDraftAutoApproved,
  rejectDraft,
  resolveDraftExpirationMinutes,
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

// =============================================================================
// Sprint 1.5 — expiração, reject, edit, approveWithMessage
// =============================================================================

describe('resolveDraftExpirationMinutes', () => {
  it('default 15 quando display_settings ausente', () => {
    expect(resolveDraftExpirationMinutes(null)).toBe(15);
    expect(resolveDraftExpirationMinutes({})).toBe(15);
  });

  it('default 15 quando drafts.expiration_minutes ausente', () => {
    expect(resolveDraftExpirationMinutes({ drafts: {} })).toBe(15);
  });

  it('lê valor configurado', () => {
    expect(
      resolveDraftExpirationMinutes({ drafts: { expiration_minutes: 30 } }),
    ).toBe(30);
  });

  it('clamp em [1, 1440]', () => {
    expect(
      resolveDraftExpirationMinutes({ drafts: { expiration_minutes: 0 } }),
    ).toBe(1);
    expect(
      resolveDraftExpirationMinutes({ drafts: { expiration_minutes: 5000 } }),
    ).toBe(1440);
  });

  it('ignora não-number', () => {
    expect(
      resolveDraftExpirationMinutes({ drafts: { expiration_minutes: '30' } }),
    ).toBe(15);
  });
});

describe('computeDraftExpiresAt', () => {
  it('retorna ISO future em minutos', () => {
    const now = Date.now();
    const iso = computeDraftExpiresAt(15);
    const ms = new Date(iso).getTime() - now;
    expect(ms).toBeGreaterThanOrEqual(15 * 60_000 - 50);
    expect(ms).toBeLessThanOrEqual(15 * 60_000 + 50);
  });
});

describe('computeEditDiff', () => {
  it('captura distance entre original e edited', () => {
    const diff = computeEditDiff('abc', 'abcdef');
    expect(diff).toEqual({ original: 'abc', edited: 'abcdef', char_distance: 3 });
  });
});

describe('rejectDraft', () => {
  it('rejeita draft pending', async () => {
    const fake = makeFake();
    const created = await createDraft(fake as never, {
      tenantId: TENANT,
      conversationId: CONV,
      agentId: AGENT,
      proposedContent: 'oi',
    });
    const result = await rejectDraft(fake as never, created.id, {
      resolvedByUserId: USER,
      reason: 'valor desatualizado',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.status).toBe('rejected');
      expect(result.draft.resolved_by).toBe(USER);
      const meta = result.draft.decision_metadata as Record<string, unknown>;
      expect(meta.reason).toBe('valor desatualizado');
    }
  });

  it('aceita sem reason', async () => {
    const fake = makeFake();
    const created = await createDraft(fake as never, {
      tenantId: TENANT,
      conversationId: CONV,
      agentId: AGENT,
      proposedContent: 'oi',
    });
    const result = await rejectDraft(fake as never, created.id, {
      resolvedByUserId: USER,
    });
    expect(result.ok).toBe(true);
  });

  it('not_found pra id inexistente', async () => {
    const fake = makeFake();
    const result = await rejectDraft(
      fake as never,
      '00000000-0000-0000-0000-000000000000',
      { resolvedByUserId: USER },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });

  it('not_pending pra draft já resolvido', async () => {
    const fake = makeFake();
    const created = await createDraft(fake as never, {
      tenantId: TENANT,
      conversationId: CONV,
      agentId: AGENT,
      proposedContent: 'oi',
      status: 'approved',
    });
    const result = await rejectDraft(fake as never, created.id, {
      resolvedByUserId: USER,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_pending');
  });
});

describe('editDraft', () => {
  it('grava status=edited + edit_diff + final_message_id', async () => {
    const fake = makeFake();
    const created = await createDraft(fake as never, {
      tenantId: TENANT,
      conversationId: CONV,
      agentId: AGENT,
      proposedContent: 'O DAS vence dia 20.',
    });
    const finalMsgId = '88888888-8888-8888-8888-888888888888';
    const result = await editDraft(fake as never, created.id, {
      resolvedByUserId: USER,
      editedContent: 'O DAS vence dia 20 — valor R$ 142,50.',
      finalMessageId: finalMsgId,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.status).toBe('edited');
      expect(result.draft.final_message_id).toBe(finalMsgId);
      const diff = result.draft.edit_diff as Record<string, unknown>;
      expect(diff.original).toBe('O DAS vence dia 20.');
      expect(diff.edited).toContain('R$ 142,50');
      expect(typeof diff.char_distance).toBe('number');
    }
  });

  it('not_pending se draft já resolvido', async () => {
    const fake = makeFake();
    const created = await createDraft(fake as never, {
      tenantId: TENANT,
      conversationId: CONV,
      agentId: AGENT,
      proposedContent: 'msg',
      status: 'rejected',
    });
    const result = await editDraft(fake as never, created.id, {
      resolvedByUserId: USER,
      editedContent: 'edit',
      finalMessageId: '11111111-aaaa-aaaa-aaaa-111111111111',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_pending');
  });
});

describe('approveDraftWithMessage', () => {
  it('aprova vinculando final_message_id', async () => {
    const fake = makeFake();
    const created = await createDraft(fake as never, {
      tenantId: TENANT,
      conversationId: CONV,
      agentId: AGENT,
      proposedContent: 'msg',
    });
    const finalMsgId = '99999999-aaaa-aaaa-aaaa-999999999999';
    const result = await approveDraftWithMessage(fake as never, created.id, {
      resolvedByUserId: USER,
      finalMessageId: finalMsgId,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.status).toBe('approved');
      expect(result.draft.final_message_id).toBe(finalMsgId);
    }
  });
});

describe('expireDraft + listExpiredPendingDrafts', () => {
  it('lista drafts pending com expires_at no passado', async () => {
    const fake = makeFake();
    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();

    await createDraft(fake as never, {
      tenantId: TENANT,
      conversationId: CONV,
      agentId: AGENT,
      proposedContent: 'past',
      expiresAt: past,
    });
    await createDraft(fake as never, {
      tenantId: TENANT,
      conversationId: CONV,
      agentId: AGENT,
      proposedContent: 'future',
      expiresAt: future,
    });
    await createDraft(fake as never, {
      tenantId: TENANT,
      conversationId: CONV,
      agentId: AGENT,
      proposedContent: 'no expiration',
      // expiresAt undefined → fica null no fake
    });

    const result = await listExpiredPendingDrafts(fake as never);
    expect(result).toHaveLength(1);
    expect(result[0]?.proposed_content).toBe('past');
  });

  it('expira atomicamente; race entre 2 expires retorna not_pending', async () => {
    const fake = makeFake();
    const past = new Date(Date.now() - 60_000).toISOString();
    const created = await createDraft(fake as never, {
      tenantId: TENANT,
      conversationId: CONV,
      agentId: AGENT,
      proposedContent: 'expired',
      expiresAt: past,
    });
    const r1 = await expireDraft(fake as never, created.id, {
      expirationMinutes: 15,
    });
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      expect(r1.draft.status).toBe('expired');
      const meta = r1.draft.decision_metadata as Record<string, unknown>;
      expect(meta.expiration_minutes).toBe(15);
    }
    const r2 = await expireDraft(fake as never, created.id, {
      expirationMinutes: 15,
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toBe('not_pending');
  });
});

describe('listDraftsByTenant', () => {
  it('aceita filter por array de status', async () => {
    const fake = makeFake();
    await createDraft(fake as never, {
      tenantId: TENANT,
      conversationId: CONV,
      agentId: AGENT,
      proposedContent: 'A',
      status: 'pending',
    });
    await createDraft(fake as never, {
      tenantId: TENANT,
      conversationId: CONV,
      agentId: AGENT,
      proposedContent: 'B',
      status: 'approved',
    });
    await createDraft(fake as never, {
      tenantId: TENANT,
      conversationId: CONV,
      agentId: AGENT,
      proposedContent: 'C',
      status: 'expired',
    });
    const result = await listDraftsByTenant(fake as never, TENANT, {
      status: ['pending', 'expired'],
    });
    expect(result.map((d) => d.proposed_content).sort()).toEqual(['A', 'C']);
  });
});
