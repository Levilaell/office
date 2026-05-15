import type { Department } from './rooms';

export const AGENT_STATE_VISUALS = {
  idle: { color: 0x4c566a, ring: false, alpha: 1.0 },
  working: { color: 0xa3be8c, ring: 'pulse', alpha: 1.0 },
  awaiting_approval: { color: 0xebcb8b, ring: 'static', alpha: 1.0 },
  error: { color: 0xbf616a, ring: 'static', alpha: 1.0 },
  paused: { color: 0x4c566a, ring: false, alpha: 0.5 },
} as const;

export type AgentState = keyof typeof AGENT_STATE_VISUALS;
export type AgentRole = 'router' | 'coordinator' | 'specialist' | 'supervisor';

export type MockAgent = {
  id: string;
  name: string;
  department: Department;
  role: AgentRole;
  state: AgentState;
  tilePos: { x: number; y: number };
};

export const MOCK_AGENTS: MockAgent[] = [
  {
    id: '1',
    name: 'Roteador',
    department: 'recepcao',
    role: 'router',
    state: 'working',
    tilePos: { x: 3, y: 3 },
  },
  {
    id: '2',
    name: 'Coord. Atendimento',
    department: 'atendimento',
    role: 'coordinator',
    state: 'idle',
    tilePos: { x: 2, y: 2 },
  },
  {
    id: '3',
    name: 'Coord. Fiscal',
    department: 'fiscal',
    role: 'coordinator',
    state: 'awaiting_approval',
    tilePos: { x: 2, y: 3 },
  },
  {
    id: '4',
    name: 'Especialista DAS',
    department: 'fiscal',
    role: 'specialist',
    state: 'working',
    tilePos: { x: 4, y: 2 },
  },
  {
    id: '5',
    name: 'Coord. Pessoal',
    department: 'pessoal',
    role: 'coordinator',
    state: 'error',
    tilePos: { x: 3, y: 3 },
  },
  {
    id: '6',
    name: 'Coord. Contábil',
    department: 'contabil',
    role: 'coordinator',
    state: 'paused',
    tilePos: { x: 3, y: 2 },
  },
];
