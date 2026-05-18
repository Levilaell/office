// =============================================================================
// imap-poller tests — mocks de imapflow/mailparser e do shared-domain.
// Cobre contrato (resolve metadata → conecta → ingere → atualiza status) sem
// servidor IMAP real.
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted: mocks acessíveis ao topo da factory (vi.mock é hoisted ANTES dos
// imports do test). Sem isso, factory referencia vars não-inicializadas.
const mocks = vi.hoisted(() => ({
  connectMock: vi.fn().mockResolvedValue(undefined),
  logoutMock: vi.fn().mockResolvedValue(undefined),
  lockReleaseMock: vi.fn(),
  getMailboxLockMock: vi.fn(),
  fetchMock: vi.fn(),
  messageFlagsAddMock: vi.fn().mockResolvedValue(undefined),
  simpleParserMock: vi.fn(),
  getChannelSessionsByChannelMock: vi.fn(),
  updateChannelSessionStatusMock: vi.fn().mockResolvedValue({ row: {}, previousStatus: null }),
  ingestNormalizedMessagesMock: vi.fn().mockResolvedValue([]),
  buildImapConfigMock: vi.fn(),
  normalizeInboundMock: vi.fn(),
}));

vi.mock('imapflow', () => {
  class FakeImapFlow {
    connect = mocks.connectMock;
    logout = mocks.logoutMock;
    getMailboxLock = mocks.getMailboxLockMock;
    fetch = mocks.fetchMock;
    messageFlagsAdd = mocks.messageFlagsAddMock;
  }
  return { ImapFlow: FakeImapFlow };
});

vi.mock('mailparser', () => ({
  simpleParser: mocks.simpleParserMock,
}));

vi.mock('@office/shared-domain', () => ({
  getChannelSessionsByChannel: mocks.getChannelSessionsByChannelMock,
  updateChannelSessionStatus: mocks.updateChannelSessionStatusMock,
  ingestNormalizedMessages: mocks.ingestNormalizedMessagesMock,
  toChannelSession: (row: Record<string, unknown>) => ({
    id: row.id,
    tenantId: row.tenant_id,
    channel: row.channel,
    identifier: row.identifier,
    connectionMetadata: row.connection_metadata,
    secretsRef: row.secrets_ref,
  }),
}));

vi.mock('@office/shared-domain/channels/registry', () => ({
  getChannelAdapter: vi.fn().mockImplementation(async () => ({
    buildImapConfig: mocks.buildImapConfigMock,
    normalizeInbound: mocks.normalizeInboundMock,
  })),
}));

vi.mock('@office/shared-domain/channels/adapters/email', () => ({
  EmailAdapter: class FakeEmailAdapter {
    buildImapConfig = mocks.buildImapConfigMock;
    normalizeInbound = mocks.normalizeInboundMock;
  },
  parseEmailConnectionMetadata: (raw: Record<string, unknown>) => raw,
}));

const {
  connectMock,
  logoutMock,
  lockReleaseMock,
  getMailboxLockMock,
  fetchMock,
  messageFlagsAddMock,
  simpleParserMock,
  getChannelSessionsByChannelMock,
  updateChannelSessionStatusMock,
  ingestNormalizedMessagesMock,
  buildImapConfigMock,
  normalizeInboundMock,
} = mocks;

import { pollAllSessions, pollOneSession } from '../imap-poller';

const TENANT_A = '11111111-1111-4000-8000-111111111111';
const ACCOUNT_A = '22222222-2222-4000-8000-222222222222';
const SESSION_ID = '33333333-3333-4000-8000-333333333333';

const makeRow = (overrides: Record<string, unknown> = {}) =>
  ({
    id: SESSION_ID,
    tenant_id: TENANT_A,
    channel: 'email_imap',
    status: 'connected',
    identifier: 'office@example.com',
    display_name: null,
    connection_metadata: {
      imap_host: 'imap.example.com',
      imap_port: 993,
      imap_secure: true,
      smtp_host: 'smtp.example.com',
      smtp_port: 465,
      smtp_secure: true,
      default_account_id: ACCOUNT_A,
    },
    secrets_ref: 'env:CHANNEL_TEST_PASSWORD',
    last_health_check: null,
    last_message_at: null,
    error_details: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  }) as never;

const mockSupabase = {} as never;

describe('pollOneSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectMock.mockResolvedValue(undefined);
    logoutMock.mockResolvedValue(undefined);
    getMailboxLockMock.mockResolvedValue({ release: lockReleaseMock });
    fetchMock.mockImplementation(async function* () {
      // sem mensagens por default
    });
    buildImapConfigMock.mockReturnValue({ host: 'imap', port: 993, secure: true, auth: { user: 'u', pass: 'p' } });
    normalizeInboundMock.mockReturnValue([
      {
        senderHandle: 'cliente@example.com',
        channelThreadId: '<a@b>',
        externalMessageId: '<a@b>',
        content: 'oi',
        mediaType: 'text',
        receivedAt: new Date(),
      },
    ]);
    simpleParserMock.mockResolvedValue({
      from: { value: [{ address: 'cliente@example.com', name: '' }] },
      subject: 'oi',
      text: 'oi',
      messageId: '<a@b>',
      date: new Date(),
    });
  });

  it('happy path: conecta, busca, normaliza, ingere, marca SEEN, atualiza connected', async () => {
    fetchMock.mockImplementation(async function* () {
      yield { uid: 1, source: Buffer.from('raw email') };
    });

    const result = await pollOneSession(mockSupabase, makeRow());

    expect(result.status).toBe('ok');
    expect(result.messagesIngested).toBe(1);
    expect(connectMock).toHaveBeenCalled();
    expect(logoutMock).toHaveBeenCalled();
    expect(simpleParserMock).toHaveBeenCalled();
    expect(ingestNormalizedMessagesMock).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({
        tenantId: TENANT_A,
        accountId: ACCOUNT_A,
        channel: 'email_imap',
        sessionId: SESSION_ID,
      }),
    );
    expect(messageFlagsAddMock).toHaveBeenCalledWith({ uid: 1 }, ['\\Seen'], { uid: true });
    expect(updateChannelSessionStatusMock).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({ sessionId: SESSION_ID, status: 'connected' }),
    );
  });

  it('sem mensagens UNSEEN: ainda marca session connected pra atualizar last_health_check', async () => {
    const result = await pollOneSession(mockSupabase, makeRow());
    expect(result.status).toBe('ok');
    expect(result.messagesIngested).toBe(0);
    expect(ingestNormalizedMessagesMock).not.toHaveBeenCalled();
    expect(updateChannelSessionStatusMock).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({ sessionId: SESSION_ID, status: 'connected' }),
    );
  });

  it('default_account_id ausente: marca status=error', async () => {
    const result = await pollOneSession(
      mockSupabase,
      makeRow({
        connection_metadata: {
          imap_host: 'h',
          imap_port: 993,
          smtp_host: 'h',
          smtp_port: 465,
        },
      }),
    );
    expect(result.status).toBe('error');
    expect(result.error).toContain('default_account_id');
    expect(updateChannelSessionStatusMock).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({ status: 'error' }),
    );
    expect(connectMock).not.toHaveBeenCalled();
  });

  it('IMAP connect throw: marca status=error com error_details', async () => {
    connectMock.mockRejectedValueOnce(new Error('AUTH_FAILED'));
    const result = await pollOneSession(mockSupabase, makeRow());
    expect(result.status).toBe('error');
    expect(result.error).toContain('AUTH_FAILED');
    expect(updateChannelSessionStatusMock).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({
        status: 'error',
        errorDetails: expect.objectContaining({ reason: 'imap_connection_failed' }),
      }),
    );
  });

  it('buildImapConfig throw (secret missing): marca status=error', async () => {
    buildImapConfigMock.mockImplementationOnce(() => {
      throw new Error('secret not resolved');
    });
    const result = await pollOneSession(mockSupabase, makeRow());
    expect(result.status).toBe('error');
    expect(updateChannelSessionStatusMock).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({
        status: 'error',
        errorDetails: expect.objectContaining({ reason: 'invalid_imap_config' }),
      }),
    );
  });

  it('falha em mensagem individual não derruba o batch — ingere as outras', async () => {
    fetchMock.mockImplementation(async function* () {
      yield { uid: 1, source: Buffer.from('msg1') };
      yield { uid: 2, source: Buffer.from('msg2') };
      yield { uid: 3, source: Buffer.from('msg3') };
    });
    simpleParserMock
      .mockResolvedValueOnce({ from: { value: [{ address: 'a@b', name: '' }] }, text: 'm1', messageId: '<1>' })
      .mockRejectedValueOnce(new Error('parse error'))
      .mockResolvedValueOnce({ from: { value: [{ address: 'a@b', name: '' }] }, text: 'm3', messageId: '<3>' });

    const result = await pollOneSession(mockSupabase, makeRow());
    expect(result.status).toBe('ok');
    expect(result.messagesIngested).toBe(2);
    expect(ingestNormalizedMessagesMock).toHaveBeenCalledTimes(2);
  });
});

describe('pollAllSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMailboxLockMock.mockResolvedValue({ release: lockReleaseMock });
    fetchMock.mockImplementation(async function* () {});
    buildImapConfigMock.mockReturnValue({ host: 'imap', port: 993, secure: true, auth: { user: 'u', pass: 'p' } });
    connectMock.mockResolvedValue(undefined);
  });

  it('itera connected + errored, retorna resultado por sessão', async () => {
    const row1 = makeRow({ id: 'sess-1', status: 'connected' });
    const row2 = makeRow({ id: 'sess-2', tenant_id: '22222222-2222-4000-8000-aaaaaaaaaaaa', status: 'error' });

    getChannelSessionsByChannelMock
      .mockImplementationOnce(async () => [row1])  // connected
      .mockImplementationOnce(async () => [row2]); // errored

    const results = await pollAllSessions(mockSupabase);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.sessionId)).toEqual(['sess-1', 'sess-2']);
  });

  it('lista vazia: retorna sem erro', async () => {
    getChannelSessionsByChannelMock.mockResolvedValue([]);
    const results = await pollAllSessions(mockSupabase);
    expect(results).toEqual([]);
  });
});
