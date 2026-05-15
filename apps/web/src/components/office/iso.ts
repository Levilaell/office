export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

export type WorldCoord = { x: number; y: number };
export type ScreenCoord = { x: number; y: number };

export function worldToScreen(
  world: WorldCoord,
  origin: ScreenCoord = { x: 0, y: 0 },
): ScreenCoord {
  return {
    x: origin.x + (world.x - world.y) * (TILE_WIDTH / 2),
    y: origin.y + (world.x + world.y) * (TILE_HEIGHT / 2),
  };
}

export function screenToWorld(
  screen: ScreenCoord,
  origin: ScreenCoord = { x: 0, y: 0 },
): WorldCoord {
  const dx = screen.x - origin.x;
  const dy = screen.y - origin.y;
  return {
    x: (dx / (TILE_WIDTH / 2) + dy / (TILE_HEIGHT / 2)) / 2,
    y: (dy / (TILE_HEIGHT / 2) - dx / (TILE_WIDTH / 2)) / 2,
  };
}
