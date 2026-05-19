// =============================================================================
// drafts-expiration-poller tests — mocks shared-domain + shared-events.
//
// Cobre: lista expirados, UPDATE atômico (1ª chamada expira, 2ª pega race
// skip), publica evento, audit grava, race entre dois polls não duplica.
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  appendAuditLog: vi.fn().mockResolvedValue(undefined),
  expireDraft: vi.fn(),
  getDraftExpirationMinutes: vi.fn().mockResolvedValue(15),
  listExpiredPendingDrafts: vi.fn(),
  patchConversationMetadata: vi.fn().mockResolvedValue(undefined),
  publishEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@office/shared-domain', () => ({
  appendAuditLog: mocks.appendAuditLog,
  expireDraft: mocks.expireDraft,
  getDraftExpirationMinutes: mocks.getDraftExpirationMinutes,
  listExpiredPendingDrafts: mocks.listExpiredPendingDrafts,
  patchConversationMetadata: mocks.patchConversationMetadata,
}));

vi.mock('@office/shared-events', () => ({
  publishEvent: mocks.publishEvent,
}));

import { pollExpiredDrafts } from '../drafts-expiration-poller';

const TENANT = 'tenant-1';
const DRAFT = 'draft-1';
const CONV = 'conv-1';
const AGENT = 'agent-1';

const makeDraft = (
  overrides: Partial<{
    id: string;
    tenant_id: string;
    conversation_id: string;
    agent_id: string;
    proposed_content: string;
  }> = {},
): Record<string, unknown> => ({
  id: DRAFT,
  tenant_id: TENANT,
  conversation_id: CONV,
  agent_id: AGENT,
  proposed_content: 'O DAS vence dia 20.',
  ...overrides,
});

describe('pollExpiredDrafts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDraftExpirationMinutes.mockResolvedValue(15);
  });

  it('retorna [] quando não há expirados', async () => {
    mocks.listExpiredPendingDrafts.mockResolvedValue([]);
    const supabase = {} as never;
    const out = await pollExpiredDrafts(supabase);
    expect(out).toEqual([]);
    expect(mocks.expireDraft).not.toHaveBeenCalled();
  });

  it('expira draft, publica draft.expired e grava audit', async () => {
    const draft = makeDraft();
    mocks.listExpiredPendingDrafts.mockResolvedValue([draft]);
    mocks.expireDraft.mockResolvedValue({
      ok: true,
      draft: { ...draft, status: 'expired' },
    });

    const supabase = {} as never;
    const out = await pollExpiredDrafts(supabase);

    expect(out).toEqual([{ draftId: DRAFT, status: 'expired' }]);
    expect(mocks.expireDraft).toHaveBeenCalledWith(supabase, DRAFT, {
      expirationMinutes: 15,
    });
    expect(mocks.publishEvent).toHaveBeenCalledWith(
      'draft.expired',
      `tenant:${TENANT}`,
      expect.objectContaining({
        tenantId: TENANT,
        draftId: DRAFT,
        conversationId: CONV,
        agentId: AGENT,
        expirationMinutes: 15,
      }),
      expect.any(String),
    );
    expect(mocks.appendAuditLog).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        tenant_id: TENANT,
        action: 'draft.expired',
        resource: `message_draft:${DRAFT}`,
      }),
    );
    expect(mocks.patchConversationMetadata).toHaveBeenCalledWith(supabase, {
      conversationId: CONV,
      metadataPatch: expect.objectContaining({
        last_draft_expired_at: expect.any(String),
        last_draft_expired_id: DRAFT,
      }),
    });
  });

  it('race: expireDraft retorna not_pending → race_skipped, sem publish/audit', async () => {
    const draft = makeDraft();
    mocks.listExpiredPendingDrafts.mockResolvedValue([draft]);
    mocks.expireDraft.mockResolvedValue({ ok: false, reason: 'not_pending' });

    const supabase = {} as never;
    const out = await pollExpiredDrafts(supabase);

    expect(out).toEqual([{ draftId: DRAFT, status: 'race_skipped' }]);
    expect(mocks.publishEvent).not.toHaveBeenCalled();
    expect(mocks.appendAuditLog).not.toHaveBeenCalled();
  });

  it('falha de publish NÃO derruba processamento (audit ainda grava)', async () => {
    const draft = makeDraft();
    mocks.listExpiredPendingDrafts.mockResolvedValue([draft]);
    mocks.expireDraft.mockResolvedValue({
      ok: true,
      draft: { ...draft, status: 'expired' },
    });
    mocks.publishEvent.mockRejectedValueOnce(new Error('redis down'));

    const supabase = {} as never;
    const out = await pollExpiredDrafts(supabase);

    expect(out).toEqual([{ draftId: DRAFT, status: 'expired' }]);
    expect(mocks.appendAuditLog).toHaveBeenCalled();
  });

  it('config lookup falha → fallback 15 min, processa do mesmo jeito', async () => {
    const draft = makeDraft();
    mocks.listExpiredPendingDrafts.mockResolvedValue([draft]);
    mocks.getDraftExpirationMinutes.mockRejectedValueOnce(
      new Error('display_settings inválido'),
    );
    mocks.expireDraft.mockResolvedValue({
      ok: true,
      draft: { ...draft, status: 'expired' },
    });

    const supabase = {} as never;
    const out = await pollExpiredDrafts(supabase);

    expect(out).toEqual([{ draftId: DRAFT, status: 'expired' }]);
    expect(mocks.expireDraft).toHaveBeenCalledWith(supabase, DRAFT, {
      expirationMinutes: 15,
    });
  });

  it('respeita config configurada do tenant', async () => {
    const draft = makeDraft();
    mocks.listExpiredPendingDrafts.mockResolvedValue([draft]);
    mocks.getDraftExpirationMinutes.mockResolvedValue(30);
    mocks.expireDraft.mockResolvedValue({
      ok: true,
      draft: { ...draft, status: 'expired' },
    });

    const supabase = {} as never;
    await pollExpiredDrafts(supabase);

    expect(mocks.expireDraft).toHaveBeenCalledWith(supabase, DRAFT, {
      expirationMinutes: 30,
    });
  });
});
