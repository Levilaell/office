'use client';

import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/loading-skeleton';
import { useChannelSessions, useHydrated } from '@/lib/realtime-store';
import { relativeTime } from '@/lib/relative-time';
import type { ChannelSessionSnapshot } from '@/lib/realtime-types';

// =============================================================================
// Página de canais — Sprint 1.1
//
// Lista informativa das channel_sessions do tenant. Botões "Reconectar" e
// "Editar" são placeholders (Sprint 1.1 não tem UI completa de
// configuração — config vem via seed/script). Form completo de adição é
// Fase 1.5+.
// =============================================================================

const CHANNEL_LABELS: Record<string, string> = {
  simulated_webhook: 'Webhook simulado',
  email_imap: 'E-mail (IMAP/SMTP)',
  whatsapp_evolution: 'WhatsApp (Evolution)',
  whatsapp_cloud: 'WhatsApp (Cloud API)',
};

const STATUS_CONFIG: Record<
  string,
  { label: string; tone: 'green' | 'yellow' | 'red' | 'gray' }
> = {
  connected: { label: 'Conectado', tone: 'green' },
  disconnected: { label: 'Desconectado', tone: 'gray' },
  qr_pending: { label: 'Aguardando QR', tone: 'yellow' },
  banned: { label: 'Bloqueado', tone: 'red' },
  error: { label: 'Erro', tone: 'red' },
};

const TONE_CLASSES: Record<string, string> = {
  green: 'bg-green-100 text-green-800 border-green-200',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  red: 'bg-red-100 text-red-800 border-red-200',
  gray: 'bg-gray-100 text-gray-700 border-gray-200',
};

function StatusBadge({ status }: { status: ChannelSessionSnapshot['status'] }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, tone: 'gray' };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[cfg.tone]}`}
    >
      {cfg.label}
    </span>
  );
}

function ChannelSessionCard({ session }: { session: ChannelSessionSnapshot }) {
  const channelLabel = CHANNEL_LABELS[session.channel] ?? session.channel;
  const errorMessage =
    session.errorDetails && typeof session.errorDetails === 'object'
      ? ((session.errorDetails.message as string | undefined) ??
        (session.errorDetails.reason as string | undefined))
      : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">{channelLabel}</h3>
            <StatusBadge status={session.status} />
          </div>
          <p className="mt-1 text-sm text-gray-600">
            {session.displayName ?? session.identifier ?? 'Sem identificador'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled
            className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-500 disabled:cursor-not-allowed"
            title="Em construção — Sprint 1.5+"
          >
            Editar
          </button>
          <button
            type="button"
            disabled
            className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-500 disabled:cursor-not-allowed"
            title="Em construção — Sprint 1.5+"
          >
            Reconectar
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
        <div>
          <span className="text-gray-500">Última verificação: </span>
          {session.lastHealthCheck ? relativeTime(session.lastHealthCheck) : 'nunca'}
        </div>
        <div>
          <span className="text-gray-500">Última mensagem: </span>
          {session.lastMessageAt ? relativeTime(session.lastMessageAt) : 'nunca'}
        </div>
      </div>

      {errorMessage && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          <strong>Erro:</strong> {errorMessage}
        </div>
      )}
    </div>
  );
}

export default function CanaisPage() {
  const hydrated = useHydrated();
  const sessions = useChannelSessions();

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Canais de atendimento</h1>
          <p className="mt-1 text-sm text-gray-600">
            Conexões com WhatsApp, e-mail e outros canais externos do tenant.
            Configuração via seed/script nesta fase.
          </p>
        </div>
        <button
          type="button"
          disabled
          className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          title="Em construção — Sprint 1.5+"
        >
          Adicionar canal
        </button>
      </header>

      {!hydrated ? (
        <ListSkeleton count={2} rowClassName="h-24" />
      ) : sessions.length === 0 ? (
        <EmptyState
          icon="🔌"
          title="Nenhum canal configurado ainda"
          body={
            <span>
              Use{' '}
              <code className="rounded bg-gray-100 px-1 text-gray-700">
                pnpm seed:email-channel
              </code>{' '}
              pra criar um canal de e-mail de teste, ou contate o admin pra
              conectar WhatsApp via Evolution.
            </span>
          }
        />
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <ChannelSessionCard key={s.id} session={s} />
          ))}
        </div>
      )}
    </main>
  );
}
