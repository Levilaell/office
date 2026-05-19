'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  useHandoffAnimationStore,
  usePendingHandoffs,
} from '@/lib/handoff-animation-store';
import { useAgents, useDraftCountsByAgent } from '@/lib/realtime-store';
import type { AgentSnapshot } from '@/lib/realtime-types';
import { AgentSheet } from './AgentSheet';
import type { RenderAgent } from './agent-render';
import {
  OfficeCanvas,
  type PendingHandoffDispatch,
} from './OfficeCanvas';
import { roomForDepartment, tilePosForAgent } from './positioning';
import { RoomPlaceholderTooltip } from './RoomPlaceholderTooltip';

const ACTIVE_DEPARTMENTS = new Set<string>(['atendimento', 'platform']);

const toRenderAgent = (
  snap: AgentSnapshot,
  draftCount: number,
): RenderAgent | null => {
  const room = roomForDepartment(snap.department);
  if (!room) return null;
  return {
    id: snap.id,
    name: snap.name,
    roomDepartment: room.department,
    domainDepartment: snap.department,
    role: snap.role,
    state: snap.state,
    tilePos: tilePosForAgent(snap.id, room),
    pendingDraftCount: draftCount,
  };
};

export function OfficeCanvasShell() {
  const agents = useAgents();
  const draftCounts = useDraftCountsByAgent();
  const pendingHandoffs = usePendingHandoffs();
  const consumeHandoff = useHandoffAnimationStore((s) => s.consume);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredEmptyRoom, setHoveredEmptyRoom] = useState<string | null>(null);

  const renderAgents = useMemo<RenderAgent[]>(() => {
    const out: RenderAgent[] = [];
    for (const a of agents) {
      const r = toRenderAgent(a, draftCounts[a.id] ?? 0);
      if (r) out.push(r);
    }
    return out;
  }, [agents, draftCounts]);

  // Mapa agentKey → agentId pra resolver handoffs (payload do evento
  // carrega `toAgentKey`, não UUID). Lookup memoizado pra evitar O(n)
  // scan a cada render.
  const agentIdByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of agents) m.set(a.agentKey, a.id);
    return m;
  }, [agents]);

  const dispatchableHandoffs = useMemo<PendingHandoffDispatch[]>(() => {
    const out: PendingHandoffDispatch[] = [];
    for (const h of pendingHandoffs) {
      const toAgentId = agentIdByKey.get(h.toAgentKey);
      if (!toAgentId) {
        // Agente alvo não está hidratado ainda (raça com hydration). Pula
        // — handoff fica na fila. Próximo render tenta de novo.
        continue;
      }
      out.push({ id: h.id, fromAgentId: h.fromAgentId, toAgentId });
    }
    return out;
  }, [pendingHandoffs, agentIdByKey]);

  const handleDispatched = useCallback(
    (id: string) => {
      consumeHandoff(id);
    },
    [consumeHandoff],
  );

  return (
    <div className="relative h-full w-full">
      <OfficeCanvas
        agents={renderAgents}
        onAgentClick={(id) => setSelectedId(id)}
        onRoomClick={(department) => {
          if (ACTIVE_DEPARTMENTS.has(department)) {
            setHoveredEmptyRoom(null);
            return;
          }
          setHoveredEmptyRoom(department);
        }}
        pendingHandoffs={dispatchableHandoffs}
        onHandoffDispatched={handleDispatched}
      />
      <RoomPlaceholderTooltip
        department={hoveredEmptyRoom}
        onClose={() => setHoveredEmptyRoom(null)}
      />
      <AgentSheet agentId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
