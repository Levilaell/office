// =============================================================================
// Tests do helper materializeProposal — Sprint 1.5.
//
// Cobre os 3 caminhos:
//   - tier sugestivo → cria draft pending + publica draft.created, NÃO envia
//   - tier semi_autonomo → envia direto + draft auto_approved
//   - tier não suportado (manual/autonomo) → fallback sugestivo + warning
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  publishEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@office/shared-events', () => ({
  publishEvent: mocks.publishEvent,
}));

// sendAgentMessage é importado de '../channels/outbound' relativo. Mockamos
// no caminho que o materializeProposal usa.
const channelsMocks = vi.hoisted(() => ({
  sendAgentMessage: vi.fn(),
}));
vi.mock('../../channels/outbound', () => ({
  sendAgentMessage: channelsMocks.sendAgentMessage,
}));

import { materializeProposal } from '../materialize-proposal';
import { FakeSupabase } from '../../conversations/__tests__/fake-supabase';

const TENANT = '11111111-1111-1111-1111-111111111111';
const CONV = '33333333-3333-3333-3333-333333333333';
const AGENT = '44444444-4444-4444-4444-444444444444';
const ACCOUNT = '55555555-5555-5555-5555-555555555555';

type AnyFake = FakeSupabase & {
  tables: { message_drafts: Array<Record<string, unknown> & { id: string }> };
};

const makeFake = (): AnyFake => {
  const fake = new FakeSupabase() as AnyFake;
  fake.tables.message_drafts = [];
  fake.tables.tenants = [
    {
      id: TENANT,
      name: 'Tenant Teste',
      display_settings: { drafts: { expiration_minutes: 10 } },
      status: 'active',
    },
  ];
  return fake;
};

const baseInput = (
  overrides: Partial<Parameters<typeof materializeProposal>[1]> = {},
) => ({
  tenantId: TENANT,
  conversationId: CONV,
  accountId: ACCOUNT,
  agentId: AGENT,
  agentRunId: 'run-1',
  sourceMessageId: 'msg-1',
  autonomyTier: 'sugestivo',
  proposedContent: 'Olá, seu DAS vence dia 20.',
  reasoning: 'consultou obligations',
  confidence: 0.92,
  templateUsed: 'T06',
  traceId: 'trace-1',
  ...overrides,
});

describe('materializeProposal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tier sugestivo: cria draft pending com expires_at, publica draft.created, NÃO envia', async () => {
    const fake = makeFake();
    const result = await materializeProposal(fake as never, baseInput());

    expect(result.kind).toBe('queued_for_approval');
    if (result.kind !== 'queued_for_approval') return;
    expect(result.tierApplied).toBe('sugestivo');
    expect(result.fellBackToSugestivo).toBe(false);
    expect(result.expiresAt).toBeTruthy();

    expect(fake.tables.message_drafts).toHaveLength(1);
    const draft = fake.tables.message_drafts[0];
    expect(draft?.status).toBe('pending');
    expect(draft?.expires_at).toBe(result.expiresAt);
    expect(draft?.proposed_content).toContain('DAS');

    expect(mocks.publishEvent).toHaveBeenCalledWith(
      'draft.created',
      `tenant:${TENANT}`,
      expect.objectContaining({
        draftId: draft?.id,
        expiresAt: result.expiresAt,
      }),
      'trace-1',
    );

    expect(channelsMocks.sendAgentMessage).not.toHaveBeenCalled();
  });

  it('respeita display_settings.drafts.expiration_minutes do tenant', async () => {
    const fake = makeFake();
    const before = Date.now();
    const result = await materializeProposal(fake as never, baseInput());
    if (result.kind !== 'queued_for_approval') throw new Error('unexpected');
    const ms = new Date(result.expiresAt).getTime() - before;
    // Tenant configurado pra 10 min.
    expect(ms).toBeGreaterThanOrEqual(10 * 60_000 - 100);
    expect(ms).toBeLessThanOrEqual(10 * 60_000 + 100);
  });

  it('tier semi_autonomo: envia direto + draft auto_approved + final_message_id', async () => {
    const fake = makeFake();
    channelsMocks.sendAgentMessage.mockResolvedValue({
      ok: true,
      messageId: 'out-msg-1',
      sendResult: { status: 'sent' },
    });

    const result = await materializeProposal(
      fake as never,
      baseInput({ autonomyTier: 'semi_autonomo' }),
    );

    expect(result.kind).toBe('sent_direct');
    if (result.kind !== 'sent_direct') return;
    expect(result.messageId).toBe('out-msg-1');
    expect(result.tierApplied).toBe('semi_autonomo');

    const draft = fake.tables.message_drafts[0];
    expect(draft?.status).toBe('auto_approved');
    expect(draft?.final_message_id).toBe('out-msg-1');

    expect(channelsMocks.sendAgentMessage).toHaveBeenCalled();
    // Em semi_autonomo NÃO publica draft.created.
    const events = mocks.publishEvent.mock.calls.map((c) => c[0]);
    expect(events).not.toContain('draft.created');
  });

  it('send falha em semi_autonomo: retorna send_failed, draft fica pending', async () => {
    const fake = makeFake();
    channelsMocks.sendAgentMessage.mockResolvedValue({
      ok: false,
      reason: 'no channel_session',
    });

    const result = await materializeProposal(
      fake as never,
      baseInput({ autonomyTier: 'semi_autonomo' }),
    );

    expect(result.kind).toBe('send_failed');
    if (result.kind !== 'send_failed') return;
    expect(result.reason).toContain('channel_session');
    expect(result.draftId).not.toBeNull();

    const draft = fake.tables.message_drafts[0];
    expect(draft?.status).toBe('pending');
  });

  it('tier `manual` ou `autonomo` cai pra sugestivo com warning', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fake = makeFake();
    const result = await materializeProposal(
      fake as never,
      baseInput({ autonomyTier: 'autonomo' }),
    );
    expect(result.kind).toBe('queued_for_approval');
    if (result.kind !== 'queued_for_approval') return;
    expect(result.fellBackToSugestivo).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('semi_autonomo sem accountId cai pra sugestivo (defesa)', async () => {
    const fake = makeFake();
    const result = await materializeProposal(
      fake as never,
      baseInput({ autonomyTier: 'semi_autonomo', accountId: null }),
    );
    expect(result.kind).toBe('queued_for_approval');
    expect(channelsMocks.sendAgentMessage).not.toHaveBeenCalled();
  });
});
