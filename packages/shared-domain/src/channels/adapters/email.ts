// =============================================================================
// EmailAdapter — IMAP polling (ingestão) + SMTP send (outbound).
//
// Conexão IMAP NÃO vive no adapter (stateless por contrato). O worker
// (apps/workers) abre/fecha a sessão IMAP por ciclo de poll, busca mensagens
// novas, roda `simpleParser` da mailparser e chama `normalizeInbound` com
// cada ParsedMail.
//
// Threading: usa Message-ID + In-Reply-To + References. `channelThreadId`
// reflete a thread original (primeiro elemento de References se houver,
// senão In-Reply-To, senão o próprio Message-ID — começo de thread).
//
// HTML rico: nesta Fase, pega `text` (plain) ou strip simples de `html`.
// E-mail comum (clientes contábeis usando Gmail/Outlook) funciona; HTML
// complexo é TD se aparecer (`docs/tech-debt.md`).
// =============================================================================

import type { AddressObject, ParsedMail } from 'mailparser';
import { ImapFlow, type ImapFlowOptions } from 'imapflow';
import nodemailer, { type Transporter } from 'nodemailer';
import { z } from 'zod';
import type {
  ChannelAdapter,
  ChannelCapabilities,
  ChannelHealth,
  ChannelSession,
  MediaType,
  NormalizedInboundMessage,
  OutboundMessage,
  SendResult,
} from '../types';
import { resolveSecretRef } from '../secrets';

// -----------------------------------------------------------------------------
// Schema esperado em connection_metadata.
//
// `default_account_id` é como a ingest helper resolve accountId — Sprint 1.1
// não tem mapeamento sender→account; toda mensagem que chega na inbox vai pra
// uma única conta. Refactor pra multi-conta vira Sprint 1.5+ se aparecer.
// -----------------------------------------------------------------------------
export const EmailConnectionMetadataSchema = z.object({
  imap_host: z.string().min(1),
  imap_port: z.number().int().min(1).max(65535).default(993),
  imap_secure: z.boolean().default(true),
  smtp_host: z.string().min(1),
  smtp_port: z.number().int().min(1).max(65535).default(465),
  smtp_secure: z.boolean().default(true),
  default_account_id: z.string().uuid().optional(),
});

export type EmailConnectionMetadata = z.infer<typeof EmailConnectionMetadataSchema>;

export const parseEmailConnectionMetadata = (
  raw: Record<string, unknown>,
): EmailConnectionMetadata => EmailConnectionMetadataSchema.parse(raw);

// -----------------------------------------------------------------------------
// Helpers de extração do ParsedMail
// -----------------------------------------------------------------------------

const firstAddress = (addr: AddressObject | AddressObject[] | undefined): string | null => {
  if (!addr) return null;
  const objs = Array.isArray(addr) ? addr : [addr];
  for (const obj of objs) {
    if (obj.value && obj.value.length > 0) {
      const first = obj.value[0];
      if (first?.address) return first.address.toLowerCase();
    }
  }
  return null;
};

const extractContent = (mail: ParsedMail): string => {
  if (typeof mail.text === 'string' && mail.text.trim().length > 0) {
    return mail.text.trim();
  }
  if (typeof mail.html === 'string' && mail.html.length > 0) {
    // Strip leve. Conteúdo rico vai pra rawPayload — quando aparecer
    // necessidade, trocar por dompurify/sanitize-html no TD.
    return mail.html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return '';
};

const deriveThreadId = (mail: ParsedMail): string => {
  // Prefere o início real da thread (primeira referência), depois o pai
  // imediato (in-reply-to), por último o próprio messageId (nova thread).
  if (mail.references) {
    const refs = Array.isArray(mail.references) ? mail.references : [mail.references];
    if (refs.length > 0 && refs[0]) return refs[0];
  }
  if (mail.inReplyTo) return mail.inReplyTo;
  if (mail.messageId) return mail.messageId;
  // Sem nenhum header de identidade. Forja id local — não vai bater com
  // threading futuro, mas pelo menos não quebra a estrutura. Audit ainda
  // captura o evento.
  return `<no-id-${crypto.randomUUID()}@local>`;
};

const inferMediaType = (mail: ParsedMail): MediaType => {
  // Nesta Fase, mediaType é sempre 'text' pra e-mail. Anexos são apenas
  // listados em rawPayload (sem download/storage).
  if (mail.attachments && mail.attachments.length > 0) {
    // Mantém 'text' mesmo com anexo — UI mostra o corpo, anexo fica em
    // metadata.raw_payload.attachments pra acesso futuro.
    return 'text';
  }
  return 'text';
};

// -----------------------------------------------------------------------------
// Adapter
// -----------------------------------------------------------------------------

export class EmailAdapter implements ChannelAdapter {
  readonly channel = 'email_imap' as const;
  readonly capabilities: ChannelCapabilities = {
    supportsTemplates: false,
    supportsOutboundOutsideWindow: true,
    windowDurationHours: null,
    maxMessageSize: 25_000_000,
    supportedMediaTypes: ['text', 'document', 'image'],
  };

  async connect(_session: ChannelSession): Promise<void> {
    // IMAP é stateless do ponto de vista do adapter — worker abre e fecha
    // conexão por ciclo de poll. healthCheck verifica credenciais.
  }

  async disconnect(_session: ChannelSession): Promise<void> {}

  async healthCheck(session: ChannelSession): Promise<ChannelHealth> {
    let client: ImapFlow | null = null;
    try {
      const config = this.buildImapConfig(session);
      client = new ImapFlow(config);
      await client.connect();
      await client.noop();
      return { status: 'connected', lastCheck: new Date() };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: 'error', lastCheck: new Date(), details: message };
    } finally {
      if (client) {
        await client.logout().catch(() => undefined);
      }
    }
  }

  normalizeInbound(rawPayload: unknown): NormalizedInboundMessage[] {
    const mail = rawPayload as ParsedMail;
    if (!mail || typeof mail !== 'object') {
      throw new Error('EmailAdapter.normalizeInbound: expected ParsedMail object');
    }
    const senderHandle = firstAddress(mail.from);
    if (!senderHandle) {
      throw new Error('EmailAdapter.normalizeInbound: missing From address');
    }
    const externalId = mail.messageId ?? `<no-id-${crypto.randomUUID()}@local>`;
    const threadId = deriveThreadId(mail);
    const content = extractContent(mail);
    const subject = typeof mail.subject === 'string' ? mail.subject : undefined;
    const receivedAt = mail.date instanceof Date ? mail.date : new Date();

    const attachmentsMeta = (mail.attachments ?? []).map((a) => ({
      filename: a.filename ?? null,
      contentType: a.contentType ?? null,
      size: a.size ?? null,
      contentId: a.contentId ?? null,
    }));

    const rawForMetadata: Record<string, unknown> = {
      messageId: externalId,
      inReplyTo: mail.inReplyTo ?? null,
      references: mail.references ?? null,
      to: this.extractAddresses(mail.to),
      cc: this.extractAddresses(mail.cc),
      ...(attachmentsMeta.length > 0 && { attachments: attachmentsMeta }),
    };

    return [
      {
        senderHandle,
        channelThreadId: threadId,
        externalMessageId: externalId,
        content,
        mediaType: inferMediaType(mail),
        ...(subject !== undefined && { subject }),
        receivedAt,
        rawPayload: rawForMetadata,
      },
    ];
  }

  async sendMessage(input: OutboundMessage): Promise<SendResult> {
    try {
      const transporter = this.buildSmtpTransporter(input.session);
      const from = input.session.identifier ?? '';
      if (!from) {
        return {
          status: 'rejected',
          reason: 'channel_session.identifier missing — cannot derive From address',
        };
      }

      const info = await transporter.sendMail({
        from,
        to: input.recipientHandle,
        subject: input.subject ?? '(sem assunto)',
        text: input.content,
        ...(input.replyToExternalMessageId && { inReplyTo: input.replyToExternalMessageId }),
        ...(input.channelThreadId && { references: input.channelThreadId }),
      });

      return {
        status: 'sent',
        sentAt: new Date(),
        externalMessageId: info.messageId,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: 'rejected', reason: `SMTP error: ${message}` };
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers privados (públicos pra worker usar a config IMAP direto).
  // ---------------------------------------------------------------------------

  buildImapConfig(session: ChannelSession): ImapFlowOptions {
    const metadata = parseEmailConnectionMetadata(session.connectionMetadata);
    const password = resolveSecretRef(session.secretsRef);
    if (!password) {
      throw new Error('EmailAdapter: IMAP password not resolved (secrets_ref missing)');
    }
    const user = session.identifier;
    if (!user) {
      throw new Error('EmailAdapter: session.identifier required for IMAP user');
    }
    return {
      host: metadata.imap_host,
      port: metadata.imap_port,
      secure: metadata.imap_secure,
      auth: { user, pass: password },
      logger: false,
    };
  }

  buildSmtpTransporter(session: ChannelSession): Transporter {
    const metadata = parseEmailConnectionMetadata(session.connectionMetadata);
    const password = resolveSecretRef(session.secretsRef);
    if (!password) {
      throw new Error('EmailAdapter: SMTP password not resolved (secrets_ref missing)');
    }
    const user = session.identifier;
    if (!user) {
      throw new Error('EmailAdapter: session.identifier required for SMTP user');
    }
    return nodemailer.createTransport({
      host: metadata.smtp_host,
      port: metadata.smtp_port,
      secure: metadata.smtp_secure,
      auth: { user, pass: password },
    });
  }

  private extractAddresses(
    addr: AddressObject | AddressObject[] | undefined,
  ): string[] {
    if (!addr) return [];
    const objs = Array.isArray(addr) ? addr : [addr];
    const out: string[] = [];
    for (const obj of objs) {
      for (const v of obj.value ?? []) {
        if (v.address) out.push(v.address.toLowerCase());
      }
    }
    return out;
  }
}
