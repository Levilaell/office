import type { WorldCoord } from './iso';

export const DEPARTMENT_COLORS = {
  recepcao: { floor: 0x3b4252, accent: 0x88c0d0 },
  atendimento: { floor: 0x4c566a, accent: 0xa3be8c },
  societario: { floor: 0x4c566a, accent: 0xb48ead },
  pessoal: { floor: 0x4c566a, accent: 0xebcb8b },
  fiscal: { floor: 0x4c566a, accent: 0xbf616a },
  contabil: { floor: 0x4c566a, accent: 0xd08770 },
  financeiro_interno: { floor: 0x4c566a, accent: 0x81a1c1 },
} as const;

export type Department = keyof typeof DEPARTMENT_COLORS;

export type RoomDef = {
  id: string;
  department: Department;
  label: string;
  origin: WorldCoord;
  width: number;
  height: number;
};

// Grid 3x3 com slots de 10×10 tiles. Recepção (6×6) centrada no slot top-center
// com gap de 2 tiles em todos os lados. Demais salas (8×8) ocupam o slot inteiro.
// Slots mid-center e bottom-center ficam vazios (corredores).
export const ROOMS: readonly RoomDef[] = [
  {
    id: 'atendimento',
    department: 'atendimento',
    label: 'Atendimento',
    origin: { x: 0, y: 0 },
    width: 8,
    height: 8,
  },
  {
    id: 'recepcao',
    department: 'recepcao',
    label: 'Recepção',
    origin: { x: 12, y: 2 },
    width: 6,
    height: 6,
  },
  {
    id: 'societario',
    department: 'societario',
    label: 'Societário',
    origin: { x: 20, y: 0 },
    width: 8,
    height: 8,
  },
  {
    id: 'pessoal',
    department: 'pessoal',
    label: 'Pessoal',
    origin: { x: 0, y: 10 },
    width: 8,
    height: 8,
  },
  {
    id: 'fiscal',
    department: 'fiscal',
    label: 'Fiscal',
    origin: { x: 20, y: 10 },
    width: 8,
    height: 8,
  },
  {
    id: 'contabil',
    department: 'contabil',
    label: 'Contábil',
    origin: { x: 0, y: 20 },
    width: 8,
    height: 8,
  },
  {
    id: 'financeiro_interno',
    department: 'financeiro_interno',
    label: 'Financeiro Interno',
    origin: { x: 20, y: 20 },
    width: 8,
    height: 8,
  },
] as const;
