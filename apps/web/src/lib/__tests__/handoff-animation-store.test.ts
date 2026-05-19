import { beforeEach, describe, expect, it } from 'vitest';
import {
  HANDOFF_MAX_CONCURRENT,
  useHandoffAnimationStore,
} from '../handoff-animation-store';

const resetStore = () => {
  useHandoffAnimationStore.setState({ pending: [] });
};

describe('handoff-animation-store', () => {
  beforeEach(resetStore);

  it('enqueue gera id único e mantém ordem FIFO', () => {
    const store = useHandoffAnimationStore.getState();
    store.enqueue({
      fromAgentId: 'a1',
      toAgentKey: 'atendimento.especialista_operacional',
      traceId: 't-1',
    });
    store.enqueue({
      fromAgentId: 'a2',
      toAgentKey: 'atendimento.especialista_comercial',
      traceId: 't-2',
    });

    const pending = useHandoffAnimationStore.getState().pending;
    expect(pending).toHaveLength(2);
    expect(pending[0]?.fromAgentId).toBe('a1');
    expect(pending[1]?.fromAgentId).toBe('a2');
    expect(pending[0]?.id).not.toBe(pending[1]?.id);
    expect(pending[0]?.enqueuedAt).toBeDefined();
  });

  it('consume remove apenas o item indicado', () => {
    const store = useHandoffAnimationStore.getState();
    store.enqueue({
      fromAgentId: 'a1',
      toAgentKey: 'k1',
      traceId: 't-1',
    });
    store.enqueue({
      fromAgentId: 'a2',
      toAgentKey: 'k2',
      traceId: 't-2',
    });
    const [first] = useHandoffAnimationStore.getState().pending;
    expect(first).toBeDefined();
    useHandoffAnimationStore.getState().consume(first!.id);

    const rest = useHandoffAnimationStore.getState().pending;
    expect(rest).toHaveLength(1);
    expect(rest[0]?.fromAgentId).toBe('a2');
  });

  it('descarta enqueue após HANDOFF_MAX_CONCURRENT atingido', () => {
    const store = useHandoffAnimationStore.getState();
    for (let i = 0; i < HANDOFF_MAX_CONCURRENT; i++) {
      store.enqueue({
        fromAgentId: `a${i}`,
        toAgentKey: 'k',
        traceId: `t-${i}`,
      });
    }
    const before = useHandoffAnimationStore.getState().pending.length;
    expect(before).toBe(HANDOFF_MAX_CONCURRENT);

    store.enqueue({
      fromAgentId: 'overflow',
      toAgentKey: 'k',
      traceId: 't-overflow',
    });
    const after = useHandoffAnimationStore.getState().pending.length;
    expect(after).toBe(HANDOFF_MAX_CONCURRENT);
    expect(
      useHandoffAnimationStore
        .getState()
        .pending.some((p) => p.fromAgentId === 'overflow'),
    ).toBe(false);
  });

  it('reset esvazia a fila', () => {
    const store = useHandoffAnimationStore.getState();
    store.enqueue({ fromAgentId: 'a1', toAgentKey: 'k', traceId: 't-1' });
    store.enqueue({ fromAgentId: 'a2', toAgentKey: 'k', traceId: 't-2' });
    store.reset();
    expect(useHandoffAnimationStore.getState().pending).toHaveLength(0);
  });
});
