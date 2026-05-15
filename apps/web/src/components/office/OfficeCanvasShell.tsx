'use client';

import { useMemo, useState } from 'react';
import { useAgents } from '@/lib/realtime-store';
import type { AgentSnapshot } from '@/lib/realtime-types';
import { AgentSheet } from './AgentSheet';
import type { RenderAgent } from './agent-render';
import { OfficeCanvas } from './OfficeCanvas';
import { roomForDepartment, tilePosForAgent } from './positioning';

const toRenderAgent = (snap: AgentSnapshot): RenderAgent | null => {
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
  };
};

export function OfficeCanvasShell() {
  const agents = useAgents();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const renderAgents = useMemo<RenderAgent[]>(() => {
    const out: RenderAgent[] = [];
    for (const a of agents) {
      const r = toRenderAgent(a);
      if (r) out.push(r);
    }
    return out;
  }, [agents]);

  return (
    <>
      <OfficeCanvas
        agents={renderAgents}
        onAgentClick={(id) => setSelectedId(id)}
        onRoomClick={() => {
          // sem ação por enquanto; sala não abre painel
        }}
      />
      <AgentSheet agentId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}
