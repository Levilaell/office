import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decideApproval } from '../approvals-api';
import type { ApprovalSnapshot } from '../realtime-types';

const APPROVAL: ApprovalSnapshot = {
  id: '00000000-0000-0000-0000-000000000001',
  taskId: '00000000-0000-0000-0000-000000000002',
  agentId: '00000000-0000-0000-0000-000000000003',
  status: 'approved',
  actionType: 'submit_obligation',
  proposal: { foo: 'bar' },
  context: { cliente: 'Padaria do João' },
  reviewerUserId: 'user_123',
  decision: { action: 'approve' },
  decidedAt: '2026-05-15T12:00:00.000Z',
  expiresAt: null,
  createdAt: '2026-05-15T11:00:00.000Z',
};

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const okResponse = (approval: ApprovalSnapshot): Response =>
  ({
    ok: true,
    status: 200,
    json: async () => ({ approval }),
  } as unknown as Response);

const errorResponse = (status: number, body: unknown): Response =>
  ({
    ok: false,
    status,
    json: async () => body,
  } as unknown as Response);

describe('decideApproval', () => {
  it('faz POST com body approve', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(APPROVAL));
    const result = await decideApproval(APPROVAL.id, {
      action: 'approve',
      justification: 'ok',
    });
    expect(result).toEqual(APPROVAL);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/approvals/${APPROVAL.id}/decide`);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({
      action: 'approve',
      justification: 'ok',
    });
  });

  it('faz POST com body reject (justification obrigatória)', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ ...APPROVAL, status: 'rejected' }));
    await decideApproval(APPROVAL.id, {
      action: 'reject',
      justification: 'valor incorreto',
    });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      action: 'reject',
      justification: 'valor incorreto',
    });
  });

  it('faz POST com body modify carregando modifiedProposal', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ ...APPROVAL, status: 'modified' }));
    await decideApproval(APPROVAL.id, {
      action: 'modify',
      modifiedProposal: { valor: 100 },
    });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      action: 'modify',
      modifiedProposal: { valor: 100 },
    });
  });

  it('faz POST com body request_info carregando question', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(APPROVAL));
    await decideApproval(APPROVAL.id, {
      action: 'request_info',
      question: 'confirma regime?',
    });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      action: 'request_info',
      question: 'confirma regime?',
    });
  });

  it('propaga erro HTTP com mensagem do servidor', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(409, { error: 'already decided' }));
    await expect(
      decideApproval(APPROVAL.id, { action: 'approve' }),
    ).rejects.toThrow('already decided');
  });

  it('propaga erro HTTP genérico quando JSON falha', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response);
    await expect(
      decideApproval(APPROVAL.id, { action: 'approve' }),
    ).rejects.toThrow('decide failed with 500');
  });
});
