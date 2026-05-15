import type { AgentState } from '@office/shared-types';

export type AgentVisual = {
  color: number;
  ring: false | 'pulse' | 'static';
  alpha: number;
};

export const AGENT_STATE_VISUALS: Record<AgentState, AgentVisual> = {
  idle: { color: 0x4c566a, ring: false, alpha: 1.0 },
  working: { color: 0xa3be8c, ring: 'pulse', alpha: 1.0 },
  awaiting_approval: { color: 0xebcb8b, ring: 'static', alpha: 1.0 },
  error: { color: 0xbf616a, ring: 'static', alpha: 1.0 },
  paused: { color: 0x4c566a, ring: false, alpha: 0.5 },
};
