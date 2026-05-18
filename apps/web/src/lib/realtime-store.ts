import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { AgentState, Department } from '@office/shared-types';
import type {
  AgentSnapshot,
  ApprovalSnapshot,
  ChannelSessionSnapshot,
  ConversationLastDecision,
  ConversationSnapshot,
  InitialSnapshot,
  TaskSnapshot,
} from './realtime-types';

export type RealtimeState = {
  agents: Record<string, AgentSnapshot>;
  tasks: Record<string, TaskSnapshot>;
  approvals: Record<string, ApprovalSnapshot>;
  conversations: Record<string, ConversationSnapshot>;
  channelSessions: Record<string, ChannelSessionSnapshot>;
  hydrated: boolean;
  socketConnected: boolean;

  hydrate: (snapshot: InitialSnapshot) => void;
  setSocketConnected: (connected: boolean) => void;

  upsertAgent: (snap: AgentSnapshot) => void;
  updateAgentState: (
    id: string,
    state: AgentState,
    metadata?: Record<string, unknown>,
  ) => void;
  upsertTask: (snap: TaskSnapshot) => void;
  replaceTasks: (snaps: TaskSnapshot[]) => void;
  upsertApproval: (snap: ApprovalSnapshot) => void;
  replaceApprovals: (snaps: ApprovalSnapshot[]) => void;
  removeApproval: (id: string) => void;
  upsertConversation: (snap: ConversationSnapshot) => void;
  replaceConversations: (snaps: ConversationSnapshot[]) => void;
  updateConversationIntent: (
    id: string,
    intent: string,
    decision: ConversationLastDecision,
  ) => void;
  markConversationEscalated: (id: string) => void;
  replaceChannelSessions: (snaps: ChannelSessionSnapshot[]) => void;
  updateChannelSessionStatus: (
    id: string,
    status: ChannelSessionSnapshot['status'],
  ) => void;
};

const indexById = <T extends { id: string }>(items: T[]): Record<string, T> => {
  const result: Record<string, T> = {};
  for (const item of items) result[item.id] = item;
  return result;
};

export const useRealtimeStore = create<RealtimeState>((set) => ({
  agents: {},
  tasks: {},
  approvals: {},
  conversations: {},
  channelSessions: {},
  hydrated: false,
  socketConnected: false,

  hydrate: (snapshot) =>
    set({
      agents: indexById(snapshot.agents),
      tasks: indexById(snapshot.tasks),
      approvals: indexById(snapshot.approvals),
      conversations: indexById(snapshot.conversations),
      channelSessions: indexById(snapshot.channelSessions),
      hydrated: true,
    }),

  setSocketConnected: (connected) => set({ socketConnected: connected }),

  upsertAgent: (snap) =>
    set((cur) => ({ agents: { ...cur.agents, [snap.id]: snap } })),

  updateAgentState: (id, state, metadata) =>
    set((cur) => {
      const existing = cur.agents[id];
      if (!existing) return cur;
      return {
        agents: {
          ...cur.agents,
          [id]: {
            ...existing,
            state,
            ...(metadata !== undefined && { stateMetadata: metadata }),
          },
        },
      };
    }),

  upsertTask: (snap) => set((cur) => ({ tasks: { ...cur.tasks, [snap.id]: snap } })),

  replaceTasks: (snaps) => set({ tasks: indexById(snaps) }),

  upsertApproval: (snap) =>
    set((cur) => ({ approvals: { ...cur.approvals, [snap.id]: snap } })),

  replaceApprovals: (snaps) => set({ approvals: indexById(snaps) }),

  removeApproval: (id) =>
    set((cur) => {
      if (!(id in cur.approvals)) return cur;
      const next = { ...cur.approvals };
      delete next[id];
      return { approvals: next };
    }),

  upsertConversation: (snap) =>
    set((cur) => ({ conversations: { ...cur.conversations, [snap.id]: snap } })),

  replaceConversations: (snaps) => set({ conversations: indexById(snaps) }),

  updateConversationIntent: (id, intent, decision) =>
    set((cur) => {
      const existing = cur.conversations[id];
      if (!existing) return cur;
      return {
        conversations: {
          ...cur.conversations,
          [id]: { ...existing, intentCurrent: intent, lastDecision: decision },
        },
      };
    }),

  markConversationEscalated: (id) =>
    set((cur) => {
      const existing = cur.conversations[id];
      if (!existing) return cur;
      return {
        conversations: {
          ...cur.conversations,
          [id]: { ...existing, assignedToHuman: true, lastDecision: 'escalate_human' },
        },
      };
    }),

  replaceChannelSessions: (snaps) => set({ channelSessions: indexById(snaps) }),

  updateChannelSessionStatus: (id, status) =>
    set((cur) => {
      const existing = cur.channelSessions[id];
      if (!existing) return cur;
      return {
        channelSessions: {
          ...cur.channelSessions,
          [id]: { ...existing, status },
        },
      };
    }),
}));

// -----------------------------------------------------------------------------
// Selectors públicos — única superfície que componentes devem consumir.
//
// Selectors que retornam ARRAY derivado (Object.values, filter, slice) usam
// useShallow — sem isso, cada render cria ref nova e o useSyncExternalStore do
// Zustand entra em loop ("getServerSnapshot should be cached"). Selectors que
// retornam ref estável (lookup por id, primitivo) dispensam shallow.
// -----------------------------------------------------------------------------

export const useAgents = (): AgentSnapshot[] =>
  useRealtimeStore(useShallow((s) => Object.values(s.agents)));

export const useAgent = (id: string | null | undefined): AgentSnapshot | null =>
  useRealtimeStore((s) => (id ? (s.agents[id] ?? null) : null));

export const useAgentsByDepartment = (dept: Department): AgentSnapshot[] =>
  useRealtimeStore(
    useShallow((s) => Object.values(s.agents).filter((a) => a.department === dept)),
  );

export const usePendingApprovals = (): ApprovalSnapshot[] =>
  useRealtimeStore(
    useShallow((s) => Object.values(s.approvals).filter((a) => a.status === 'pending')),
  );

export const useApproval = (id: string | null | undefined): ApprovalSnapshot | null =>
  useRealtimeStore((s) => (id ? (s.approvals[id] ?? null) : null));

export const useTask = (id: string | null | undefined): TaskSnapshot | null =>
  useRealtimeStore((s) => (id ? (s.tasks[id] ?? null) : null));

export const useRecentTasks = (limit = 20): TaskSnapshot[] =>
  useRealtimeStore(
    useShallow((s) => {
      const all = Object.values(s.tasks);
      all.sort((a, b) =>
        a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
      );
      return all.slice(0, limit);
    }),
  );

// Ordena por lastMessageAt DESC, com nulls por último — conversations recém
// criadas sem mensagem entram no fim e desempate por createdAt seria útil mas
// snapshot não carrega o createdAt; mantém estável por id como tie-breaker.
// Helper puro pra ser testável sem render React.
export const sortConversationsByLastMessage = (
  items: ConversationSnapshot[],
): ConversationSnapshot[] => {
  const all = items.slice();
  all.sort((a, b) => {
    const av = a.lastMessageAt;
    const bv = b.lastMessageAt;
    if (av === bv) return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return av < bv ? 1 : -1;
  });
  return all;
};

export const useConversations = (): ConversationSnapshot[] =>
  useRealtimeStore(
    useShallow((s) => sortConversationsByLastMessage(Object.values(s.conversations))),
  );

export const useConversation = (
  id: string | null | undefined,
): ConversationSnapshot | null =>
  useRealtimeStore((s) => (id ? (s.conversations[id] ?? null) : null));

export const useChannelSessions = (): ChannelSessionSnapshot[] =>
  useRealtimeStore(
    useShallow((s) => {
      const all = Object.values(s.channelSessions);
      all.sort((a, b) => (a.channel < b.channel ? -1 : a.channel > b.channel ? 1 : 0));
      return all;
    }),
  );

export const useHydrated = (): boolean => useRealtimeStore((s) => s.hydrated);
export const useSocketConnected = (): boolean =>
  useRealtimeStore((s) => s.socketConnected);
