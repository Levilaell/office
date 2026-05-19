import {
  type Application,
  Container,
  Graphics,
  type TickerCallback,
} from 'pixi.js';
import type { ScreenCoord } from './iso';

// Sprint 1.6 — animação sutil de "mensagem viajando" entre dois agentes.
//
// Decisão de UX (sprint 1.6, decisão 3): ponto colorido 3-5px viajando do
// `from` ao `to` por ~1.5s, ease-out, pulse curto na chegada, some.
// Sem som, sem trail elaborado, sem zoom. Objetivo: feedback visual leve.
//
// Coordenadas vêm em screen-space JÁ relativas ao `root` (origem aplicada).
// O caller (OfficeCanvas) resolve worldToScreen + offset antes de chamar.

const DURATION_MS = 1500;
const RADIUS = 4;
const COLOR = 0xebcb8b;
const PULSE_DURATION_MS = 300;

// Ease-out cubic — começa rápido, desacelera no fim. Sensação de "chegou".
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export type HandoffAnimationOptions = {
  app: Application;
  /** Container onde o sprite vai viver. Deve ser o root do office (zIndex
   *  acima dos agentes). */
  layer: Container;
  from: ScreenCoord;
  to: ScreenCoord;
  onComplete?: () => void;
};

/**
 * Dispara uma animação one-shot e retorna handle pra cancelar caso o
 * canvas seja destruído antes dela acabar.
 */
export const playHandoffAnimation = ({
  app,
  layer,
  from,
  to,
  onComplete,
}: HandoffAnimationOptions): { cancel: () => void } => {
  const dot = new Container();
  dot.label = 'handoff-dot';
  dot.position.set(from.x, from.y - 10); // -10 alinha com altura do body

  const halo = new Graphics();
  halo.circle(0, 0, RADIUS + 3).fill({ color: COLOR, alpha: 0.25 });
  dot.addChild(halo);

  const core = new Graphics();
  core.circle(0, 0, RADIUS).fill({ color: COLOR }).stroke({ color: 0xfff5e6, width: 1 });
  dot.addChild(core);

  layer.addChild(dot);

  let elapsed = 0;
  let pulsing = false;
  let pulseElapsed = 0;
  let destroyed = false;

  const cleanup = (): void => {
    if (destroyed) return;
    destroyed = true;
    app.ticker.remove(cb);
    dot.destroy({ children: true });
    onComplete?.();
  };

  const cb: TickerCallback<unknown> = (ticker) => {
    if (destroyed) return;
    elapsed += ticker.deltaMS;

    if (!pulsing) {
      const t = Math.min(1, elapsed / DURATION_MS);
      const eased = easeOutCubic(t);
      dot.position.x = from.x + (to.x - from.x) * eased;
      dot.position.y = from.y - 10 + (to.y - from.y) * eased;
      if (t >= 1) {
        pulsing = true;
        pulseElapsed = 0;
      }
      return;
    }

    pulseElapsed += ticker.deltaMS;
    const pulseT = Math.min(1, pulseElapsed / PULSE_DURATION_MS);
    const scale = 1 + pulseT * 1.5;
    const alpha = 1 - pulseT;
    dot.scale.set(scale, scale);
    dot.alpha = alpha;
    if (pulseT >= 1) {
      cleanup();
    }
  };

  app.ticker.add(cb);

  return {
    cancel: cleanup,
  };
};
