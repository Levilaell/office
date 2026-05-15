import { beforeEach, describe, expect, it } from 'vitest';
import { useRealtimeStore } from '../realtime-store';
import type {
  AgentSnapshot,
  ApprovalSnapshot,
  InitialSnapshot,
  TaskSnapshot,
} from '../realtime-types';

const agent = (over: Partial<AgentSnapshot> = {}): AgentSnapshot => ({
  id: 'a1',
  agentKey: 'router',
  name: 'Roteador',
  description: null,
  department: 'platform',
  role: 'router',
  state: 'idle',
  stateMetadata: {},
  tier: 'triage',
  autonomyTier: 'autonomo',
  ...over,
});

const task = (over: Partial<TaskSnapshot> = {}): TaskSnapshot => ({
  id: 't1',
  status: 'pending',
  taskType: 'triagem',
  assignedAgentId: null,
  accountId: null,
  traceId: 'trace-1',
  result: null,
  createdAt: '2026-05-15T10:00:00.000Z',
  updatedAt: '2026-05-15T10:00:00.000Z',
  completedAt: null,
  ...over,
});

const approval = (over: Partial<ApprovalSnapshot> = {}): ApprovalSnapshot => ({
  id: 'ap1',
  taskId: 't1',
  agentId: 'a1',
  status: 'pending',
  actionType: 'reply_message',
  proposal: {},
  context: {},
  reviewerUserId: null,
  decision: null,
  decidedAt: null,
  expiresAt: null,
  createdAt: '2026-05-15T10:00:00.000Z',
  ...over,
});

const resetStore = () => {
  useRealtimeStore.setState({
    agents: {},
    tasks: {},
    approvals: {},
    hydrated: false,
    socketConnected: false,
  });
};

describe('realtime-store', () => {
  beforeEach(resetStore);

  it('hydrate popula agents, tasks e approvals e marca hydrated', () => {
    const snap: InitialSnapshot = {
      agents: [agent({ id: 'a1' }), agent({ id: 'a2', agentKey: 'coord-fiscal' })],
      tasks: [task({ id: 't1' }), task({ id: 't2' })],
      approvals: [approval({ id: 'ap1' })],
    };

    useRealtimeStore.getState().hydrate(snap);
    const state = useRealtimeStore.getState();

    expect(state.hydrated).toBe(true);
    expect(Object.keys(state.agents)).toEqual(['a1', 'a2']);
    expect(state.tasks.t1?.taskType).toBe('triagem');
    expect(state.approvals.ap1?.status).toBe('pending');
  });

  it('upsertAgent adiciona e atualiza por id', () => {
    useRealtimeStore.getState().upsertAgent(agent({ id: 'a1', name: 'A' }));
    expect(useRealtimeStore.getState().agents.a1?.name).toBe('A');

    useRealtimeStore.getState().upsertAgent(agent({ id: 'a1', name: 'A modificado' }));
    expect(useRealtimeStore.getState().agents.a1?.name).toBe('A modificado');
    expect(Object.keys(useRealtimeStore.getState().agents)).toHaveLength(1);
  });

  it('updateAgentState modifica state e metadata sem perder outros campos', () => {
    useRealtimeStore.getState().upsertAgent(agent({ id: 'a1', name: 'Roteador' }));
    useRealtimeStore
      .getState()
      .updateAgentState('a1', 'working', { runId: 'r-42' });

    const a = useRealtimeStore.getState().agents.a1;
    expect(a?.state).toBe('working');
    expect(a?.stateMetadata).toEqual({ runId: 'r-42' });
    expect(a?.name).toBe('Roteador');
  });

  it('updateAgentState em agent inexistente é no-op', () => {
    useRealtimeStore.getState().updateAgentState('fantasma', 'working');
    expect(useRealtimeStore.getState().agents.fantasma).toBeUndefined();
  });

  it('upsertTask e replaceTasks', () => {
    useRealtimeStore.getState().upsertTask(task({ id: 't1' }));
    useRealtimeStore.getState().upsertTask(task({ id: 't2' }));
    expect(Object.keys(useRealtimeStore.getState().tasks)).toHaveLength(2);

    useRealtimeStore.getState().replaceTasks([task({ id: 't3' })]);
    expect(Object.keys(useRealtimeStore.getState().tasks)).toEqual(['t3']);
  });

  it('upsertApproval e removeApproval', () => {
    useRealtimeStore.getState().upsertApproval(approval({ id: 'ap1' }));
    useRealtimeStore.getState().upsertApproval(approval({ id: 'ap2' }));
    expect(Object.keys(useRealtimeStore.getState().approvals)).toHaveLength(2);

    useRealtimeStore.getState().removeApproval('ap1');
    expect(useRealtimeStore.getState().approvals.ap1).toBeUndefined();
    expect(useRealtimeStore.getState().approvals.ap2?.id).toBe('ap2');
  });

  it('setSocketConnected toggles flag', () => {
    expect(useRealtimeStore.getState().socketConnected).toBe(false);
    useRealtimeStore.getState().setSocketConnected(true);
    expect(useRealtimeStore.getState().socketConnected).toBe(true);
    useRealtimeStore.getState().setSocketConnected(false);
    expect(useRealtimeStore.getState().socketConnected).toBe(false);
  });
});
