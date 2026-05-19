'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '@clerk/nextjs';
import { isAgentState, isChannelSessionStatus } from '@office/shared-types';
import { useHandoffAnimationStore } from '@/lib/handoff-animation-store';
import { useRealtimeStore } from '@/lib/realtime-store';
import type {
  ApprovalSnapshot,
  ChannelSessionSnapshot,
  ConversationSnapshot,
  DraftSnapshot,
  DraftStatus,
  InitialSnapshot,
  LeadSnapshot,
  LeadStatus,
  TaskSnapshot,
} from '@/lib/realtime-types';

type Props = {
  initialSnapshot: InitialSnapshot;
  children: React.ReactNode;
};

const RUNTIME_URL = process.env.NEXT_PUBLIC_AGENT_RUNTIME_URL;

const refetchTasks = async (): Promise<TaskSnapshot[]> => {
  const r = await fetch('/api/tasks/recent', { cache: 'no-store' });
  if (!r.ok) throw new Error(`tasks fetch failed: ${r.status}`);
  const body = (await r.json()) as { tasks: TaskSnapshot[] };
  return body.tasks;
};

const refetchApprovals = async (): Promise<ApprovalSnapshot[]> => {
  const r = await fetch('/api/approvals?status=pending', { cache: 'no-store' });
  if (!r.ok) throw new Error(`approvals fetch failed: ${r.status}`);
  const body = (await r.json()) as { approvals: ApprovalSnapshot[] };
  return body.approvals;
};

const refetchConversations = async (): Promise<ConversationSnapshot[]> => {
  const r = await fetch('/api/conversations?status=open', { cache: 'no-store' });
  if (!r.ok) throw new Error(`conversations fetch failed: ${r.status}`);
  const body = (await r.json()) as { conversations: ConversationSnapshot[] };
  return body.conversations;
};

const refetchChannelSessions = async (): Promise<ChannelSessionSnapshot[]> => {
  const r = await fetch('/api/atendimento/channels', { cache: 'no-store' });
  if (!r.ok) throw new Error(`channel sessions fetch failed: ${r.status}`);
  const body = (await r.json()) as { channelSessions: ChannelSessionSnapshot[] };
  return body.channelSessions;
};

const refetchLeads = async (): Promise<LeadSnapshot[]> => {
  const r = await fetch('/api/atendimento/leads', { cache: 'no-store' });
  if (!r.ok) throw new Error(`leads fetch failed: ${r.status}`);
  const body = (await r.json()) as { leads: LeadSnapshot[] };
  return body.leads;
};

const refetchDrafts = async (): Promise<DraftSnapshot[]> => {
  const r = await fetch('/api/atendimento/drafts?status=pending', {
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`drafts fetch failed: ${r.status}`);
  const body = (await r.json()) as { drafts: DraftSnapshot[] };
  return body.drafts;
};

const ALLOWED_LEAD_STATUSES: ReadonlyArray<LeadStatus> = [
  'new',
  'qualifying',
  'qualified',
  'scheduled_pending',
  'converted',
  'lost',
  'dropped',
];

const isLeadStatus = (v: unknown): v is LeadStatus =>
  typeof v === 'string' && (ALLOWED_LEAD_STATUSES as readonly string[]).includes(v);

const ALLOWED_DRAFT_STATUSES: ReadonlyArray<DraftStatus> = [
  'pending',
  'approved',
  'rejected',
  'edited',
  'expired',
  'auto_approved',
];

const isDraftStatus = (v: unknown): v is DraftStatus =>
  typeof v === 'string' && (ALLOWED_DRAFT_STATUSES as readonly string[]).includes(v);

export const RealtimeProvider = ({ initialSnapshot, children }: Props) => {
  const { isLoaded, isSignedIn, orgId, getToken } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const hydrate = useRealtimeStore((s) => s.hydrate);
  const setSocketConnected = useRealtimeStore((s) => s.setSocketConnected);
  const updateAgentState = useRealtimeStore((s) => s.updateAgentState);
  const replaceTasks = useRealtimeStore((s) => s.replaceTasks);
  const replaceApprovals = useRealtimeStore((s) => s.replaceApprovals);
  const replaceConversations = useRealtimeStore((s) => s.replaceConversations);
  const updateConversationIntent = useRealtimeStore(
    (s) => s.updateConversationIntent,
  );
  const markConversationEscalated = useRealtimeStore(
    (s) => s.markConversationEscalated,
  );
  const replaceChannelSessions = useRealtimeStore((s) => s.replaceChannelSessions);
  const updateChannelSessionStatus = useRealtimeStore(
    (s) => s.updateChannelSessionStatus,
  );
  const replaceLeads = useRealtimeStore((s) => s.replaceLeads);
  const updateLeadStatus = useRealtimeStore((s) => s.updateLeadStatus);
  const replaceDrafts = useRealtimeStore((s) => s.replaceDrafts);
  const updateDraftStatus = useRealtimeStore((s) => s.updateDraftStatus);
  const removeDraft = useRealtimeStore((s) => s.removeDraft);
  const enqueueHandoffAnim = useHandoffAnimationStore((s) => s.enqueue);

  // Hidrata o store assim que o snapshot inicial chega via prop. Idempotente.
  useEffect(() => {
    hydrate(initialSnapshot);
  }, [initialSnapshot, hydrate]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !orgId) {
      setSocketConnected(false);
      return;
    }
    if (!RUNTIME_URL) {
      console.error('[realtime] NEXT_PUBLIC_AGENT_RUNTIME_URL não definido');
      return;
    }

    let cancelled = false;
    let socket: Socket | null = null;

    (async () => {
      const token = await getToken();
      if (!token || cancelled) return;

      socket = io(RUNTIME_URL, {
        auth: { token },
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
      });

      socket.on('connect', () => setSocketConnected(true));
      socket.on('disconnect', () => setSocketConnected(false));
      socket.on('connect_error', (err) => {
        console.error('[realtime] connect_error', err.message);
      });

      // Deltas — payload carrega só IDs + transição. Estratégia:
      // - agent.state_changed: aplica direto (payload tem state + metadata)
      // - task.*: refetch da lista recente
      // - approval.*: refetch dos pending
      // Otimizar pra mergear delta vira issue de performance futura.
      socket.on('agent.state_changed', (payload: unknown) => {
        if (!payload || typeof payload !== 'object') return;
        const p = payload as {
          agentId?: unknown;
          state?: unknown;
          metadata?: unknown;
        };
        if (typeof p.agentId !== 'string' || !isAgentState(p.state)) return;
        const metadata =
          p.metadata && typeof p.metadata === 'object' && !Array.isArray(p.metadata)
            ? (p.metadata as Record<string, unknown>)
            : undefined;
        updateAgentState(p.agentId, p.state, metadata);
      });

      const onTaskEvent = () => {
        refetchTasks()
          .then(replaceTasks)
          .catch((err) => console.error('[realtime] refetch tasks', err));
      };
      socket.on('task.status_changed', onTaskEvent);
      socket.on('task.assigned', onTaskEvent);
      socket.on('task.completed', onTaskEvent);
      socket.on('task.failed', onTaskEvent);
      socket.on('task.created.global', onTaskEvent);

      const onApprovalEvent = () => {
        refetchApprovals()
          .then(replaceApprovals)
          .catch((err) => console.error('[realtime] refetch approvals', err));
      };
      socket.on('approval.created', onApprovalEvent);
      socket.on('approval.resolved', onApprovalEvent);

      // message.received: refetch a lista de conversations abertas.
      // Delta merge fica pra TD-003 junto com o refactor geral de deltas.
      const onMessageReceived = () => {
        refetchConversations()
          .then(replaceConversations)
          .catch((err) => console.error('[realtime] refetch conversations', err));
      };
      socket.on('message.received', onMessageReceived);

      // Sprint 1.2 — Coordenador atualizou intent: aplica delta direto sem
      // refetch. Payload já tem intent + decision; status do unread/last
      // message não muda nesse evento (vem por outras vias).
      const VALID_DECISIONS: ReadonlyArray<string> = [
        'respond_direct',
        'handoff_specialist',
        'escalate_human',
        'ignore',
      ];
      socket.on('conversation.intent_changed', (payload: unknown) => {
        if (!payload || typeof payload !== 'object') return;
        const p = payload as Record<string, unknown>;
        if (
          typeof p.conversationId !== 'string' ||
          typeof p.intent !== 'string' ||
          typeof p.decision !== 'string' ||
          !VALID_DECISIONS.includes(p.decision)
        ) {
          return;
        }
        updateConversationIntent(
          p.conversationId,
          p.intent,
          p.decision as 'respond_direct' | 'handoff_specialist' | 'escalate_human' | 'ignore',
        );
      });

      // Sprint 1.6 — Coordenador despachou handoff pra Especialista. Canvas
      // anima ponto colorido viajando entre avatares. Não há mudança de
      // dados — só efeito visual.
      socket.on('agent.handoff_requested', (payload: unknown) => {
        if (!payload || typeof payload !== 'object') return;
        const p = payload as {
          fromAgentId?: unknown;
          toAgentKey?: unknown;
          traceId?: unknown;
        };
        if (
          typeof p.fromAgentId !== 'string' ||
          typeof p.toAgentKey !== 'string'
        ) {
          return;
        }
        enqueueHandoffAnim({
          fromAgentId: p.fromAgentId,
          toAgentKey: p.toAgentKey,
          traceId: typeof p.traceId === 'string' ? p.traceId : 'unknown',
        });
      });

      // Sprint 1.2 — Coordenador escalou pra humano. Marca delta direto e
      // dispara refetch da lista pra capturar outbound message (T05) e
      // last_message_at atualizado.
      socket.on('agent.escalated_human', (payload: unknown) => {
        if (!payload || typeof payload !== 'object') return;
        const p = payload as Record<string, unknown>;
        if (typeof p.conversationId !== 'string') return;
        markConversationEscalated(p.conversationId);
        refetchConversations()
          .then(replaceConversations)
          .catch((err) => console.error('[realtime] refetch conversations', err));
      });

      // Sprint 1.4 — lead.status_changed: aplica delta direto se status
      // novo é válido; refetch como fallback. Cobre tanto criação inicial
      // (new) quanto transições internas.
      socket.on('lead.status_changed', (payload: unknown) => {
        if (!payload || typeof payload !== 'object') return;
        const p = payload as { leadId?: unknown; status?: unknown };
        if (typeof p.leadId !== 'string' || !isLeadStatus(p.status)) {
          refetchLeads()
            .then(replaceLeads)
            .catch((err) => console.error('[realtime] refetch leads', err));
          return;
        }
        // Se lead ainda não está no store (recém criado), refetch é mais
        // seguro do que tentar update — updateLeadStatus retorna no-op se
        // não conhece o id.
        const known = useRealtimeStore.getState().leads[p.leadId];
        if (!known) {
          refetchLeads()
            .then(replaceLeads)
            .catch((err) => console.error('[realtime] refetch leads', err));
          return;
        }
        updateLeadStatus(p.leadId, p.status);
      });

      // Sprint 1.4 — lead.qualified: refetch pra trazer qualification_data
      // atualizada (resumo de slots vai no payload mas store precisa do
      // record completo; cheaper than payload merge logic).
      socket.on('lead.qualified', () => {
        refetchLeads()
          .then(replaceLeads)
          .catch((err) => console.error('[realtime] refetch leads', err));
      });

      // Sprint 1.5 — drafts. created/approved/edited/rejected/expired.
      // Estratégia: payload tem campos suficientes pra delta inteligente,
      // mas refetch é mais robusto (lista de pending muda) e mais simples
      // do que merge condicional por status. Trade-off conhecido (TD-003).
      const onDraftChanged = (): void => {
        refetchDrafts()
          .then(replaceDrafts)
          .catch((err) => console.error('[realtime] refetch drafts', err));
      };
      socket.on('draft.created', onDraftChanged);
      socket.on('draft.approved', (payload: unknown) => {
        if (payload && typeof payload === 'object') {
          const p = payload as { draftId?: unknown };
          if (typeof p.draftId === 'string') {
            // Aplica delta direto: vira approved E sai da lista pending.
            updateDraftStatus(p.draftId, 'approved');
            removeDraft(p.draftId);
          }
        }
        onDraftChanged();
      });
      socket.on('draft.edited', (payload: unknown) => {
        if (payload && typeof payload === 'object') {
          const p = payload as { draftId?: unknown };
          if (typeof p.draftId === 'string') {
            updateDraftStatus(p.draftId, 'edited');
            removeDraft(p.draftId);
          }
        }
        onDraftChanged();
      });
      socket.on('draft.rejected', (payload: unknown) => {
        if (payload && typeof payload === 'object') {
          const p = payload as { draftId?: unknown };
          if (typeof p.draftId === 'string') {
            updateDraftStatus(p.draftId, 'rejected');
            removeDraft(p.draftId);
          }
        }
        onDraftChanged();
      });
      socket.on('draft.expired', (payload: unknown) => {
        if (payload && typeof payload === 'object') {
          const p = payload as { draftId?: unknown; status?: unknown };
          if (typeof p.draftId === 'string') {
            const status = isDraftStatus(p.status) ? p.status : 'expired';
            updateDraftStatus(p.draftId, status);
            removeDraft(p.draftId);
          }
        }
        onDraftChanged();
      });

      // channel_session.status_changed: aplicação direta do delta (payload
      // tem status novo). Refetch como fallback se status vier inválido.
      socket.on('channel_session.status_changed', (payload: unknown) => {
        if (!payload || typeof payload !== 'object') return;
        const p = payload as { sessionId?: unknown; status?: unknown };
        if (typeof p.sessionId !== 'string' || !isChannelSessionStatus(p.status)) {
          refetchChannelSessions()
            .then(replaceChannelSessions)
            .catch((err) => console.error('[realtime] refetch channel sessions', err));
          return;
        }
        updateChannelSessionStatus(p.sessionId, p.status);
      });

      socketRef.current = socket;
    })().catch((err) => {
      if (!cancelled) console.error('[realtime] handshake falhou', err);
    });

    return () => {
      cancelled = true;
      const s = socketRef.current ?? socket;
      if (s) {
        s.removeAllListeners();
        s.disconnect();
      }
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [
    isLoaded,
    isSignedIn,
    orgId,
    getToken,
    setSocketConnected,
    updateAgentState,
    replaceTasks,
    replaceApprovals,
    replaceConversations,
    updateConversationIntent,
    markConversationEscalated,
    replaceChannelSessions,
    updateChannelSessionStatus,
    replaceLeads,
    updateLeadStatus,
    replaceDrafts,
    updateDraftStatus,
    removeDraft,
    enqueueHandoffAnim,
  ]);

  return <>{children}</>;
};
