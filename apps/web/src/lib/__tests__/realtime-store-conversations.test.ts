import { beforeEach, describe, expect, it } from 'vitest';
import {
  sortConversationsByLastMessage,
  useRealtimeStore,
} from '../realtime-store';
import type { ConversationSnapshot } from '../realtime-types';

const conversation = (over: Partial<ConversationSnapshot> = {}): ConversationSnapshot => ({
  id: 'c1',
  accountId: '00000000-0000-4000-8000-000000000001',
  channel: 'simulated_webhook',
  channelHandle: 'cliente@example.com',
  status: 'open',
  subject: null,
  lastMessageAt: '2026-05-15T10:00:00.000Z',
  unreadCount: 0,
  intentCurrent: null,
  lastDecision: null,
  assignedToHuman: false,
  ...over,
});

const resetStore = () => {
  useRealtimeStore.setState({
    agents: {},
    tasks: {},
    approvals: {},
    conversations: {},
    hydrated: false,
    socketConnected: false,
  });
};

describe('realtime-store conversations', () => {
  beforeEach(resetStore);

  it('upsertConversation adiciona e atualiza por id sem perder outros entries', () => {
    useRealtimeStore.getState().upsertConversation(conversation({ id: 'c1', unreadCount: 0 }));
    useRealtimeStore.getState().upsertConversation(conversation({ id: 'c2', unreadCount: 3 }));
    expect(Object.keys(useRealtimeStore.getState().conversations)).toHaveLength(2);

    useRealtimeStore.getState().upsertConversation(conversation({ id: 'c1', unreadCount: 7 }));
    expect(useRealtimeStore.getState().conversations.c1?.unreadCount).toBe(7);
    expect(useRealtimeStore.getState().conversations.c2?.unreadCount).toBe(3);
  });

  it('replaceConversations substitui o conjunto inteiro', () => {
    useRealtimeStore.getState().upsertConversation(conversation({ id: 'c1' }));
    useRealtimeStore.getState().upsertConversation(conversation({ id: 'c2' }));
    useRealtimeStore.getState().replaceConversations([
      conversation({ id: 'c3' }),
      conversation({ id: 'c4' }),
    ]);

    const ids = Object.keys(useRealtimeStore.getState().conversations).sort();
    expect(ids).toEqual(['c3', 'c4']);
  });

  it('hydrate popula conversations do snapshot inicial', () => {
    useRealtimeStore.getState().hydrate({
      agents: [],
      tasks: [],
      approvals: [],
      conversations: [
        conversation({ id: 'c1' }),
        conversation({ id: 'c2', status: 'open' }),
      ],
      channelSessions: [],
      leads: [],
    });
    expect(Object.keys(useRealtimeStore.getState().conversations)).toEqual(['c1', 'c2']);
    expect(useRealtimeStore.getState().hydrated).toBe(true);
  });

  it('updateConversationIntent atualiza intent e decision sem perder demais campos', () => {
    useRealtimeStore.getState().upsertConversation(
      conversation({ id: 'c1', unreadCount: 3 }),
    );
    useRealtimeStore
      .getState()
      .updateConversationIntent('c1', 'operacional.status_obrigacao', 'handoff_specialist');
    const c = useRealtimeStore.getState().conversations.c1;
    expect(c?.intentCurrent).toBe('operacional.status_obrigacao');
    expect(c?.lastDecision).toBe('handoff_specialist');
    expect(c?.unreadCount).toBe(3);
  });

  it('updateConversationIntent é no-op se conversation não existe', () => {
    useRealtimeStore
      .getState()
      .updateConversationIntent('inexistente', 'social.saudacao', 'respond_direct');
    expect(useRealtimeStore.getState().conversations.inexistente).toBeUndefined();
  });

  it('markConversationEscalated marca assignedToHuman + lastDecision escalate', () => {
    useRealtimeStore.getState().upsertConversation(conversation({ id: 'c1' }));
    useRealtimeStore.getState().markConversationEscalated('c1');
    const c = useRealtimeStore.getState().conversations.c1;
    expect(c?.assignedToHuman).toBe(true);
    expect(c?.lastDecision).toBe('escalate_human');
  });
});

describe('sortConversationsByLastMessage', () => {
  it('ordena por lastMessageAt DESC com nulls por último', () => {
    const ordered = sortConversationsByLastMessage([
      conversation({ id: 'old', lastMessageAt: '2026-05-15T09:00:00.000Z' }),
      conversation({ id: 'newest', lastMessageAt: '2026-05-15T12:00:00.000Z' }),
      conversation({ id: 'novel', lastMessageAt: null }),
      conversation({ id: 'mid', lastMessageAt: '2026-05-15T10:30:00.000Z' }),
    ]);
    expect(ordered.map((c) => c.id)).toEqual(['newest', 'mid', 'old', 'novel']);
  });

  it('é estável por id quando lastMessageAt empata (inclusive nulls)', () => {
    const ordered = sortConversationsByLastMessage([
      conversation({ id: 'b', lastMessageAt: null }),
      conversation({ id: 'a', lastMessageAt: null }),
      conversation({ id: 'd', lastMessageAt: '2026-05-15T10:00:00.000Z' }),
      conversation({ id: 'c', lastMessageAt: '2026-05-15T10:00:00.000Z' }),
    ]);
    expect(ordered.map((c) => c.id)).toEqual(['c', 'd', 'a', 'b']);
  });

  it('não muta o array original', () => {
    const input = [
      conversation({ id: 'b', lastMessageAt: '2026-05-15T09:00:00.000Z' }),
      conversation({ id: 'a', lastMessageAt: '2026-05-15T10:00:00.000Z' }),
    ];
    const snapshot = input.map((c) => c.id);
    sortConversationsByLastMessage(input);
    expect(input.map((c) => c.id)).toEqual(snapshot);
  });
});
