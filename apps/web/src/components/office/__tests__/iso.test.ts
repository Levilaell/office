import { describe, expect, it } from 'vitest';
import {
  TILE_HEIGHT,
  TILE_WIDTH,
  screenToWorld,
  worldToScreen,
} from '../iso';

const EPS = 1e-9;

describe('iso projection', () => {
  it('origin maps origin → origin (no offset)', () => {
    expect(worldToScreen({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(screenToWorld({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('respects custom origin offset', () => {
    const origin = { x: 100, y: 50 };
    expect(worldToScreen({ x: 0, y: 0 }, origin)).toEqual(origin);
  });

  it('places (1,0) and (0,1) on opposite x sides at same y', () => {
    const a = worldToScreen({ x: 1, y: 0 });
    const b = worldToScreen({ x: 0, y: 1 });
    expect(a.x).toBe(TILE_WIDTH / 2);
    expect(a.y).toBe(TILE_HEIGHT / 2);
    expect(b.x).toBe(-TILE_WIDTH / 2);
    expect(b.y).toBe(TILE_HEIGHT / 2);
  });

  it('round-trips world → screen → world', () => {
    const cases: Array<{ x: number; y: number }> = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 5, y: 7 },
      { x: -3, y: 2 },
      { x: 12.5, y: -4.25 },
      { x: 100, y: 100 },
    ];
    for (const w of cases) {
      const s = worldToScreen(w);
      const w2 = screenToWorld(s);
      expect(Math.abs(w2.x - w.x)).toBeLessThan(EPS);
      expect(Math.abs(w2.y - w.y)).toBeLessThan(EPS);
    }
  });

  it('round-trips with custom origin', () => {
    const origin = { x: 320, y: 240 };
    const w = { x: 4, y: 9 };
    const s = worldToScreen(w, origin);
    const w2 = screenToWorld(s, origin);
    expect(Math.abs(w2.x - w.x)).toBeLessThan(EPS);
    expect(Math.abs(w2.y - w.y)).toBeLessThan(EPS);
  });
});
