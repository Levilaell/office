'use client';

import { useMemo, useState } from 'react';
import { useAgents, useDraftCountsByAgent } from '@/lib/realtime-store';
import type { AgentSnapshot } from '@/lib/realtime-types';
import { AgentSheet } from './AgentSheet';
import type { RenderAgent } from './agent-render';
import { OfficeCanvas } from './OfficeCanvas';
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
      />
      <RoomPlaceholderTooltip
        department={hoveredEmptyRoom}
        onClose={() => setHoveredEmptyRoom(null)}
      />
      <AgentSheet agentId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
