'use client';

import { useEffect, useRef } from 'react';
import { Application } from 'pixi.js';
import type { RenderAgent } from './agent-render';
import { renderScene, type SceneApi } from './scene';

export type PendingHandoffDispatch = {
  id: string;
  fromAgentId: string;
  toAgentId: string;
};

export type OfficeCanvasProps = {
  agents: RenderAgent[];
  onAgentClick?: (agentId: string) => void;
  onRoomClick?: (department: string) => void;
  /** Sprint 1.6 — fila de animações de handoff a disparar. OfficeCanvas
   *  rastreia ids já vistos e chama scene.playHandoff(...) só pra novos.
   *  Após disparar, chama `onHandoffDispatched(id)` pro caller drenar
   *  do store. */
  pendingHandoffs?: PendingHandoffDispatch[];
  onHandoffDispatched?: (id: string) => void;
};

export function OfficeCanvas({
  agents,
  onAgentClick,
  onRoomClick,
  pendingHandoffs,
  onHandoffDispatched,
}: OfficeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const sceneRef = useRef<SceneApi | null>(null);

  // Ref-bounce: handlers vivem em refs pra que o useEffect de init não
  // precise se preocupar com identidade dos callbacks vindos do pai.
  const onAgentClickRef = useRef(onAgentClick);
  const onRoomClickRef = useRef(onRoomClick);
  const onHandoffDispatchedRef = useRef(onHandoffDispatched);
  const agentsRef = useRef(agents);
  // IDs já processados — sprint usa store global pra fila; canvas só dispatcha
  // uma vez por id mesmo que o array mude por outras razões.
  const dispatchedHandoffsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    onAgentClickRef.current = onAgentClick;
  });
  useEffect(() => {
    onRoomClickRef.current = onRoomClick;
  });
  useEffect(() => {
    onHandoffDispatchedRef.current = onHandoffDispatched;
  });
  useEffect(() => {
    agentsRef.current = agents;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Captura o ref no escopo do effect — React lint avisa que ref pode
    // mudar entre setup e cleanup; aqui é estável (não muda durante a vida
    // do componente), mas seguimos a regra pra evitar warning.
    const dispatchedRef = dispatchedHandoffsRef;

    let cancelled = false;
    const app = new Application();

    (async () => {
      await app.init({
        background: 0x0a0a0a,
        resizeTo: container,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (cancelled || !containerRef.current) {
        app.destroy(
          { removeView: true },
          { children: true, texture: true, textureSource: true },
        );
        return;
      }

      containerRef.current.appendChild(app.canvas);
      appRef.current = app;
      sceneRef.current = renderScene(app, {
        agents: agentsRef.current,
        onAgentClick: (id) => onAgentClickRef.current?.(id),
        onRoomClick: (dept) => onRoomClickRef.current?.(dept),
      });
    })();

    return () => {
      cancelled = true;
      sceneRef.current?.destroy();
      sceneRef.current = null;
      dispatchedRef.current.clear();
      if (appRef.current) {
        appRef.current.destroy(
          { removeView: true },
          { children: true, texture: true, textureSource: true },
        );
        appRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.updateAgents(agents);
  }, [agents]);

  // Processa fila de handoffs. Pra cada item novo (id não visto), chama
  // scene.playHandoff e notifica caller pra drenar. Resilient a scene não
  // pronta (init async) — nesse caso só não dispatcha, item permanece na
  // fila pro próximo render.
  useEffect(() => {
    if (!pendingHandoffs || pendingHandoffs.length === 0) return;
    const scene = sceneRef.current;
    if (!scene) return;
    for (const item of pendingHandoffs) {
      if (dispatchedHandoffsRef.current.has(item.id)) continue;
      const played = scene.playHandoff(item.fromAgentId, item.toAgentId);
      dispatchedHandoffsRef.current.add(item.id);
      if (played) {
        onHandoffDispatchedRef.current?.(item.id);
      } else {
        // Agente alvo ainda não renderizado (raça com hidratação ou
        // departamento sem sala). Drena assim mesmo — repetir não ajuda.
        onHandoffDispatchedRef.current?.(item.id);
      }
    }
  }, [pendingHandoffs]);

  return <div ref={containerRef} className="h-full w-full min-h-[600px]" />;
}
