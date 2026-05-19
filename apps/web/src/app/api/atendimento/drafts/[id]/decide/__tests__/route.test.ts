// =============================================================================
// Tests do endpoint POST /api/atendimento/drafts/[id]/decide — Sprint 1.5.
//
// Cobre os 5 casos principais:
//   1. approve happy path
//   2. edit happy path com diff
//   3. reject happy path
//   4. draft já resolvido → 409
//   5. send falha → 502 (draft NÃO transita)
//
// Mocks: Clerk auth, supabase clients, shared-domain (rejectDraft, editDraft,
// approveDraftWithMessage, sendAgentMessage, appendAuditLog) + shared-events
// (publishEvent).
// =============================================================================

import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentAuthContext: vi.fn(),
  getSupabaseForCurrentUser: vi.fn(),
  getServiceRoleSupabase: vi.fn(),
  getDraftById: vi.fn(),
  getUserByClerkUserId: vi.fn(),
  rejectDraft: vi.fn(),
  editDraft: vi.fn(),
  approveDraftWithMessage: vi.fn(),
  sendAgentMessage: vi.fn(),
  appendAuditLog: vi.fn().mockResolvedValue(undefined),
  publishEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentAuthContext: mocks.getCurrentAuthContext,
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseForCurrentUser: mocks.getSupabaseForCurrentUser,
  getServiceRoleSupabase: mocks.getServiceRoleSupabase,
}));

vi.mock('@office/shared-domain', () => ({
  getDraftById: mocks.getDraftById,
  getUserByClerkUserId: mocks.getUserByClerkUserId,
  rejectDraft: mocks.rejectDraft,
  editDraft: mocks.editDraft,
  approveDraftWithMessage: mocks.approveDraftWithMessage,
  sendAgentMessage: mocks.sendAgentMessage,
  appendAuditLog: mocks.appendAuditLog,
  computeEditDiff: (original: string, edited: string) => ({
    original,
    edited,
    char_distance: Math.abs(original.length - edited.length),
  }),
}));

vi.mock('@office/shared-events', () => ({
  publishEvent: mocks.publishEvent,
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';

const DRAFT_ID = '11111111-1111-4111-8111-111111111111';
const TENANT_ID = '22222222-2222-4222-8222-222222222222';
const CONV_ID = '33333333-3333-4333-8333-333333333333';
const AGENT_ID = '44444444-4444-4444-4444-444444444444';
const USER_ID_CLERK = 'user_2abc';
const USER_ID = '55555555-5555-4555-8555-555555555555';
const MSG_ID = '66666666-6666-4666-8666-666666666666';
const ACCOUNT_ID = '77777777-7777-4777-8777-777777777777';

const baseDraft = (overrides: Record<string, unknown> = {}) => ({
  id: DRAFT_ID,
  tenant_id: TENANT_ID,
  conversation_id: CONV_ID,
  agent_id: AGENT_ID,
  proposed_content: 'O DAS vence dia 20/10.',
  status: 'pending',
  resolved_by: null,
  resolved_at: null,
  final_message_id: null,
  expires_at: '2026-05-21T00:30:00.000Z',
  created_at: '2026-05-21T00:00:00.000Z',
  reasoning: 'consultou obligations',
  confidence: 0.9,
  edit_diff: null,
  decision_metadata: null,
  content_type: 'text',
  ...overrides,
});

const buildReq = (body: unknown): NextRequest =>
  new NextRequest('http://localhost/api/atendimento/drafts/x/decide', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

const buildContext = () => ({
  params: Promise.resolve({ id: DRAFT_ID }),
});

const setupAuth = () => {
  mocks.getCurrentAuthContext.mockResolvedValue({
    userId: USER_ID_CLERK,
    orgId: 'org_x',
    role: 'operator',
    email: 'levi@test.com',
  });
  mocks.getUserByClerkUserId.mockResolvedValue({ id: USER_ID });

  // Service role retorna conv real.
  const fakeService = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: CONV_ID,
              tenant_id: TENANT_ID,
              account_id: ACCOUNT_ID,
              channel: 'simulated_webhook',
              channel_handle: 'cliente@test.com',
              subject: null,
            },
            error: null,
          }),
        }),
      }),
    }),
  };
  mocks.getServiceRoleSupabase.mockReturnValue(fakeService);
  mocks.getSupabaseForCurrentUser.mockResolvedValue({});
};

describe('POST /api/atendimento/drafts/[id]/decide', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
  });

  it('401 quando não autenticado', async () => {
    mocks.getCurrentAuthContext.mockResolvedValue(null);
    const res = await POST(buildReq({ action: 'approve' }), buildContext());
    expect(res.status).toBe(401);
  });

  it('404 quando draft não existe (ou outro tenant via RLS)', async () => {
    mocks.getDraftById.mockResolvedValue(null);
    const res = await POST(buildReq({ action: 'approve' }), buildContext());
    expect(res.status).toBe(404);
  });

  it('409 quando draft já está em status diferente de pending', async () => {
    mocks.getDraftById.mockResolvedValue(baseDraft({ status: 'approved' }));
    const res = await POST(buildReq({ action: 'approve' }), buildContext());
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('draft_already_resolved');
  });

  it('approve happy path: envia + transita + audit + publish', async () => {
    mocks.getDraftById.mockResolvedValue(baseDraft());
    mocks.sendAgentMessage.mockResolvedValue({
      ok: true,
      messageId: MSG_ID,
      sendResult: { status: 'sent' },
    });
    mocks.approveDraftWithMessage.mockResolvedValue({
      ok: true,
      draft: baseDraft({ status: 'approved', final_message_id: MSG_ID }),
    });

    const res = await POST(buildReq({ action: 'approve' }), buildContext());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { draft: { status: string; finalMessageId: string } };
    expect(body.draft.status).toBe('approved');
    expect(body.draft.finalMessageId).toBe(MSG_ID);

    expect(mocks.sendAgentMessage).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      tenantId: TENANT_ID,
      conversationId: CONV_ID,
      content: 'O DAS vence dia 20/10.',
    }));
    expect(mocks.approveDraftWithMessage).toHaveBeenCalled();
    expect(mocks.appendAuditLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'draft.approved',
    }));
    expect(mocks.publishEvent).toHaveBeenCalledWith(
      'draft.approved',
      `tenant:${TENANT_ID}`,
      expect.objectContaining({ draftId: DRAFT_ID, finalMessageId: MSG_ID }),
      expect.any(String),
    );
  });

  it('edit happy path: envia edited_content, salva diff', async () => {
    mocks.getDraftById.mockResolvedValue(baseDraft());
    mocks.sendAgentMessage.mockResolvedValue({
      ok: true,
      messageId: MSG_ID,
      sendResult: { status: 'sent' },
    });
    mocks.editDraft.mockResolvedValue({
      ok: true,
      draft: baseDraft({
        status: 'edited',
        final_message_id: MSG_ID,
        edit_diff: { original: 'A', edited: 'B', char_distance: 0 },
      }),
    });

    const res = await POST(
      buildReq({
        action: 'edit',
        edited_content: 'O DAS de outubro vence dia 20/10 — valor R$ 487,30.',
        justification: 'adicionei valor exato',
      }),
      buildContext(),
    );
    expect(res.status).toBe(200);

    // Service envio com edited_content.
    expect(mocks.sendAgentMessage).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      content: 'O DAS de outubro vence dia 20/10 — valor R$ 487,30.',
    }));
    expect(mocks.editDraft).toHaveBeenCalledWith(
      expect.anything(),
      DRAFT_ID,
      expect.objectContaining({
        editedContent: 'O DAS de outubro vence dia 20/10 — valor R$ 487,30.',
        finalMessageId: MSG_ID,
        justification: 'adicionei valor exato',
      }),
    );
    expect(mocks.publishEvent).toHaveBeenCalledWith(
      'draft.edited',
      `tenant:${TENANT_ID}`,
      expect.objectContaining({
        editDiff: expect.objectContaining({ char_distance: expect.any(Number) }),
      }),
      expect.any(String),
    );
  });

  it('reject happy path: NÃO envia, transita, audit, publish', async () => {
    mocks.getDraftById.mockResolvedValue(baseDraft());
    mocks.rejectDraft.mockResolvedValue({
      ok: true,
      draft: baseDraft({ status: 'rejected' }),
    });

    const res = await POST(
      buildReq({ action: 'reject', reason: 'valor desatualizado' }),
      buildContext(),
    );
    expect(res.status).toBe(200);

    expect(mocks.sendAgentMessage).not.toHaveBeenCalled();
    expect(mocks.rejectDraft).toHaveBeenCalledWith(
      expect.anything(),
      DRAFT_ID,
      expect.objectContaining({ reason: 'valor desatualizado' }),
    );
    expect(mocks.publishEvent).toHaveBeenCalledWith(
      'draft.rejected',
      `tenant:${TENANT_ID}`,
      expect.objectContaining({ reason: 'valor desatualizado' }),
      expect.any(String),
    );
  });

  it('502 quando send falha; draft NÃO transita', async () => {
    mocks.getDraftById.mockResolvedValue(baseDraft());
    mocks.sendAgentMessage.mockResolvedValue({
      ok: false,
      reason: 'no channel_session for email_imap',
    });

    const res = await POST(buildReq({ action: 'approve' }), buildContext());
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string; reason: string };
    expect(body.error).toBe('channel_send_failed');
    expect(body.reason).toContain('channel_session');

    expect(mocks.approveDraftWithMessage).not.toHaveBeenCalled();
    expect(mocks.appendAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'draft.decide_failed' }),
    );
  });

  it('400 quando body inválido', async () => {
    const res = await POST(
      buildReq({ action: 'edit' }), // sem edited_content
      buildContext(),
    );
    expect(res.status).toBe(400);
  });

  it('reject sem reason é aceito', async () => {
    mocks.getDraftById.mockResolvedValue(baseDraft());
    mocks.rejectDraft.mockResolvedValue({
      ok: true,
      draft: baseDraft({ status: 'rejected' }),
    });
    const res = await POST(
      buildReq({ action: 'reject' }),
      buildContext(),
    );
    expect(res.status).toBe(200);
    expect(mocks.rejectDraft).toHaveBeenCalled();
  });
});
