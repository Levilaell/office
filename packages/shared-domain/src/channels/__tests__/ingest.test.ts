import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeSupabase } from '../../conversations/__tests__/fake-supabase';
import type { NormalizedInboundMessage } from '../types';

// Mock @office/shared-events ANTES de importar ingest — vi.mock é hoisted.
vi.mock('@office/shared-events', () => {
  return {
    publishEvent: vi.fn().mockResolvedValue(undefined),
  };
});

import { publishEvent } from '@office/shared-events';
import { ingestNormalizedMessages } from '../ingest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asClient = (fake: FakeSupabase): any => fake;

const TENANT_A = '11111111-1111-4000-8000-111111111111';
const ACCOUNT_A = '22222222-2222-4000-8000-222222222222';
const SESSION_ID = '33333333-3333-4000-8000-333333333333';

const makeMessage = (overrides: Partial<NormalizedInboundMessage> = {}): NormalizedInboundMessage => ({
  senderHandle: 'cliente@example.com',
  channelThreadId: '<msg-1@example.com>',
  externalMessageId: '<msg-1@example.com>',
  content: 'Bom dia',
  mediaType: 'text',
  receivedAt: new Date('2026-05-18T12:00:00Z'),
  ...overrides,
});

describe('ingestNormalizedMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cria conversation, message, audit logs (created+ingested) e publica evento', async () => {
    const fake = new FakeSupabase();
    const results = await ingestNormalizedMessages(asClient(fake), {
      tenantId: TENANT_A,
      accountId: ACCOUNT_A,
      channel: 'email_imap',
      sessionId: SESSION_ID,
      messages: [makeMessage()],
    });
    expect(results).toHaveLength(1);
    const first = results[0]!;
    const { conversation, message } = first;

    // Conversation com canal abstrato.
    expect(conversation.channel).toBe('email');
    expect(conversation.channel_handle).toBe('cliente@example.com');
    expect(fake.tables.conversations).toHaveLength(1);

    // Message persistida.
    expect(message.content).toBe('Bom dia');
    expect(message.direction).toBe('inbound');
    expect(message.sender_type).toBe('end_client');
    expect(fake.tables.messages).toHaveLength(1);

    // Metadata: adapter_channel é 'email_imap' (preserva provedor); thread_id
    // e external_id presentes.
    const meta = message.metadata as Record<string, unknown>;
    expect(meta.adapter_channel).toBe('email_imap');
    expect(meta.session_id).toBe(SESSION_ID);
    expect(meta.thread_id).toBe('<msg-1@example.com>');
    expect(meta.external_id).toBe('<msg-1@example.com>');
    expect(meta.media_type).toBe('text');

    // 2 audit entries: 'message.created' (appendMessage) + 'message.ingested'.
    expect(fake.tables.audit_log).toHaveLength(2);
    const actions = fake.tables.audit_log.map((l) => l.action);
    expect(actions).toContain('message.created');
    expect(actions).toContain('message.ingested');

    const ingested = fake.tables.audit_log.find((l) => l.action === 'message.ingested');
    expect(ingested?.actor).toBe(`channel_session:${SESSION_ID}`);
    const ingestedMeta = ingested?.metadata as Record<string, unknown>;
    expect(ingestedMeta.channel).toBe('email_imap');
    expect(ingestedMeta.conversationChannel).toBe('email');

    // Mesmo trace_id correlaciona created + ingested.
    const traces = new Set(fake.tables.audit_log.map((l) => l.trace_id));
    expect(traces.size).toBe(1);

    // Evento publicado com payload abstrato.
    expect(publishEvent).toHaveBeenCalledTimes(1);
    const [eventType, channel, payload] = (publishEvent as ReturnType<typeof vi.fn>).mock
      .calls[0]!;
    expect(eventType).toBe('message.received');
    expect(channel).toBe(`tenant:${TENANT_A}`);
    expect(payload).toMatchObject({
      tenantId: TENANT_A,
      accountId: ACCOUNT_A,
      conversationId: conversation.id,
      messageId: message.id,
      channel: 'email',
    });
  });

  it('sessionId null → actor é `channel:<type>`, sem session_id na metadata da message', async () => {
    const fake = new FakeSupabase();
    const results = await ingestNormalizedMessages(asClient(fake), {
      tenantId: TENANT_A,
      accountId: ACCOUNT_A,
      channel: 'simulated_webhook',
      sessionId: null,
      messages: [makeMessage({ senderHandle: 'sim-handle' })],
    });
    const { message } = results[0]!;

    const meta = message.metadata as Record<string, unknown>;
    expect(meta.session_id).toBeUndefined();

    const ingested = fake.tables.audit_log.find((l) => l.action === 'message.ingested');
    expect(ingested?.actor).toBe('channel:simulated_webhook');
  });

  it('batch de N mensagens compartilha mesmo trace_id', async () => {
    const fake = new FakeSupabase();
    const messages = [
      makeMessage({ externalMessageId: '<a>', content: 'primeira' }),
      makeMessage({ externalMessageId: '<b>', content: 'segunda' }),
      makeMessage({ externalMessageId: '<c>', content: 'terceira' }),
    ];

    const results = await ingestNormalizedMessages(asClient(fake), {
      tenantId: TENANT_A,
      accountId: ACCOUNT_A,
      channel: 'email_imap',
      sessionId: SESSION_ID,
      messages,
    });

    expect(results).toHaveLength(3);
    // Mesma conversation (mesmo senderHandle) — 3 messages.
    expect(fake.tables.conversations).toHaveLength(1);
    expect(fake.tables.messages).toHaveLength(3);

    const traces = new Set(fake.tables.audit_log.map((l) => l.trace_id));
    expect(traces.size).toBe(1);
  });

  it('traceId passado é respeitado (correlação cross-stack)', async () => {
    const fake = new FakeSupabase();
    const customTrace = 'trace-from-caller-12345';

    await ingestNormalizedMessages(asClient(fake), {
      tenantId: TENANT_A,
      accountId: ACCOUNT_A,
      channel: 'email_imap',
      sessionId: SESSION_ID,
      messages: [makeMessage()],
      traceId: customTrace,
    });

    expect(fake.tables.audit_log.every((l) => l.trace_id === customTrace)).toBe(true);
    const publishCall = (publishEvent as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(publishCall[3]).toBe(customTrace);
  });

  it('subject é preservado quando presente; channel mapeia pra ConversationChannel correto', async () => {
    const fake = new FakeSupabase();
    await ingestNormalizedMessages(asClient(fake), {
      tenantId: TENANT_A,
      accountId: ACCOUNT_A,
      channel: 'whatsapp_evolution',
      sessionId: SESSION_ID,
      messages: [makeMessage({ subject: 'Dúvida sobre DAS' })],
    });

    const conv = fake.tables.conversations[0];
    expect(conv?.channel).toBe('whatsapp'); // mapping evolution → whatsapp
    expect(conv?.subject).toBe('Dúvida sobre DAS');
  });

  it('mediaUrl e rawPayload entram na metadata da message quando presentes', async () => {
    const fake = new FakeSupabase();
    const rawPayload = { from: 'x@y.com', subject: 'Z', size: 1024 };
    await ingestNormalizedMessages(asClient(fake), {
      tenantId: TENANT_A,
      accountId: ACCOUNT_A,
      channel: 'email_imap',
      sessionId: SESSION_ID,
      messages: [
        makeMessage({
          mediaType: 'document',
          mediaUrl: 'cid:doc-1',
          rawPayload,
        }),
      ],
    });

    const msg = fake.tables.messages[0];
    const meta = msg?.metadata as Record<string, unknown>;
    expect(meta.media_type).toBe('document');
    expect(meta.media_url).toBe('cid:doc-1');
    expect(meta.raw_payload).toEqual(rawPayload);
  });
});
