import {
  type Application,
  Container,
  Graphics,
  Polygon,
  Text,
  type TickerCallback,
} from 'pixi.js';
import type { RenderAgent } from './agent-render';
import { AGENT_STATE_VISUALS } from './visuals';
import { playHandoffAnimation } from './handoff-animation';
import { TILE_HEIGHT, TILE_WIDTH, type WorldCoord, worldToScreen } from './iso';
import { DEPARTMENT_COLORS, ROOMS } from './rooms';

const DIAMOND_VERTICES: readonly number[] = [
  0,
  -TILE_HEIGHT / 2,
  TILE_WIDTH / 2,
  0,
  0,
  TILE_HEIGHT / 2,
  -TILE_WIDTH / 2,
  0,
];

export type SceneApi = {
  updateAgents: (agents: RenderAgent[]) => void;
  /** Sprint 1.6 — dispara animação one-shot de "ponto viajando" entre dois
   *  agentes. Resolve as posições internamente via id → container. Retorna
   *  false se um dos agentes não está renderizado (ex: agente do
   *  departamento que não tem sala mapeada). */
  playHandoff: (fromAgentId: string, toAgentId: string) => boolean;
  destroy: () => void;
};

export type SceneOptions = {
  agents: RenderAgent[];
  onAgentClick: (id: string) => void;
  onRoomClick: (department: string) => void;
};

type WorldBounds = { minX: number; maxX: number; minY: number; maxY: number };

function getWorldBounds(): WorldBounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const r of ROOMS) {
    minX = Math.min(minX, r.origin.x);
    maxX = Math.max(maxX, r.origin.x + r.width);
    minY = Math.min(minY, r.origin.y);
    maxY = Math.max(maxY, r.origin.y + r.height);
  }
  return { minX, maxX, minY, maxY };
}

function getCenteringOrigin(app: Application) {
  const bounds = getWorldBounds();
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const center = worldToScreen({ x: cx, y: cy });
  return {
    x: app.screen.width / 2 - center.x,
    y: app.screen.height / 2 - center.y,
  };
}

function isoFootprintPolygon(origin: WorldCoord, width: number, height: number): Polygon {
  // Vértices externos do footprint iso: topo (origem), direita, fundo, esquerda.
  const tl = worldToScreen(origin);
  const tr = worldToScreen({ x: origin.x + width - 1, y: origin.y });
  const br = worldToScreen({ x: origin.x + width - 1, y: origin.y + height - 1 });
  const bl = worldToScreen({ x: origin.x, y: origin.y + height - 1 });
  return new Polygon([
    tl.x,
    tl.y - TILE_HEIGHT / 2,
    tr.x + TILE_WIDTH / 2,
    tr.y,
    br.x,
    br.y + TILE_HEIGHT / 2,
    bl.x - TILE_WIDTH / 2,
    bl.y,
  ]);
}

export function renderScene(app: Application, opts: SceneOptions): SceneApi {
  const root = new Container();
  root.label = 'office-root';
  app.stage.addChild(root);

  let origin = getCenteringOrigin(app);
  root.position.set(origin.x, origin.y);

  const floorLayer = new Container();
  floorLayer.label = 'floor-layer';
  const agentsLayer = new Container();
  agentsLayer.label = 'agents-layer';
  agentsLayer.sortableChildren = true;
  const uiLayer = new Container();
  uiLayer.label = 'ui-layer';
  const animationsLayer = new Container();
  animationsLayer.label = 'animations-layer';

  root.addChild(floorLayer, agentsLayer, uiLayer, animationsLayer);

  const tickerCallbacks: TickerCallback<unknown>[] = [];
  const avatarContainers: Container[] = [];
  const avatarPositionById = new Map<string, { x: number; y: number }>();
  const liveHandoffCancellers: Array<() => void> = [];

  for (const room of ROOMS) {
    const colors = DEPARTMENT_COLORS[room.department];

    const roomContainer = new Container();
    roomContainer.label = `room-${room.id}`;
    floorLayer.addChild(roomContainer);

    for (let dx = 0; dx < room.width; dx++) {
      for (let dy = 0; dy < room.height; dy++) {
        const s = worldToScreen({ x: room.origin.x + dx, y: room.origin.y + dy });
        const tile = new Graphics();
        tile
          .poly([...DIAMOND_VERTICES])
          .fill({ color: colors.floor })
          .stroke({ color: 0x000000, width: 1, alpha: 0.15 });
        tile.position.set(s.x, s.y);
        roomContainer.addChild(tile);
      }
    }

    // Accent nos 4 cantos
    const accentG = new Graphics();
    const corners: WorldCoord[] = [
      { x: room.origin.x, y: room.origin.y },
      { x: room.origin.x + room.width - 1, y: room.origin.y },
      { x: room.origin.x, y: room.origin.y + room.height - 1 },
      { x: room.origin.x + room.width - 1, y: room.origin.y + room.height - 1 },
    ];
    for (const c of corners) {
      const s = worldToScreen(c);
      accentG
        .poly([
          s.x,
          s.y - TILE_HEIGHT / 2,
          s.x + TILE_WIDTH / 2,
          s.y,
          s.x,
          s.y + TILE_HEIGHT / 2,
          s.x - TILE_WIDTH / 2,
          s.y,
        ])
        .stroke({ color: colors.accent, width: 2, alpha: 0.85 });
    }
    roomContainer.addChild(accentG);

    roomContainer.eventMode = 'static';
    roomContainer.cursor = 'pointer';
    roomContainer.hitArea = isoFootprintPolygon(room.origin, room.width, room.height);
    roomContainer.on('pointerdown', () => {
      opts.onRoomClick(room.department);
    });

    // Label da sala
    const labelCenter = worldToScreen({
      x: room.origin.x + (room.width - 1) / 2,
      y: room.origin.y,
    });
    const label = new Text({
      text: room.label,
      style: {
        fontFamily: 'sans-serif',
        fontSize: 12,
        fontWeight: '600',
        fill: colors.accent,
      },
    });
    label.anchor.set(0.5, 1);
    label.position.set(labelCenter.x, labelCenter.y - TILE_HEIGHT);
    uiLayer.addChild(label);
  }

  const onResize = () => {
    origin = getCenteringOrigin(app);
    root.position.set(origin.x, origin.y);
  };
  app.renderer.on('resize', onResize);

  function clearAvatars() {
    for (const cb of tickerCallbacks) {
      app.ticker.remove(cb);
    }
    tickerCallbacks.length = 0;
    for (const c of avatarContainers) {
      c.destroy({ children: true });
    }
    avatarContainers.length = 0;
    avatarPositionById.clear();
  }

  function renderAvatars(agents: RenderAgent[]) {
    clearAvatars();

    for (const agent of agents) {
      const room = ROOMS.find((r) => r.department === agent.roomDepartment);
      if (!room) continue;

      const visual = AGENT_STATE_VISUALS[agent.state];
      const wx = room.origin.x + agent.tilePos.x;
      const wy = room.origin.y + agent.tilePos.y;
      const s = worldToScreen({ x: wx, y: wy });

      const container = new Container();
      container.label = `agent-${agent.id}`;
      container.position.set(s.x, s.y);
      container.zIndex = s.y;
      container.alpha = visual.alpha;

      // Sombra (fica abaixo do avatar — não escala junto)
      const shadow = new Graphics();
      shadow.ellipse(0, 2, 12, 4).fill({ color: 0x000000, alpha: 0.4 });
      container.addChild(shadow);

      // Sub-container do avatar (body + ring). Pulse aplica scale aqui só,
      // poupando a label que ficaria distorcida se escalássemos o container raiz.
      const avatar = new Container();
      avatar.label = 'avatar';
      container.addChild(avatar);

      let ring: Graphics | null = null;
      if (visual.ring) {
        ring = new Graphics();
        ring.circle(0, -10, 16).stroke({ color: visual.color, width: 2 });
        avatar.addChild(ring);
      }

      const body = new Graphics();
      body
        .circle(0, -10, 12)
        .fill({ color: visual.color })
        .stroke({ color: 0x2e3440, width: 1 });
      avatar.addChild(body);

      // Ticker unificado por avatar: aplica pulse de scale no `avatar`
      // sub-container (body+ring) + animação de alpha no ring quando em pulse.
      // Single ticker por agente em vez de um por elemento.
      if (visual.ring === 'pulse') {
        let elapsed = 0;
        const ringCapture = ring;
        const cb: TickerCallback<unknown> = (ticker) => {
          elapsed += ticker.deltaMS / 1000;
          const scale = 1 + Math.sin(elapsed * 3) * 0.05;
          avatar.scale.set(scale, scale);
          if (ringCapture) {
            const ringScale = 1 + Math.sin(elapsed * 3) * 0.18;
            ringCapture.scale.set(ringScale, ringScale);
            ringCapture.alpha = 0.55 + Math.cos(elapsed * 3) * 0.3;
          }
        };
        app.ticker.add(cb);
        tickerCallbacks.push(cb);
      }

      // Badge de drafts pending (laranja, sobre o avatar, top-right).
      if (agent.pendingDraftCount > 0) {
        const badge = new Container();
        badge.label = 'pending-drafts-badge';
        const bg = new Graphics();
        bg.circle(0, 0, 8).fill({ color: 0xf07746 }).stroke({ color: 0x0a0a0a, width: 1 });
        badge.addChild(bg);
        const countText = new Text({
          text: agent.pendingDraftCount > 9 ? '9+' : String(agent.pendingDraftCount),
          style: {
            fontFamily: 'sans-serif',
            fontSize: 10,
            fontWeight: '700',
            fill: 0xffffff,
          },
        });
        countText.anchor.set(0.5);
        badge.addChild(countText);
        // Posicionado no canto superior direito do corpo (offset relativo ao
        // centro do corpo que está em y=-10).
        badge.position.set(11, -19);
        container.addChild(badge);
      }

      const label = new Text({
        text: agent.name,
        style: {
          fontFamily: 'sans-serif',
          fontSize: 9,
          fill: 0xeceff4,
        },
      });
      label.anchor.set(0.5, 0);
      label.position.set(0, 6);
      container.addChild(label);

      container.eventMode = 'static';
      container.cursor = 'pointer';
      container.on('pointerdown', (e) => {
        e.stopPropagation();
        opts.onAgentClick(agent.id);
      });

      agentsLayer.addChild(container);
      avatarContainers.push(container);
      avatarPositionById.set(agent.id, { x: s.x, y: s.y });
    }
  }

  renderAvatars(opts.agents);

  return {
    updateAgents(agents) {
      renderAvatars(agents);
    },
    playHandoff(fromAgentId, toAgentId) {
      const from = avatarPositionById.get(fromAgentId);
      const to = avatarPositionById.get(toAgentId);
      if (!from || !to) return false;
      const handle = playHandoffAnimation({
        app,
        layer: animationsLayer,
        from,
        to,
        onComplete: () => {
          const idx = liveHandoffCancellers.indexOf(handle.cancel);
          if (idx !== -1) liveHandoffCancellers.splice(idx, 1);
        },
      });
      liveHandoffCancellers.push(handle.cancel);
      return true;
    },
    destroy() {
      // Cancela quaisquer animações in-flight antes de derrubar o root —
      // se uma animação tentar tocar app.ticker após destroy do app, crash.
      for (const cancel of liveHandoffCancellers.slice()) cancel();
      liveHandoffCancellers.length = 0;
      app.renderer.off('resize', onResize);
      clearAvatars();
      root.destroy({ children: true });
    },
  };
}
