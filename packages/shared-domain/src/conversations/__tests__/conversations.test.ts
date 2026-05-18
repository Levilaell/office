import { beforeEach, describe, expect, it } from 'vitest';
import { FakeSupabase } from './fake-supabase';
import {
  appendMessage,
  listConversations,
  upsertConversation,
} from '../index';

// Cast pra contornar tipos estritos do supabase-js — o fake implementa só o
// subset que essas funções precisam.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asClient = (fake: FakeSupabase): any => fake;

const TENANT_A = '11111111-1111-4000-8000-111111111111';
const ACCOUNT_A = '22222222-2222-4000-8000-222222222222';

describe('upsertConversation', () => {
  let fake: FakeSupabase;
  beforeEach(() => {
    fake = new FakeSupabase();
  });

  it('cria conversation nova quando não existe', async () => {
    const conv = await upsertConversation(asClient(fake), {
      tenantId: TENANT_A,
      accountId: ACCOUNT_A,
      channel: 'simulated_webhook',
      channelHandle: 'cliente@example.com',
      subject: 'DAS',
    });

    expect(conv.tenant_id).toBe(TENANT_A);
    expect(conv.account_id).toBe(ACCOUNT_A);
    expect(conv.channel).toBe('simulated_webhook');
    expect(conv.channel_handle).toBe('cliente@example.com');
    expect(conv.subject).toBe('DAS');
    expect(fake.tables.conversations).toHaveLength(1);
  });

  it('é idempotente — segunda chamada com mesma key retorna a existente sem novo insert', async () => {
    const first = await upsertConversation(asClient(fake), {
      tenantId: TENANT_A,
      accountId: ACCOUNT_A,
      channel: 'simulated_webhook',
      channelHandle: 'cliente@example.com',
      subject: 'primeira',
    });

    const second = await upsertConversation(asClient(fake), {
      tenantId: TENANT_A,
      accountId: ACCOUNT_A,
      channel: 'simulated_webhook',
      channelHandle: 'cliente@example.com',
      subject: 'segunda', // não sobrescreve
    });

    expect(second.id).toBe(first.id);
    expect(second.subject).toBe('primeira'); // mantém subject original
    expect(fake.tables.conversations).toHaveLength(1);
    const insertCount = fake.inserts.filter((i) => i.table === 'conversations').length;
    expect(insertCount).toBe(1);
  });

  it('cria conversations separadas pra canais diferentes do mesmo cliente', async () => {
    await upsertConversation(asClient(fake), {
      tenantId: TENANT_A,
      accountId: ACCOUNT_A,
      channel: 'email',
      channelHandle: 'cliente@example.com',
    });
    await upsertConversation(asClient(fake), {
      tenantId: TENANT_A,
      accountId: ACCOUNT_A,
      channel: 'whatsapp',
      channelHandle: 'cliente@example.com',
    });
    expect(fake.tables.conversations).toHaveLength(2);
  });
});

describe('appendMessage', () => {
  let fake: FakeSupabase;
  let convId: string;

  beforeEach(async () => {
    fake = new FakeSupabase();
    const conv = await upsertConversation(asClient(fake), {
      tenantId: TENANT_A,
      accountId: ACCOUNT_A,
      channel: 'simulated_webhook',
      channelHandle: 'cliente@example.com',
    });
    convId = conv.id;
  });

  it('inbound: insere message, bumpa last_message_at e incrementa unread_count', async () => {
    const ix = await appendMessage(asClient(fake), {
      tenantId: TENANT_A,
      conversationId: convId,
      accountId: ACCOUNT_A,
      direction: 'inbound',
      senderType: 'end_client',
      senderId: null,
      content: 'Bom dia',
    });

    expect(ix.direction).toBe('inbound');
    expect(ix.sender_type).toBe('end_client');
    expect(fake.tables.messages).toHaveLength(1);

    const conv = fake.tables.conversations[0];
    expect(conv?.unread_count).toBe(1);
    expect(conv?.last_message_at).toBe(ix.created_at);

    // segunda mensagem inbound: unread continua subindo
    await appendMessage(asClient(fake), {
      tenantId: TENANT_A,
      conversationId: convId,
      accountId: ACCOUNT_A,
      direction: 'inbound',
      senderType: 'end_client',
      senderId: null,
      content: 'Segunda',
    });
    expect(fake.tables.conversations[0]?.unread_count).toBe(2);
  });

  it('outbound: bumpa last_message_at mas NÃO incrementa unread_count', async () => {
    await appendMessage(asClient(fake), {
      tenantId: TENANT_A,
      conversationId: convId,
      accountId: ACCOUNT_A,
      direction: 'inbound',
      senderType: 'end_client',
      senderId: null,
      content: 'Pergunta',
    });
    const afterInbound = fake.tables.conversations[0]?.unread_count;
    expect(afterInbound).toBe(1);

    const reply = await appendMessage(asClient(fake), {
      tenantId: TENANT_A,
      conversationId: convId,
      accountId: ACCOUNT_A,
      direction: 'outbound',
      senderType: 'operator',
      senderId: 'user_abc',
      content: 'Resposta',
    });

    const conv = fake.tables.conversations[0];
    expect(conv?.unread_count).toBe(1); // não muda
    expect(conv?.last_message_at).toBe(reply.created_at);
  });

  it('grava audit_log com actor formatado por senderType e metadata', async () => {
    await appendMessage(asClient(fake), {
      tenantId: TENANT_A,
      conversationId: convId,
      accountId: ACCOUNT_A,
      direction: 'inbound',
      senderType: 'end_client',
      senderId: null,
      content: 'Olá',
      metadata: { simulated: true, channelHandle: 'cliente@example.com' },
    });

    expect(fake.tables.audit_log).toHaveLength(1);
    const log = fake.tables.audit_log[0];
    expect(log?.actor).toBe('end_client');
    expect(log?.action).toBe('message.created');
    expect((log?.resource as string)).toMatch(/^message:/);
    expect((log?.metadata as Record<string, unknown>).simulated).toBe(true);
    expect((log?.metadata as Record<string, unknown>).senderType).toBe('end_client');
    expect((log?.metadata as Record<string, unknown>).direction).toBe('inbound');
  });

  it('actor reflete senderType+senderId pra agent e operator', async () => {
    await appendMessage(asClient(fake), {
      tenantId: TENANT_A,
      conversationId: convId,
      accountId: ACCOUNT_A,
      direction: 'outbound',
      senderType: 'agent',
      senderId: 'agent_xyz',
      content: 'msg do agente',
    });
    await appendMessage(asClient(fake), {
      tenantId: TENANT_A,
      conversationId: convId,
      accountId: ACCOUNT_A,
      direction: 'outbound',
      senderType: 'operator',
      senderId: 'user_123',
      content: 'msg do operador',
    });
    const actors = fake.tables.audit_log.map((l) => l.actor);
    expect(actors).toContain('agent:agent_xyz');
    expect(actors).toContain('user:user_123');
  });
});

describe('listConversations', () => {
  it('filtra por status quando passado', async () => {
    const fake = new FakeSupabase();
    await upsertConversation(asClient(fake), {
      tenantId: TENANT_A,
      accountId: ACCOUNT_A,
      channel: 'email',
      channelHandle: 'a@x.com',
    });
    await upsertConversation(asClient(fake), {
      tenantId: TENANT_A,
      accountId: ACCOUNT_A,
      channel: 'email',
      channelHandle: 'b@x.com',
    });
    // marca a segunda como resolved
    if (fake.tables.conversations[1]) fake.tables.conversations[1].status = 'resolved';

    const open = await listConversations(asClient(fake), { status: 'open' });
    const resolved = await listConversations(asClient(fake), { status: 'resolved' });
    expect(open).toHaveLength(1);
    expect(resolved).toHaveLength(1);
  });
});
