'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '@clerk/nextjs';
import { isAgentState, isChannelSessionStatus } from '@office/shared-types';
import { useRealtimeStore } from '@/lib/realtime-store';
import type {
  ApprovalSnapshot,
  ChannelSessionSnapshot,
  ConversationSnapshot,
  InitialSnapshot,
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

export const RealtimeProvider = ({ initialSnapshot, children }: Props) => {
  const { isLoaded, isSignedIn, orgId, getToken } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const hydrate = useRealtimeStore((s) => s.hydrate);
  const setSocketConnected = useRealtimeStore((s) => s.setSocketConnected);
  const updateAgentState = useRealtimeStore((s) => s.updateAgentState);
  const replaceTasks = useRealtimeStore((s) => s.replaceTasks);
  const replaceApprovals = useRealtimeStore((s) => s.replaceApprovals);
  const replaceConversations = useRealtimeStore((s) => s.replaceConversations);
  const replaceChannelSessions = useRealtimeStore((s) => s.replaceChannelSessions);
  const updateChannelSessionStatus = useRealtimeStore(
    (s) => s.updateChannelSessionStatus,
  );

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
    replaceChannelSessions,
    updateChannelSessionStatus,
  ]);

  return <>{children}</>;
};
