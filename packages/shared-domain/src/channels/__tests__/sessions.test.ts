import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@office/shared-events', () => ({
  publishEvent: vi.fn().mockResolvedValue(undefined),
}));

import { publishEvent } from '@office/shared-events';
import { FakeSupabase } from './fake-supabase';
import {
  getActiveChannelSessionsForTenant,
  getChannelSession,
  getChannelSessionsByChannel,
  listChannelSessionsForTenant,
  toChannelSession,
  updateChannelSessionStatus,
  upsertChannelSession,
} from '../sessions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asClient = (fake: FakeSupabase): any => fake;

const TENANT_A = '11111111-1111-4000-8000-111111111111';
const TENANT_B = '11111111-1111-4000-8000-222222222222';

describe('upsertChannelSession', () => {
  let fake: FakeSupabase;
  beforeEach(() => {
    fake = new FakeSupabase();
  });

  it('cria sessão nova quando não existe', async () => {
    const session = await upsertChannelSession(asClient(fake), {
      tenantId: TENANT_A,
      channel: 'email_imap',
      identifier: 'office@example.com',
      displayName: 'E-mail principal',
      connectionMetadata: { host: 'imap.example.com', port: 993 },
      secretsRef: 'env:SEED_EMAIL_PASSWORD',
    });

    expect(session.tenant_id).toBe(TENANT_A);
    expect(session.channel).toBe('email_imap');
    expect(session.identifier).toBe('office@example.com');
    expect(session.status).toBe('disconnected');
    expect(fake.tables.channel_sessions).toHaveLength(1);
  });

  it('atualiza sessão existente pelo UNIQUE (tenant, channel) — idempotente', async () => {
    const first = await upsertChannelSession(asClient(fake), {
      tenantId: TENANT_A,
      channel: 'email_imap',
      identifier: 'office@example.com',
    });

    const second = await upsertChannelSession(asClient(fake), {
      tenantId: TENANT_A,
      channel: 'email_imap',
      identifier: 'novo@example.com', // sobrescreve
      displayName: 'Atualizado',
    });

    expect(second.id).toBe(first.id);
    expect(second.identifier).toBe('novo@example.com');
    expect(second.display_name).toBe('Atualizado');
    expect(fake.tables.channel_sessions).toHaveLength(1);
  });

  it('isola sessões entre tenants — mesmo canal, sessões separadas', async () => {
    await upsertChannelSession(asClient(fake), {
      tenantId: TENANT_A,
      channel: 'email_imap',
      identifier: 'a@example.com',
    });
    await upsertChannelSession(asClient(fake), {
      tenantId: TENANT_B,
      channel: 'email_imap',
      identifier: 'b@example.com',
    });

    expect(fake.tables.channel_sessions).toHaveLength(2);
  });
});

describe('getChannelSession e listChannelSessionsForTenant', () => {
  let fake: FakeSupabase;
  beforeEach(async () => {
    fake = new FakeSupabase();
    await upsertChannelSession(asClient(fake), {
      tenantId: TENANT_A,
      channel: 'email_imap',
      identifier: 'a@example.com',
    });
    await upsertChannelSession(asClient(fake), {
      tenantId: TENANT_A,
      channel: 'simulated_webhook',
    });
    await upsertChannelSession(asClient(fake), {
      tenantId: TENANT_B,
      channel: 'email_imap',
      identifier: 'b@example.com',
    });
  });

  it('getChannelSession resolve sessão específica do tenant', async () => {
    const got = await getChannelSession(asClient(fake), TENANT_A, 'email_imap');
    expect(got?.identifier).toBe('a@example.com');
  });

  it('getChannelSession retorna null pra tenant sem sessão', async () => {
    const fakeEmpty = new FakeSupabase();
    const got = await getChannelSession(asClient(fakeEmpty), TENANT_A, 'email_imap');
    expect(got).toBeNull();
  });

  it('lista todas sessões do tenant — não vaza outros', async () => {
    const list = await listChannelSessionsForTenant(asClient(fake), TENANT_A);
    expect(list).toHaveLength(2);
    expect(list.every((s) => s.tenant_id === TENANT_A)).toBe(true);
  });
});

describe('getActiveChannelSessionsForTenant', () => {
  it('filtra só status=connected', async () => {
    const fake = new FakeSupabase();
    await upsertChannelSession(asClient(fake), {
      tenantId: TENANT_A,
      channel: 'email_imap',
      status: 'connected',
    });
    await upsertChannelSession(asClient(fake), {
      tenantId: TENANT_A,
      channel: 'simulated_webhook',
      status: 'disconnected',
    });

    const active = await getActiveChannelSessionsForTenant(asClient(fake), TENANT_A);
    expect(active).toHaveLength(1);
    expect(active[0]?.channel).toBe('email_imap');
  });
});

describe('getChannelSessionsByChannel', () => {
  it('lista todas as sessões de um canal (cross-tenant, pra workers)', async () => {
    const fake = new FakeSupabase();
    await upsertChannelSession(asClient(fake), {
      tenantId: TENANT_A,
      channel: 'email_imap',
      status: 'connected',
    });
    await upsertChannelSession(asClient(fake), {
      tenantId: TENANT_B,
      channel: 'email_imap',
      status: 'connected',
    });
    await upsertChannelSession(asClient(fake), {
      tenantId: TENANT_A,
      channel: 'simulated_webhook',
    });

    const allEmail = await getChannelSessionsByChannel(asClient(fake), 'email_imap');
    expect(allEmail).toHaveLength(2);

    const connectedEmail = await getChannelSessionsByChannel(
      asClient(fake),
      'email_imap',
      'connected',
    );
    expect(connectedEmail).toHaveLength(2);
  });
});

describe('updateChannelSessionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transiciona status, grava audit_log, publica evento, retorna previousStatus', async () => {
    const fake = new FakeSupabase();
    const session = await upsertChannelSession(asClient(fake), {
      tenantId: TENANT_A,
      channel: 'email_imap',
      status: 'disconnected',
    });

    const result = await updateChannelSessionStatus(asClient(fake), {
      sessionId: session.id,
      tenantId: TENANT_A,
      status: 'connected',
    });

    expect(result.previousStatus).toBe('disconnected');
    expect(result.row.status).toBe('connected');
    expect(result.row.last_health_check).not.toBeNull();

    expect(fake.tables.audit_log).toHaveLength(1);
    const log = fake.tables.audit_log[0];
    expect(log?.action).toBe('channel_session.status_changed');
    expect(log?.resource).toBe(`channel_session:${session.id}`);
    expect((log?.before as { status: string }).status).toBe('disconnected');
    expect((log?.after as { status: string }).status).toBe('connected');

    // Publica evento pra UI realtime.
    expect(publishEvent).toHaveBeenCalledTimes(1);
    const [eventType, channel, payload] = (publishEvent as ReturnType<typeof vi.fn>).mock
      .calls[0]!;
    expect(eventType).toBe('channel_session.status_changed');
    expect(channel).toBe(`tenant:${TENANT_A}`);
    expect(payload).toMatchObject({
      sessionId: session.id,
      tenantId: TENANT_A,
      channel: 'email_imap',
      previousStatus: 'disconnected',
      status: 'connected',
    });
  });

  it('não grava audit_log nem publica evento se status não mudou', async () => {
    const fake = new FakeSupabase();
    const session = await upsertChannelSession(asClient(fake), {
      tenantId: TENANT_A,
      channel: 'email_imap',
      status: 'connected',
    });

    await updateChannelSessionStatus(asClient(fake), {
      sessionId: session.id,
      tenantId: TENANT_A,
      status: 'connected',
    });

    expect(fake.tables.audit_log).toHaveLength(0);
    expect(publishEvent).not.toHaveBeenCalled();
  });

  it('grava error_details no audit_log e na row', async () => {
    const fake = new FakeSupabase();
    const session = await upsertChannelSession(asClient(fake), {
      tenantId: TENANT_A,
      channel: 'email_imap',
      status: 'connected',
    });

    const errorDetails = { code: 'AUTH_FAILED', message: 'invalid credentials' };
    await updateChannelSessionStatus(asClient(fake), {
      sessionId: session.id,
      tenantId: TENANT_A,
      status: 'error',
      errorDetails,
    });

    const row = fake.tables.channel_sessions[0];
    expect(row?.status).toBe('error');
    expect(row?.error_details).toEqual(errorDetails);

    const log = fake.tables.audit_log[0];
    expect((log?.metadata as { errorDetails: typeof errorDetails }).errorDetails).toEqual(
      errorDetails,
    );
  });
});

describe('toChannelSession', () => {
  it('mapeia row do banco pra ChannelSession (camelCase, subset)', async () => {
    const fake = new FakeSupabase();
    const row = await upsertChannelSession(asClient(fake), {
      tenantId: TENANT_A,
      channel: 'email_imap',
      identifier: 'office@example.com',
      connectionMetadata: { host: 'imap.example.com' },
      secretsRef: 'env:CHANNEL_EMAIL_PASSWORD',
    });

    const session = toChannelSession(row);
    expect(session).toEqual({
      id: row.id,
      tenantId: TENANT_A,
      channel: 'email_imap',
      identifier: 'office@example.com',
      connectionMetadata: { host: 'imap.example.com' },
      secretsRef: 'env:CHANNEL_EMAIL_PASSWORD',
    });
  });

  it('throw em channel inválido (defensivo contra DB corrompido)', () => {
    const badRow = {
      id: 'x',
      tenant_id: TENANT_A,
      channel: 'invalid_channel',
      status: 'connected',
      identifier: null,
      display_name: null,
      connection_metadata: {},
      secrets_ref: null,
      last_health_check: null,
      last_message_at: null,
      error_details: null,
      created_at: '',
      updated_at: '',
    };
    expect(() => toChannelSession(badRow)).toThrow(/invalid channel/);
  });
});
