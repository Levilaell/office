import type { Department as DomainDepartment } from '@office/shared-types';
import { ROOMS, type Department as RoomDepartment, type RoomDef } from './rooms';

// Roteador vive no department `platform` (camada de orquestração, não escritório
// físico). Mapa abaixo coloca-o visualmente na recepção — porta de entrada do
// escritório. Demais departments têm correspondência 1:1.
const DEPARTMENT_TO_ROOM: Record<DomainDepartment, RoomDepartment> = {
  platform: 'recepcao',
  atendimento: 'atendimento',
  societario: 'societario',
  pessoal: 'pessoal',
  contabil: 'contabil',
  fiscal: 'fiscal',
  financeiro_interno: 'financeiro_interno',
};

const ROOM_BY_DEPARTMENT = new Map<RoomDepartment, RoomDef>(
  ROOMS.map((r) => [r.department, r]),
);

export const roomForDepartment = (dept: DomainDepartment): RoomDef | null => {
  const key = DEPARTMENT_TO_ROOM[dept];
  return ROOM_BY_DEPARTMENT.get(key) ?? null;
};

// FNV-1a 32 bits — determinístico, sem colisões catastróficas em IDs UUID,
// suficiente pra espalhar avatares dentro de uma sala 8×8 ou 6×6.
const fnv1a = (input: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // Math.imul mantém 32 bits sem overflow pra double.
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

export type TilePos = { x: number; y: number };

/**
 * Mapeia agentId pra posição estável dentro do bounding box da sala.
 * Margem de 1 tile evita avatar nas bordas. Retorna coords RELATIVAS à
 * origem da sala — para coords absolutas, somar à `room.origin`.
 */
export const tilePosForAgent = (agentId: string, room: RoomDef): TilePos => {
  // Reserva margem de 1 tile em cada lado; sala de 8x8 vira grid 6x6 utilizável.
  const innerW = Math.max(1, room.width - 2);
  const innerH = Math.max(1, room.height - 2);

  const hash = fnv1a(agentId);
  // Split do hash em dois 16-bit (alta entropia em cada metade).
  const hx = (hash >>> 16) & 0xffff;
  const hy = hash & 0xffff;

  const x = 1 + (hx % innerW);
  const y = 1 + (hy % innerH);
  return { x, y };
};
