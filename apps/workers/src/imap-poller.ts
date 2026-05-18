// =============================================================================
// IMAP Poller — Sprint 1.1
//
// A cada N segundos varre todas as channel_sessions com `channel='email_imap'`
// (independente de tenant — usa service_role pra contornar RLS), e pra cada
// sessão "connected" busca mensagens UNSEEN, normaliza via EmailAdapter,
// ingere via ingestNormalizedMessages, marca SEEN, atualiza last_message_at.
//
// AccountId é resolvido via `connection_metadata.default_account_id` da
// sessão — Sprint 1.1 não tem mapeamento sender→account; toda mensagem que
// chega na inbox vai pra essa conta. Multi-account por inbox é Sprint 1.5+.
//
// Worker NÃO depende de Clerk nem de Next.js. Standalone Node ESM, conexão
// direta Supabase + Redis (via shared-events).
// =============================================================================

import { ImapFlow } from 'imapflow';
import { simpleParser, type ParsedMail } from 'mailparser';
import {
  EmailAdapter,
  getChannelAdapter,
  getChannelSessionsByChannel,
  ingestNormalizedMessages,
  parseEmailConnectionMetadata,
  toChannelSession,
  updateChannelSessionStatus,
  type ChannelSessionRow,
  type ServiceRoleClient,
} from '@office/shared-domain';

export type PollerConfig = {
  supabase: ServiceRoleClient;
  intervalMs: number;
};

export type SessionPollResult = {
  sessionId: string;
  messagesIngested: number;
  status: 'ok' | 'error';
  error?: string;
};

const log = (msg: string): void => console.log(`[imap-poller] ${msg}`);

// -----------------------------------------------------------------------------
// pollOneSession — toda a lógica per-session, exportada pra teste manual.
// -----------------------------------------------------------------------------
export const pollOneSession = async (
  supabase: ServiceRoleClient,
  row: ChannelSessionRow,
): Promise<SessionPollResult> => {
  const sessionId = row.id;
  const tenantId = row.tenant_id;

  // 1. Valida connection_metadata e resolve default_account_id.
  let accountId: string | undefined;
  try {
    const meta = parseEmailConnectionMetadata(row.connection_metadata as Record<string, unknown>);
    accountId = meta.default_account_id;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateChannelSessionStatus(supabase, {
      sessionId,
      tenantId,
      status: 'error',
      errorDetails: { reason: 'invalid_connection_metadata', message },
    });
    return { sessionId, messagesIngested: 0, status: 'error', error: message };
  }

  if (!accountId) {
    const message =
      'connection_metadata.default_account_id missing — não posso roteamento sem destino';
    await updateChannelSessionStatus(supabase, {
      sessionId,
      tenantId,
      status: 'error',
      errorDetails: { reason: 'missing_default_account_id' },
    });
    return { sessionId, messagesIngested: 0, status: 'error', error: message };
  }

  // 2. Resolve adapter + monta config IMAP.
  const adapter = (await getChannelAdapter('email_imap')) as EmailAdapter;
  let imapConfig;
  try {
    imapConfig = adapter.buildImapConfig(toChannelSession(row));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateChannelSessionStatus(supabase, {
      sessionId,
      tenantId,
      status: 'error',
      errorDetails: { reason: 'invalid_imap_config', message },
    });
    return { sessionId, messagesIngested: 0, status: 'error', error: message };
  }

  // 3. Conecta e processa.
  const client = new ImapFlow(imapConfig);
  let processed = 0;
  let lastMessageAt: Date | undefined;
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      // Pulla UNSEEN. Após processar com sucesso, marca SEEN — idempotência
      // não-perfeita (se crash entre ingest e SEEN, releita). Aceita: ingest
      // é idempotente em (tenant, channel, channel_handle, externalMessageId)
      // de fato; mas como messages não tem unique nesse field hoje, podem
      // duplicar. TD: idempotência forte via metadata.external_id check.
      for await (const message of client.fetch(
        { seen: false },
        { source: true, envelope: true, uid: true },
      )) {
        try {
          if (!message.source) {
            log(`session ${sessionId} msg uid=${message.uid} sem source — pulando`);
            continue;
          }
          const parsed: ParsedMail = await simpleParser(message.source);
          const normalized = adapter.normalizeInbound(parsed);
          await ingestNormalizedMessages(supabase, {
            tenantId,
            accountId,
            channel: 'email_imap',
            sessionId,
            messages: normalized,
          });
          await client.messageFlagsAdd({ uid: message.uid }, ['\\Seen'], { uid: true });
          processed += normalized.length;
          if (parsed.date instanceof Date) lastMessageAt = parsed.date;
        } catch (msgErr) {
          // Falha em mensagem individual não derruba o batch — loga e segue.
          const errMsg = msgErr instanceof Error ? msgErr.message : String(msgErr);
          log(`session ${sessionId} msg uid=${message.uid} failed: ${errMsg}`);
        }
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateChannelSessionStatus(supabase, {
      sessionId,
      tenantId,
      status: 'error',
      errorDetails: { reason: 'imap_connection_failed', message },
    });
    return { sessionId, messagesIngested: processed, status: 'error', error: message };
  } finally {
    await client.logout().catch(() => undefined);
  }

  // 4. Marca sucesso (status='connected' se vinha de erro; atualiza timestamps).
  await updateChannelSessionStatus(supabase, {
    sessionId,
    tenantId,
    status: 'connected',
    ...(lastMessageAt !== undefined && { lastMessageAt }),
  });

  return { sessionId, messagesIngested: processed, status: 'ok' };
};

// -----------------------------------------------------------------------------
// pollAllSessions — chamado periodicamente. Itera sobre TODAS as sessões
// email_imap (qualquer tenant, status connected OU error pra tentar de novo).
// Status 'disconnected' é intencional — operador "pausou" e não queremos
// reconectar sem ação humana.
// -----------------------------------------------------------------------------
export const pollAllSessions = async (
  supabase: ServiceRoleClient,
): Promise<SessionPollResult[]> => {
  const connected = await getChannelSessionsByChannel(supabase, 'email_imap', 'connected');
  const errored = await getChannelSessionsByChannel(supabase, 'email_imap', 'error');
  const sessions = [...connected, ...errored];
  if (sessions.length === 0) return [];

  log(`polling ${sessions.length} session(s)`);
  const results: SessionPollResult[] = [];
  for (const row of sessions) {
    try {
      const result = await pollOneSession(supabase, row);
      results.push(result);
      const tag = result.status === 'ok' ? 'ok' : `error: ${result.error}`;
      log(`session ${result.sessionId} → ${tag} (${result.messagesIngested} msgs)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(`session ${row.id} unhandled error: ${message}`);
      results.push({ sessionId: row.id, messagesIngested: 0, status: 'error', error: message });
    }
  }
  return results;
};

// -----------------------------------------------------------------------------
// startPollLoop — agenda polls recorrentes. Idempotente entre ticks: se um
// tick estourar o intervalo (IMAP lento), o próximo só dispara após terminar
// o anterior — sem overlap.
// -----------------------------------------------------------------------------
export type PollLoopHandle = {
  stop: () => Promise<void>;
};

export const startPollLoop = (config: PollerConfig): PollLoopHandle => {
  let stopped = false;
  let inFlight: Promise<unknown> | null = null;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    inFlight = pollAllSessions(config.supabase).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      log(`tick failed: ${message}`);
    });
    await inFlight;
    inFlight = null;
    if (stopped) return;
    timeoutHandle = setTimeout(() => void tick(), config.intervalMs);
  };

  let timeoutHandle: NodeJS.Timeout = setTimeout(() => void tick(), 0);

  return {
    stop: async (): Promise<void> => {
      stopped = true;
      clearTimeout(timeoutHandle);
      if (inFlight) await inFlight.catch(() => undefined);
    },
  };
};
