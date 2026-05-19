import { beforeEach, describe, expect, it } from 'vitest';
import {
  countPendingDraftsForAgent,
  groupPendingDraftCountsByAgent,
  useRealtimeStore,
} from '../realtime-store';
import type { DraftSnapshot, DraftStatus } from '../realtime-types';

const draft = (over: Partial<DraftSnapshot> & { id: string }): DraftSnapshot => ({
  id: over.id,
  conversationId: over.conversationId ?? `conv-${over.id}`,
  agentId: over.agentId ?? 'agent-1',
  status: over.status ?? ('pending' as DraftStatus),
  proposedContent: over.proposedContent ?? 'rascunho',
  reasoning: over.reasoning ?? null,
  confidence: over.confidence ?? null,
  resolvedBy: over.resolvedBy ?? null,
  resolvedAt: over.resolvedAt ?? null,
  finalMessageId: over.finalMessageId ?? null,
  expiresAt: over.expiresAt ?? null,
  createdAt: over.createdAt ?? '2026-05-21T10:00:00.000Z',
  editDiff: over.editDiff ?? null,
  decisionMetadata: over.decisionMetadata ?? null,
});

const resetStore = () => {
  useRealtimeStore.setState({
    agents: {},
    tasks: {},
    approvals: {},
    conversations: {},
    channelSessions: {},
    leads: {},
    drafts: {},
    hydrated: false,
    socketConnected: false,
  });
};

describe('countPendingDraftsForAgent', () => {
  beforeEach(resetStore);

  it('retorna 0 quando agente não tem drafts pending', () => {
    expect(countPendingDraftsForAgent({}, 'agent-1')).toBe(0);
  });

  it('conta apenas drafts pending vinculados ao agente', () => {
    const drafts = {
      d1: draft({ id: 'd1', agentId: 'agent-1', status: 'pending' }),
      d2: draft({ id: 'd2', agentId: 'agent-1', status: 'pending' }),
      d3: draft({ id: 'd3', agentId: 'agent-1', status: 'approved' }),
      d4: draft({ id: 'd4', agentId: 'agent-2', status: 'pending' }),
    };
    expect(countPendingDraftsForAgent(drafts, 'agent-1')).toBe(2);
    expect(countPendingDraftsForAgent(drafts, 'agent-2')).toBe(1);
    expect(countPendingDraftsForAgent(drafts, 'agent-9')).toBe(0);
  });

  it('ignora drafts em status diferente de pending', () => {
    const drafts = {
      d1: draft({ id: 'd1', agentId: 'agent-1', status: 'approved' }),
      d2: draft({ id: 'd2', agentId: 'agent-1', status: 'edited' }),
      d3: draft({ id: 'd3', agentId: 'agent-1', status: 'rejected' }),
      d4: draft({ id: 'd4', agentId: 'agent-1', status: 'expired' }),
      d5: draft({ id: 'd5', agentId: 'agent-1', status: 'auto_approved' }),
    };
    expect(countPendingDraftsForAgent(drafts, 'agent-1')).toBe(0);
  });
});

describe('groupPendingDraftCountsByAgent', () => {
  it('retorna mapa vazio quando não há drafts pending', () => {
    const drafts = {
      d1: draft({ id: 'd1', agentId: 'agent-1', status: 'approved' }),
    };
    expect(groupPendingDraftCountsByAgent(drafts)).toEqual({});
  });

  it('agrupa contagem por agentId apenas pra pending', () => {
    const drafts = {
      d1: draft({ id: 'd1', agentId: 'agent-1', status: 'pending' }),
      d2: draft({ id: 'd2', agentId: 'agent-1', status: 'pending' }),
      d3: draft({ id: 'd3', agentId: 'agent-2', status: 'pending' }),
      d4: draft({ id: 'd4', agentId: 'agent-1', status: 'approved' }),
    };
    expect(groupPendingDraftCountsByAgent(drafts)).toEqual({
      'agent-1': 2,
      'agent-2': 1,
    });
  });
});

describe('realtime-store drafts integration', () => {
  beforeEach(resetStore);

  it('upsertDraft + replaceDrafts mantêm selectors consistentes', () => {
    const store = useRealtimeStore.getState();
    store.upsertDraft(draft({ id: 'd1', agentId: 'agent-1', status: 'pending' }));
    store.upsertDraft(draft({ id: 'd2', agentId: 'agent-1', status: 'pending' }));

    expect(
      countPendingDraftsForAgent(useRealtimeStore.getState().drafts, 'agent-1'),
    ).toBe(2);

    store.replaceDrafts([draft({ id: 'd3', agentId: 'agent-2', status: 'pending' })]);
    expect(
      countPendingDraftsForAgent(useRealtimeStore.getState().drafts, 'agent-1'),
    ).toBe(0);
    expect(
      groupPendingDraftCountsByAgent(useRealtimeStore.getState().drafts),
    ).toEqual({ 'agent-2': 1 });
  });
});
