'use client';

import { useEffect, useState } from 'react';
import {
  useAtendimentoPendingDraftsCount,
  useChannelSessions,
  useHydrated,
  useLatestConversationMessageAt,
} from '@/lib/realtime-store';
import { relativeTime } from '@/lib/relative-time';
import type { ChannelSessionSnapshot } from '@/lib/realtime-types';
import type { ChannelSessionStatus, ChannelType } from '@office/shared-types';

// Sprint 1.6 — HUD overlay sobre o canvas mostrando saúde da sala
// Atendimento: status dos canais, drafts pending, última mensagem.
//
// Decisão simplificada (sprint 1.6, fallback documentado): HUD sempre
// visível no canto enquanto canvas está montado. Detecção de "câmera
// na sala Atendimento" depende de zoom/pan que não existe ainda. Quando
// existirem, dá pra esconder o HUD quando câmera está em outra sala.
// Registrado como TD pra Fase 2+.

const CHANNEL_LABEL: Record<ChannelType, string> = {
  simulated_webhook: 'Webhook simulado',
  email_imap: 'E-mail',
  whatsapp_evolution: 'WhatsApp',
  whatsapp_cloud: 'WhatsApp Cloud',
};

const STATUS_INDICATOR: Record<ChannelSessionStatus, { color: string; label: string }> =
  {
    connected: { color: 'bg-emerald-400', label: 'Conectado' },
    disconnected: { color: 'bg-neutral-500', label: 'Desconectado' },
    qr_pending: { color: 'bg-amber-400', label: 'QR pendente' },
    banned: { color: 'bg-red-500', label: 'Banido' },
    error: { color: 'bg-red-500', label: 'Erro' },
  };

const useNow = (intervalMs = 30_000): Date => {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
};

export function AtendimentoRoomHud() {
  const hydrated = useHydrated();
  const channels = useChannelSessions();
  const pendingDrafts = useAtendimentoPendingDraftsCount();
  const lastMessageAt = useLatestConversationMessageAt();
  const now = useNow();

  if (!hydrated) {
    return (
      <div className="pointer-events-none absolute right-4 top-4 z-20 w-64 rounded-md border border-neutral-800 bg-neutral-900/90 p-3 text-xs text-neutral-500 shadow-lg backdrop-blur">
        Carregando estado da sala…
      </div>
    );
  }

  return (
    <div
      className="pointer-events-auto absolute right-4 top-4 z-20 flex w-64 flex-col gap-3 rounded-md border border-neutral-800 bg-neutral-900/90 p-3 text-xs text-neutral-200 shadow-lg backdrop-blur"
      aria-label="Saúde da sala Atendimento"
    >
      <header className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
          Sala Atendimento
        </span>
        {pendingDrafts > 0 && (
          <span
            className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300"
            title="Drafts pendentes de aprovação"
          >
            {pendingDrafts} draft{pendingDrafts === 1 ? '' : 's'}
          </span>
        )}
      </header>

      <section aria-labelledby="hud-channels">
        <h3
          id="hud-channels"
          className="mb-1 text-[10px] uppercase tracking-wider text-neutral-500"
        >
          Canais
        </h3>
        {channels.length === 0 ? (
          <p className="text-neutral-500">
            Nenhum canal conectado.{' '}
            <a
              href="/dashboard/atendimento/canais"
              className="text-neutral-300 underline-offset-2 hover:underline"
            >
              Conectar
            </a>
          </p>
        ) : (
          <ul className="space-y-1.5">
            {channels.map((ch) => (
              <ChannelRow key={ch.id} channel={ch} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="hud-activity">
        <h3
          id="hud-activity"
          className="mb-1 text-[10px] uppercase tracking-wider text-neutral-500"
        >
          Última mensagem
        </h3>
        <p className="text-neutral-300">
          {lastMessageAt ? relativeTime(lastMessageAt, now) : 'Nenhuma ainda'}
        </p>
      </section>
    </div>
  );
}

function ChannelRow({ channel }: { channel: ChannelSessionSnapshot }) {
  const indicator = STATUS_INDICATOR[channel.status];
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 truncate">
        <span
          className={`inline-block h-2 w-2 shrink-0 rounded-full ${indicator.color}`}
          aria-hidden
        />
        <span className="truncate text-neutral-300" title={CHANNEL_LABEL[channel.channel]}>
          {CHANNEL_LABEL[channel.channel]}
        </span>
      </span>
      <span
        className="shrink-0 text-[10px] text-neutral-500"
        title={`Status: ${indicator.label}`}
      >
        {indicator.label}
      </span>
    </li>
  );
}
