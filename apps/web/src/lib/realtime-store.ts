import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { AgentState, Department } from '@office/shared-types';
import type {
  AgentSnapshot,
  ApprovalSnapshot,
  ChannelSessionSnapshot,
  ConversationLastDecision,
  ConversationSnapshot,
  DraftSnapshot,
  DraftStatus,
  InitialSnapshot,
  LeadSnapshot,
  LeadStatus,
  TaskSnapshot,
} from './realtime-types';

export type RealtimeState = {
  agents: Record<string, AgentSnapshot>;
  tasks: Record<string, TaskSnapshot>;
  approvals: Record<string, ApprovalSnapshot>;
  conversations: Record<string, ConversationSnapshot>;
  channelSessions: Record<string, ChannelSessionSnapshot>;
  leads: Record<string, LeadSnapshot>;
  drafts: Record<string, DraftSnapshot>;
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
  upsertLead: (snap: LeadSnapshot) => void;
  replaceLeads: (snaps: LeadSnapshot[]) => void;
  updateLeadStatus: (id: string, status: LeadStatus) => void;
  upsertDraft: (snap: DraftSnapshot) => void;
  replaceDrafts: (snaps: DraftSnapshot[]) => void;
  updateDraftStatus: (id: string, status: DraftStatus) => void;
  removeDraft: (id: string) => void;
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
  leads: {},
  drafts: {},
  hydrated: false,
  socketConnected: false,

  hydrate: (snapshot) =>
    set({
      agents: indexById(snapshot.agents),
      tasks: indexById(snapshot.tasks),
      approvals: indexById(snapshot.approvals),
      conversations: indexById(snapshot.conversations),
      channelSessions: indexById(snapshot.channelSessions),
      leads: indexById(snapshot.leads),
      drafts: indexById(snapshot.drafts),
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

  upsertLead: (snap) =>
    set((cur) => ({ leads: { ...cur.leads, [snap.id]: snap } })),

  replaceLeads: (snaps) => set({ leads: indexById(snaps) }),

  updateLeadStatus: (id, status) =>
    set((cur) => {
      const existing = cur.leads[id];
      if (!existing) return cur;
      return {
        leads: {
          ...cur.leads,
          [id]: { ...existing, status },
        },
      };
    }),

  upsertDraft: (snap) =>
    set((cur) => ({ drafts: { ...cur.drafts, [snap.id]: snap } })),

  replaceDrafts: (snaps) => set({ drafts: indexById(snaps) }),

  updateDraftStatus: (id, status) =>
    set((cur) => {
      const existing = cur.drafts[id];
      if (!existing) return cur;
      return {
        drafts: {
          ...cur.drafts,
          [id]: { ...existing, status },
        },
      };
    }),

  removeDraft: (id) =>
    set((cur) => {
      if (!(id in cur.drafts)) return cur;
      const next = { ...cur.drafts };
      delete next[id];
      return { drafts: next };
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

// Sprint 1.4 — leads
export const useLeads = (): LeadSnapshot[] =>
  useRealtimeStore(
    useShallow((s) => {
      const all = Object.values(s.leads);
      all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
      return all;
    }),
  );

export const useLead = (id: string | null | undefined): LeadSnapshot | null =>
  useRealtimeStore((s) => (id ? (s.leads[id] ?? null) : null));

export const useLeadsByStatus = (
  status: LeadStatus | ReadonlyArray<LeadStatus>,
): LeadSnapshot[] => {
  const filterFn = (l: LeadSnapshot): boolean =>
    Array.isArray(status) ? status.includes(l.status) : l.status === status;
  return useRealtimeStore(
    useShallow((s) => {
      const all = Object.values(s.leads).filter(filterFn);
      all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
      return all;
    }),
  );
};

// Sprint 1.5 — drafts. Ordena pending por expires_at ASC (mais urgentes
// primeiro); nulls/sem expiração no fim. Tie-break por createdAt DESC.
const sortByExpiresThenCreated = (a: DraftSnapshot, b: DraftSnapshot): number => {
  const ae = a.expiresAt;
  const be = b.expiresAt;
  if (ae === be) {
    return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
  }
  if (ae === null) return 1;
  if (be === null) return -1;
  return ae < be ? -1 : 1;
};

export const usePendingDrafts = (): DraftSnapshot[] =>
  useRealtimeStore(
    useShallow((s) =>
      Object.values(s.drafts)
        .filter((d) => d.status === 'pending')
        .sort(sortByExpiresThenCreated),
    ),
  );

export const useDraftsByConversation = (conversationId: string): DraftSnapshot[] =>
  useRealtimeStore(
    useShallow((s) =>
      Object.values(s.drafts)
        .filter((d) => d.conversationId === conversationId)
        .sort((a, b) =>
          a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
        ),
    ),
  );

export const usePendingDraftByConversation = (
  conversationId: string,
): DraftSnapshot | null =>
  useRealtimeStore((s) => {
    for (const d of Object.values(s.drafts)) {
      if (d.conversationId === conversationId && d.status === 'pending') return d;
    }
    return null;
  });

export const useDraft = (id: string | null | undefined): DraftSnapshot | null =>
  useRealtimeStore((s) => (id ? (s.drafts[id] ?? null) : null));

// Sprint 1.6 — helpers puros pra contar drafts pending. Extraídos como
// funções puras (sem hook) pra serem testáveis sem testing-library.
export const countPendingDraftsForAgent = (
  drafts: Record<string, DraftSnapshot>,
  agentId: string,
): number => {
  let count = 0;
  for (const d of Object.values(drafts)) {
    if (d.agentId === agentId && d.status === 'pending') count += 1;
  }
  return count;
};

export const groupPendingDraftCountsByAgent = (
  drafts: Record<string, DraftSnapshot>,
): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const d of Object.values(drafts)) {
    if (d.status !== 'pending') continue;
    out[d.agentId] = (out[d.agentId] ?? 0) + 1;
  }
  return out;
};

// Count de drafts pending vinculados a um agente. Usado pelo canvas pra
// render badge sobre o avatar do agente. Retorna primitivo (number) —
// não precisa de useShallow, identidade é estável trivialmente.
export const useAgentDraftCount = (agentId: string): number =>
  useRealtimeStore((s) => countPendingDraftsForAgent(s.drafts, agentId));

// Mapa agentId → count usado por componentes que precisam de todas as contagens
// em um único snapshot (ex: passar pro PixiJS scene em batch).
export const useDraftCountsByAgent = (): Record<string, number> =>
  useRealtimeStore(useShallow((s) => groupPendingDraftCountsByAgent(s.drafts)));
