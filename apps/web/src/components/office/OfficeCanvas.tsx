'use client';

import { useEffect, useRef } from 'react';
import { Application } from 'pixi.js';
import type { RenderAgent } from './agent-render';
import { renderScene, type SceneApi } from './scene';

export type OfficeCanvasProps = {
  agents: RenderAgent[];
  onAgentClick?: (agentId: string) => void;
  onRoomClick?: (department: string) => void;
};

export function OfficeCanvas({
  agents,
  onAgentClick,
  onRoomClick,
}: OfficeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const sceneRef = useRef<SceneApi | null>(null);

  // Ref-bounce: handlers vivem em refs pra que o useEffect de init não
  // precise se preocupar com identidade dos callbacks vindos do pai.
  const onAgentClickRef = useRef(onAgentClick);
  const onRoomClickRef = useRef(onRoomClick);
  const agentsRef = useRef(agents);

  useEffect(() => {
    onAgentClickRef.current = onAgentClick;
  });
  useEffect(() => {
    onRoomClickRef.current = onRoomClick;
  });
  useEffect(() => {
    agentsRef.current = agents;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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

  return <div ref={containerRef} className="h-full w-full min-h-[600px]" />;
}
