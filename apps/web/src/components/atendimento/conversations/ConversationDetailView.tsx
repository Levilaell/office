'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '@clerk/nextjs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { relativeTime } from '@/lib/relative-time';
import type {
  ConversationDetailSnapshot,
  ConversationClassificationSnapshot,
  DraftSnapshot,
  LeadSnapshot,
  MessageSnapshot,
} from '@/lib/realtime-types';

const RUNTIME_URL = process.env.NEXT_PUBLIC_AGENT_RUNTIME_URL;

const DECISION_LABEL: Record<
  ConversationClassificationSnapshot['decision'],
  string
> = {
  respond_direct: 'Resposta direta',
  handoff_specialist: 'Handoff p/ especialista',
  escalate_human: 'Escalou humano',
  ignore: 'Ignorou',
};

const DRAFT_STATUS_LABEL: Record<DraftSnapshot['status'], string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  edited: 'Editado',
  expired: 'Expirou',
  auto_approved: 'Auto-aprovado',
};

const DRAFT_STATUS_CLASS: Record<DraftSnapshot['status'], string> = {
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-300 border-red-500/30',
  edited: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  expired: 'bg-neutral-500/15 text-neutral-300 border-neutral-500/30',
  auto_approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

type AccountSummary = {
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string | null;
};

type Props = {
  initialDetail: ConversationDetailSnapshot;
  accountSummary: AccountSummary | null;
};

const contactNameFromLead = (lead: LeadSnapshot | null): string | null => {
  if (!lead) return null;
  const data = lead.qualificationData;
  if (typeof data.contact_name === 'string' && data.contact_name.trim().length > 0) {
    return data.contact_name;
  }
  return null;
};

const resolveHeaderName = (
  detail: ConversationDetailSnapshot,
  account: AccountSummary | null,
): string => {
  const fromLead = contactNameFromLead(detail.lead);
  if (fromLead) return fromLead;
  if (account?.razaoSocial) return account.razaoSocial;
  return detail.conversation.channelHandle;
};

export function ConversationDetailView({
  initialDetail,
  accountSummary,
}: Props) {
  const [detail, setDetail] = useState<ConversationDetailSnapshot>(initialDetail);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [refetching, setRefetching] = useState<boolean>(false);
  const socketRef = useRef<Socket | null>(null);
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const conversationId = detail.conversation.id;

  const refetch = useCallback(async () => {
    setRefetching(true);
    try {
      const r = await fetch(`/api/atendimento/conversations/${conversationId}`, {
        cache: 'no-store',
      });
      if (!r.ok) throw new Error(`refetch failed: ${r.status}`);
      const next = (await r.json()) as ConversationDetailSnapshot;
      setDetail(next);
    } catch (err) {
      console.error('[ConversationDetailView] refetch', err);
    } finally {
      setRefetching(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !RUNTIME_URL) return;

    let cancelled = false;
    let socket: Socket | null = null;

    (async () => {
      const token = await getToken();
      if (!token || cancelled) return;

      socket = io(RUNTIME_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
      });

      const onMessage = (payload: unknown) => {
        if (!payload || typeof payload !== 'object') return;
        const p = payload as { conversationId?: unknown };
        if (p.conversationId === conversationId) {
          void refetch();
        }
      };

      // Refetch também em eventos que mudam o estado da conversa: intent
      // (classification nova), drafts (criação/aprovação) e leads.
      const onAnyRelevant = () => {
        void refetch();
      };

      socket.on('message.received', onMessage);
      socket.on('conversation.intent_changed', onMessage);
      socket.on('agent.escalated_human', onMessage);
      socket.on('draft.created', onAnyRelevant);
      socket.on('draft.approved', onAnyRelevant);
      socket.on('draft.edited', onAnyRelevant);
      socket.on('draft.rejected', onAnyRelevant);
      socket.on('draft.expired', onAnyRelevant);
      socket.on('lead.qualified', onAnyRelevant);
      socket.on('lead.status_changed', onAnyRelevant);

      socketRef.current = socket;
    })().catch((err) =>
      console.error('[ConversationDetailView] socket connect', err),
    );

    return () => {
      cancelled = true;
      const s = socketRef.current ?? socket;
      if (s) {
        s.removeAllListeners();
        s.disconnect();
      }
      socketRef.current = null;
    };
  }, [isLoaded, isSignedIn, getToken, conversationId, refetch]);

  const headerName = resolveHeaderName(detail, accountSummary);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      <Link
        href="/dashboard/atendimento/inbox"
        className="text-xs text-neutral-400 hover:text-neutral-200"
      >
        ← Voltar pro inbox
      </Link>
      <header className="mt-3 flex flex-wrap items-baseline justify-between gap-3 border-b border-neutral-800 pb-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
            {headerName}
          </h1>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {detail.conversation.channelHandle} · canal {detail.conversation.channel}
            {detail.conversation.subject ? ` · ${detail.conversation.subject}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className="capitalize">
            {detail.conversation.status}
          </Badge>
          {detail.conversation.assignedToHuman && (
            <Badge
              variant="outline"
              className="border-amber-500/40 bg-amber-500/15 text-amber-300"
            >
              Aguardando humano
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={refetching}
          >
            {refetching ? 'Atualizando…' : 'Atualizar'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-pressed={sidebarOpen}
            title="Mostrar/ocultar painel lateral"
          >
            {sidebarOpen ? 'Ocultar detalhes' : 'Mostrar detalhes'}
          </Button>
        </div>
      </header>

      <div
        className={`mt-4 grid gap-6 ${
          sidebarOpen ? 'lg:grid-cols-[1fr_320px]' : 'grid-cols-1'
        }`}
      >
        <Timeline messages={detail.messages} />
        {sidebarOpen && (
          <Sidebar detail={detail} accountSummary={accountSummary} />
        )}
      </div>
    </div>
  );
}

function Timeline({ messages }: { messages: MessageSnapshot[] }) {
  if (messages.length === 0) {
    return (
      <Card className="flex items-center justify-center border-dashed bg-card/40 p-10 text-center text-sm text-muted-foreground">
        Nenhuma mensagem nesta conversa ainda.
      </Card>
    );
  }
  return (
    <ol className="flex flex-col gap-3" aria-label="Histórico de mensagens">
      {messages.map((m) => (
        <MessageRow key={m.id} message={m} />
      ))}
    </ol>
  );
}

function MessageRow({ message }: { message: MessageSnapshot }) {
  if (message.senderType === 'system') {
    return (
      <li className="flex justify-center">
        <span className="rounded-full border border-neutral-800 bg-neutral-900/60 px-3 py-1 text-[11px] text-neutral-500">
          {message.content} · {relativeTime(message.createdAt)}
        </span>
      </li>
    );
  }

  const isInbound = message.direction === 'inbound';
  return (
    <li
      className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm ${
          isInbound
            ? 'border border-neutral-800 bg-neutral-900 text-neutral-100'
            : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-50'
        }`}
      >
        <div className="text-xs font-semibold text-neutral-400">
          {isInbound ? 'Cliente' : senderLabel(message)}
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words">{message.content}</p>
        <div className="mt-1 text-[10px] text-neutral-500">
          {relativeTime(message.createdAt)}
        </div>
      </div>
    </li>
  );
}

function senderLabel(message: MessageSnapshot): string {
  switch (message.senderType) {
    case 'agent':
      return 'Agente';
    case 'operator':
      return 'Operador';
    case 'system':
      return 'Sistema';
    case 'end_client':
      return 'Cliente';
  }
}

function Sidebar({
  detail,
  accountSummary,
}: {
  detail: ConversationDetailSnapshot;
  accountSummary: AccountSummary | null;
}) {
  return (
    <aside className="flex flex-col gap-4">
      <Card className="p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Intent atual
        </h2>
        <p className="mt-2 text-sm font-medium text-foreground">
          {detail.conversation.intentCurrent ?? 'Sem classificação ainda'}
        </p>
        {detail.conversation.lastDecision && (
          <p className="mt-1 text-xs text-muted-foreground">
            Última decisão: {DECISION_LABEL[detail.conversation.lastDecision]}
          </p>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Histórico de classificações
        </h2>
        {detail.classifications.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Sem classificações registradas.
          </p>
        ) : (
          <ul className="mt-2 space-y-2 text-xs">
            {detail.classifications.slice(0, 8).map((c) => (
              <li
                key={c.id}
                className="rounded-md border border-neutral-800 bg-neutral-900/60 px-2 py-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <code className="truncate text-neutral-200">{c.intent}</code>
                  <span className="shrink-0 text-[10px] text-neutral-500">
                    {relativeTime(c.createdAt)}
                  </span>
                </div>
                <div className="mt-0.5 text-[10px] text-neutral-400">
                  {DECISION_LABEL[c.decision]}
                  {c.confidence !== null
                    ? ` · ${Math.round(c.confidence * 100)}%`
                    : ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {accountSummary && (
        <Card className="p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Account
          </h2>
          <p className="mt-2 text-sm font-medium text-foreground">
            {accountSummary.razaoSocial}
          </p>
          {accountSummary.nomeFantasia && (
            <p className="text-xs text-muted-foreground">
              {accountSummary.nomeFantasia}
            </p>
          )}
          {accountSummary.cnpj && (
            <code className="mt-1 block text-[10px] text-neutral-500">
              CNPJ {accountSummary.cnpj}
            </code>
          )}
        </Card>
      )}

      {detail.lead && <LeadCard lead={detail.lead} />}

      <Card className="p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Rascunhos vinculados
        </h2>
        {detail.drafts.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Nenhum draft criado para esta conversa.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {detail.drafts.map((d) => (
              <li
                key={d.id}
                className="rounded-md border border-neutral-800 bg-neutral-900/60 px-2 py-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    variant="outline"
                    className={DRAFT_STATUS_CLASS[d.status]}
                  >
                    {DRAFT_STATUS_LABEL[d.status]}
                  </Badge>
                  <span className="text-[10px] text-neutral-500">
                    {relativeTime(d.createdAt)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-neutral-300">
                  {d.proposedContent}
                </p>
                {d.status === 'pending' && (
                  <Link
                    href="/dashboard/atendimento/inbox"
                    className="mt-1 inline-block text-[10px] text-amber-300 underline-offset-2 hover:underline"
                  >
                    Decidir no inbox →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </aside>
  );
}

function LeadCard({ lead }: { lead: LeadSnapshot }) {
  return (
    <Card className="p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
        Lead
      </h2>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-medium capitalize text-foreground">
          {lead.status.replace(/_/g, ' ')}
        </span>
        <span className="text-[10px] text-neutral-500">
          {relativeTime(lead.createdAt)}
        </span>
      </div>
      {lead.estimatedValueMonthly !== null && (
        <p className="mt-1 text-xs text-neutral-400">
          Valor mensal estimado: R$ {lead.estimatedValueMonthly.toLocaleString('pt-BR')}
        </p>
      )}
      {lead.notes && (
        <p className="mt-2 whitespace-pre-wrap text-xs text-neutral-400">
          {lead.notes}
        </p>
      )}
      <SlotsSummary qualificationData={lead.qualificationData} />
    </Card>
  );
}

const SLOT_LABEL: Record<string, string> = {
  contact_name: 'Nome',
  business_name: 'Empresa',
  cnpj: 'CNPJ',
  regime: 'Regime',
  team_size: 'Tamanho equipe',
  pain_point: 'Dor principal',
  timing: 'Prazo',
  scheduled_at: 'Horário sugerido',
};

function SlotsSummary({
  qualificationData,
}: {
  qualificationData: Record<string, unknown>;
}) {
  const entries = Object.entries(qualificationData).filter(
    ([, v]) => v !== null && v !== undefined && v !== '',
  );
  if (entries.length === 0) return null;
  return (
    <dl className="mt-3 grid grid-cols-1 gap-1 text-[11px]">
      {entries.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-2">
          <dt className="text-neutral-500">{SLOT_LABEL[k] ?? k}</dt>
          <dd className="truncate text-right text-neutral-300">
            {typeof v === 'string' || typeof v === 'number'
              ? String(v)
              : JSON.stringify(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
