import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

// Sprint 1.6 — fila de animações de handoff entre agentes.
//
// RealtimeProvider escuta `agent.handoff_requested` e enfileira items aqui.
// OfficeCanvas resolve cada item (fromAgentId/toAgentKey → posição na sala)
// e dispara animação via SceneApi, drenando o item da fila.
//
// Limite máximo de 5 animações concorrentes — extras são descartadas (com
// log) pra evitar fluido visual confuso. Aceitável porque no volume Fase 1
// (1 cliente real) é raríssimo passar de 5 handoffs simultâneos.

const MAX_CONCURRENT_ANIMATIONS = 5;

export type PendingHandoff = {
  /** ID único da animação — usado pra drenagem após dispatch. */
  id: string;
  fromAgentId: string;
  /** Sprint 1.2 — payload do handoff carrega `agentKey`, não UUID, porque o
   *  Coordenador conhece o destino por função. Canvas resolve via lookup
   *  no store de agents. */
  toAgentKey: string;
  /** Pra correlação com audit_log/Langfuse. */
  traceId: string;
  /** ISO timestamp do enqueue — debugging. */
  enqueuedAt: string;
};

type HandoffAnimationState = {
  pending: PendingHandoff[];
  enqueue: (input: Omit<PendingHandoff, 'id' | 'enqueuedAt'>) => void;
  consume: (id: string) => void;
  /** Apaga tudo — útil em testes e cleanup de canvas. */
  reset: () => void;
};

let counter = 0;
const nextId = (): string => {
  counter += 1;
  return `handoff-${Date.now()}-${counter}`;
};

export const useHandoffAnimationStore = create<HandoffAnimationState>((set) => ({
  pending: [],
  enqueue: (input) =>
    set((cur) => {
      if (cur.pending.length >= MAX_CONCURRENT_ANIMATIONS) {
        console.warn(
          `[handoff-animation] fila cheia (${MAX_CONCURRENT_ANIMATIONS}) — descartando handoff ${input.fromAgentId} → ${input.toAgentKey}`,
        );
        return cur;
      }
      return {
        pending: [
          ...cur.pending,
          {
            ...input,
            id: nextId(),
            enqueuedAt: new Date().toISOString(),
          },
        ],
      };
    }),
  consume: (id) =>
    set((cur) => ({
      pending: cur.pending.filter((p) => p.id !== id),
    })),
  reset: () => set({ pending: [] }),
}));

export const usePendingHandoffs = (): PendingHandoff[] =>
  useHandoffAnimationStore(useShallow((s) => s.pending));

export const HANDOFF_MAX_CONCURRENT = MAX_CONCURRENT_ANIMATIONS;
