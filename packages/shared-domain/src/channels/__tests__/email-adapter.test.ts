import type { ParsedMail } from 'mailparser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock antes de qualquer import que toque os módulos.
const noopMock = vi.fn().mockResolvedValue(undefined);
const sendMailMock = vi.fn();

vi.mock('imapflow', () => {
  class FakeImapFlow {
    constructor(_opts: unknown) {}
    connect = vi.fn().mockResolvedValue(undefined);
    noop = noopMock;
    logout = vi.fn().mockResolvedValue(undefined);
  }
  return { ImapFlow: FakeImapFlow };
});

vi.mock('nodemailer', () => {
  return {
    default: {
      createTransport: vi.fn().mockImplementation(() => ({
        sendMail: sendMailMock,
      })),
    },
  };
});

import { EmailAdapter } from '../adapters/email';
import type { ChannelSession } from '../types';

const SESSION: ChannelSession = {
  id: 'session-1',
  tenantId: 'tenant-1',
  channel: 'email_imap',
  identifier: 'office@example.com',
  connectionMetadata: {
    imap_host: 'imap.example.com',
    imap_port: 993,
    imap_secure: true,
    smtp_host: 'smtp.example.com',
    smtp_port: 465,
    smtp_secure: true,
  },
  secretsRef: 'env:CHANNEL_TEST_PASSWORD',
};

describe('EmailAdapter', () => {
  const adapter = new EmailAdapter();

  beforeEach(() => {
    process.env.CHANNEL_TEST_PASSWORD = 'super-secret';
    vi.clearAllMocks();
    sendMailMock.mockReset();
    noopMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.CHANNEL_TEST_PASSWORD;
  });

  describe('capabilities', () => {
    it('declara text, document, image', () => {
      expect(adapter.capabilities.supportedMediaTypes).toEqual(['text', 'document', 'image']);
      expect(adapter.capabilities.maxMessageSize).toBe(25_000_000);
      expect(adapter.capabilities.supportsTemplates).toBe(false);
      expect(adapter.capabilities.supportsOutboundOutsideWindow).toBe(true);
    });
  });

  describe('normalizeInbound — extração básica', () => {
    it('extrai sender, subject, content de e-mail simples', () => {
      const mail: ParsedMail = makeMail({
        from: 'cliente@empresa.com',
        subject: 'Dúvida DAS',
        text: 'Bom dia, preciso de ajuda com o DAS de abril.',
        messageId: '<msg-1@empresa.com>',
        date: new Date('2026-05-18T10:00:00Z'),
      });

      const result = adapter.normalizeInbound(mail);
      expect(result).toHaveLength(1);
      const msg = result[0]!;
      expect(msg.senderHandle).toBe('cliente@empresa.com');
      expect(msg.subject).toBe('Dúvida DAS');
      expect(msg.content).toBe('Bom dia, preciso de ajuda com o DAS de abril.');
      expect(msg.externalMessageId).toBe('<msg-1@empresa.com>');
      expect(msg.mediaType).toBe('text');
      expect(msg.receivedAt).toEqual(new Date('2026-05-18T10:00:00Z'));
    });

    it('normaliza endereço pra lowercase', () => {
      const mail = makeMail({
        from: 'Cliente@EMPRESA.COM',
        text: 'oi',
        messageId: '<a@b>',
      });
      const result = adapter.normalizeInbound(mail);
      expect(result[0]?.senderHandle).toBe('cliente@empresa.com');
    });

    it('extrai texto de HTML quando text está ausente', () => {
      const mail = makeMail({
        from: 'a@b.com',
        html: '<p>Olá, <b>tudo bem</b>?</p><style>p{color:red}</style>',
        messageId: '<a@b>',
      });
      delete (mail as { text?: string }).text;
      const result = adapter.normalizeInbound(mail);
      expect(result[0]?.content).toBe('Olá, tudo bem?');
    });

    it('throw quando From está faltando', () => {
      const mail = makeMail({ text: 'corpo', messageId: '<a@b>' });
      delete (mail as { from?: unknown }).from;
      expect(() => adapter.normalizeInbound(mail)).toThrow(/missing From/);
    });

    it('throw quando rawPayload não é objeto', () => {
      expect(() => adapter.normalizeInbound(null)).toThrow();
      expect(() => adapter.normalizeInbound('string')).toThrow();
    });
  });

  describe('normalizeInbound — threading', () => {
    it('nova thread: channelThreadId = próprio messageId quando sem replies', () => {
      const mail = makeMail({
        from: 'a@b.com',
        text: 'primeira',
        messageId: '<new-thread@host>',
      });
      const result = adapter.normalizeInbound(mail);
      expect(result[0]?.channelThreadId).toBe('<new-thread@host>');
    });

    it('reply: channelThreadId = inReplyTo quando sem References', () => {
      const mail = makeMail({
        from: 'a@b.com',
        text: 'resposta',
        messageId: '<reply-1@host>',
        inReplyTo: '<original@host>',
      });
      const result = adapter.normalizeInbound(mail);
      expect(result[0]?.channelThreadId).toBe('<original@host>');
    });

    it('reply de reply: channelThreadId = primeiro References (thread original)', () => {
      const mail = makeMail({
        from: 'a@b.com',
        text: 'segunda resposta',
        messageId: '<reply-2@host>',
        inReplyTo: '<reply-1@host>',
        references: ['<original@host>', '<reply-1@host>'],
      });
      const result = adapter.normalizeInbound(mail);
      expect(result[0]?.channelThreadId).toBe('<original@host>');
    });

    it('References como string (nem todo provedor manda array): pega como está', () => {
      const mail = makeMail({
        from: 'a@b.com',
        text: 'msg',
        messageId: '<m@h>',
        inReplyTo: '<x@h>',
        references: '<root@h>',
      });
      const result = adapter.normalizeInbound(mail);
      expect(result[0]?.channelThreadId).toBe('<root@h>');
    });
  });

  describe('normalizeInbound — rawPayload metadata', () => {
    it('preserva inReplyTo, references, to, cc, attachments', () => {
      const mail = makeMail({
        from: 'a@b.com',
        to: ['office@example.com', 'cc@example.com'],
        text: 'msg',
        messageId: '<m@h>',
        inReplyTo: '<parent@h>',
        references: ['<root@h>', '<parent@h>'],
        attachments: [
          {
            filename: 'fatura.pdf',
            contentType: 'application/pdf',
            size: 1024,
          },
        ],
      });
      const result = adapter.normalizeInbound(mail);
      const raw = result[0]?.rawPayload as Record<string, unknown>;
      expect(raw.inReplyTo).toBe('<parent@h>');
      expect(raw.references).toEqual(['<root@h>', '<parent@h>']);
      expect(raw.to).toEqual(['office@example.com', 'cc@example.com']);
      const attachments = raw.attachments as Array<{ filename: string }>;
      expect(attachments[0]?.filename).toBe('fatura.pdf');
    });
  });

  describe('healthCheck', () => {
    it('connected quando IMAP conecta e NOOP passa', async () => {
      const health = await adapter.healthCheck(SESSION);
      expect(health.status).toBe('connected');
    });

    it('error quando NOOP throw', async () => {
      noopMock.mockRejectedValueOnce(new Error('AUTH failed'));
      const health = await adapter.healthCheck(SESSION);
      expect(health.status).toBe('error');
      expect(health.details).toContain('AUTH failed');
    });
  });

  describe('sendMessage', () => {
    it('envia via SMTP e retorna externalMessageId do nodemailer', async () => {
      sendMailMock.mockResolvedValueOnce({ messageId: '<sent-123@example.com>' });

      const result = await adapter.sendMessage({
        session: SESSION,
        recipientHandle: 'destino@cliente.com',
        content: 'resposta do operador',
        subject: 'Re: Dúvida DAS',
      });

      expect(result.status).toBe('sent');
      if (result.status === 'sent') {
        expect(result.externalMessageId).toBe('<sent-123@example.com>');
      }

      const call = sendMailMock.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(call.from).toBe('office@example.com');
      expect(call.to).toBe('destino@cliente.com');
      expect(call.subject).toBe('Re: Dúvida DAS');
      expect(call.text).toBe('resposta do operador');
    });

    it('inclui inReplyTo e references quando passados', async () => {
      sendMailMock.mockResolvedValueOnce({ messageId: '<reply-1@example.com>' });

      await adapter.sendMessage({
        session: SESSION,
        recipientHandle: 'destino@cliente.com',
        content: 'reply',
        replyToExternalMessageId: '<original@host>',
        channelThreadId: '<thread-root@host>',
      });

      const call = sendMailMock.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(call.inReplyTo).toBe('<original@host>');
      expect(call.references).toBe('<thread-root@host>');
    });

    it('rejected quando SMTP throw', async () => {
      sendMailMock.mockRejectedValueOnce(new Error('connection refused'));
      const result = await adapter.sendMessage({
        session: SESSION,
        recipientHandle: 'dest@host.com',
        content: 'corpo',
      });
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') {
        expect(result.reason).toContain('connection refused');
      }
    });

    it('rejected quando identifier (from) está vazio', async () => {
      const noIdSession: ChannelSession = { ...SESSION, identifier: null };
      const result = await adapter.sendMessage({
        session: noIdSession,
        recipientHandle: 'dest@host.com',
        content: 'corpo',
      });
      expect(result.status).toBe('rejected');
    });
  });
});

// -----------------------------------------------------------------------------
// Helper pra construir ParsedMail-like sem precisar do parser real.
// -----------------------------------------------------------------------------

type MakeMailInput = {
  from?: string;
  to?: string | string[];
  cc?: string | string[];
  subject?: string;
  text?: string;
  html?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string | string[];
  date?: Date;
  attachments?: Array<{
    filename: string;
    contentType: string;
    size: number;
    contentId?: string;
  }>;
};

function makeMail(input: MakeMailInput): ParsedMail {
  const toAddressObject = (
    addr: string | string[] | undefined,
  ): { value: Array<{ address: string; name: string }>; text: string; html: string } | undefined => {
    if (!addr) return undefined;
    const arr = Array.isArray(addr) ? addr : [addr];
    return {
      value: arr.map((a) => ({ address: a, name: '' })),
      text: arr.join(', '),
      html: '',
    };
  };

  const mail = {
    headers: new Map(),
    headerLines: [],
    attachments: (input.attachments ?? []) as ParsedMail['attachments'],
    from: toAddressObject(input.from),
    to: toAddressObject(input.to),
    cc: toAddressObject(input.cc),
    subject: input.subject,
    text: input.text,
    html: input.html,
    messageId: input.messageId,
    inReplyTo: input.inReplyTo,
    references: input.references,
    date: input.date,
  } as unknown as ParsedMail;
  return mail;
}
