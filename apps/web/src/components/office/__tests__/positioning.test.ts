import { describe, expect, it } from 'vitest';
import { ROOMS, type RoomDef } from '../rooms';
import { roomForDepartment, tilePosForAgent } from '../positioning';

const findRoom = (id: string): RoomDef => {
  const r = ROOMS.find((r) => r.id === id);
  if (!r) throw new Error(`room ${id} not found in test fixture`);
  return r;
};

// IDs sequenciais escolhidos manualmente — em sala 8x8 (interior 6x6) eles
// geram 5 posições distintas via FNV-1a. Documentado pra evitar flakiness.
const FIXED_IDS = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000005',
] as const;

describe('positioning', () => {
  describe('tilePosForAgent', () => {
    it('é determinístico — mesmo id retorna sempre a mesma posição', () => {
      const room = findRoom('fiscal');
      const a = tilePosForAgent(FIXED_IDS[0], room);
      const b = tilePosForAgent(FIXED_IDS[0], room);
      expect(a).toEqual(b);
    });

    it('coloca a posição dentro do interior da sala (sem encostar nas bordas)', () => {
      const room = findRoom('fiscal'); // 8x8
      for (const id of FIXED_IDS) {
        const p = tilePosForAgent(id, room);
        expect(p.x).toBeGreaterThanOrEqual(1);
        expect(p.x).toBeLessThanOrEqual(room.width - 2);
        expect(p.y).toBeGreaterThanOrEqual(1);
        expect(p.y).toBeLessThanOrEqual(room.height - 2);
      }
    });

    it('5 agentes do mesmo dept não colidem em sala 8x8', () => {
      const room = findRoom('fiscal');
      const positions = FIXED_IDS.map((id) => tilePosForAgent(id, room));
      const keys = positions.map((p) => `${p.x},${p.y}`);
      expect(new Set(keys).size).toBe(positions.length);
    });

    it('funciona em sala menor (recepção 6x6, interior 4x4)', () => {
      const room = findRoom('recepcao');
      const p = tilePosForAgent(FIXED_IDS[0], room);
      expect(p.x).toBeGreaterThanOrEqual(1);
      expect(p.x).toBeLessThanOrEqual(room.width - 2);
      expect(p.y).toBeGreaterThanOrEqual(1);
      expect(p.y).toBeLessThanOrEqual(room.height - 2);
    });
  });

  describe('roomForDepartment', () => {
    it('mapeia `platform` (Roteador) → sala recepcao', () => {
      const room = roomForDepartment('platform');
      expect(room?.id).toBe('recepcao');
    });

    it('mapeia departments do domínio 1:1', () => {
      expect(roomForDepartment('atendimento')?.id).toBe('atendimento');
      expect(roomForDepartment('societario')?.id).toBe('societario');
      expect(roomForDepartment('pessoal')?.id).toBe('pessoal');
      expect(roomForDepartment('contabil')?.id).toBe('contabil');
      expect(roomForDepartment('fiscal')?.id).toBe('fiscal');
      expect(roomForDepartment('financeiro_interno')?.id).toBe('financeiro_interno');
    });
  });
});
