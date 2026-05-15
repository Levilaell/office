import { create } from 'zustand';
import type { AgentState, Department } from '@office/shared-types';
import type {
  AgentSnapshot,
  ApprovalSnapshot,
  InitialSnapshot,
  TaskSnapshot,
} from './realtime-types';

export type RealtimeState = {
  agents: Record<string, AgentSnapshot>;
  tasks: Record<string, TaskSnapshot>;
  approvals: Record<string, ApprovalSnapshot>;
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
  hydrated: false,
  socketConnected: false,

  hydrate: (snapshot) =>
    set({
      agents: indexById(snapshot.agents),
      tasks: indexById(snapshot.tasks),
      approvals: indexById(snapshot.approvals),
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
}));

// -----------------------------------------------------------------------------
// Selectors públicos — única superfície que componentes devem consumir.
// -----------------------------------------------------------------------------

export const useAgents = (): AgentSnapshot[] =>
  useRealtimeStore((s) => Object.values(s.agents));

export const useAgent = (id: string | null | undefined): AgentSnapshot | null =>
  useRealtimeStore((s) => (id ? (s.agents[id] ?? null) : null));

export const useAgentsByDepartment = (dept: Department): AgentSnapshot[] =>
  useRealtimeStore((s) =>
    Object.values(s.agents).filter((a) => a.department === dept),
  );

export const usePendingApprovals = (): ApprovalSnapshot[] =>
  useRealtimeStore((s) =>
    Object.values(s.approvals).filter((a) => a.status === 'pending'),
  );

export const useApproval = (id: string | null | undefined): ApprovalSnapshot | null =>
  useRealtimeStore((s) => (id ? (s.approvals[id] ?? null) : null));

export const useTask = (id: string | null | undefined): TaskSnapshot | null =>
  useRealtimeStore((s) => (id ? (s.tasks[id] ?? null) : null));

export const useRecentTasks = (limit = 20): TaskSnapshot[] =>
  useRealtimeStore((s) => {
    const all = Object.values(s.tasks);
    all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    return all.slice(0, limit);
  });

export const useHydrated = (): boolean => useRealtimeStore((s) => s.hydrated);
export const useSocketConnected = (): boolean =>
  useRealtimeStore((s) => s.socketConnected);
