# ADR-009: Socket.io server vive em `apps/agent-runtime`

Data: 2026-05-15
Status: aceito (substitui detalhe do ADR-003)

## Contexto

ADR-003 §3 atribuiu o Socket.io server ao `apps/web`: agent-runtime publicaria em pub/sub e o Next repassaria pros clientes via WS. Ao implementar a Sprint 0.3b descobrimos três fricções:

1. **Next 15 + WebSocket nativo é complicado.** App Router não suporta `socket.io` no mesmo processo do servidor Node sem custom server, o que sacrifica recursos do Next (caching, edge, ISR). Manter um servidor custom só pra WS desvirtua o framework.
2. **Acoplamento desnecessário.** Eventos nascem no agent-runtime (workers BullMQ, mudanças de estado de agentes). Forçar o pulo extra de pub/sub → web → cliente adiciona latência, ponto de falha e dois serviços envolvidos em cada notificação.
3. **Auth simétrica em dois lugares.** Em web seria via cookie do Clerk; em agent-runtime já precisamos validar JWT pra outras coisas (handoff de chamadas internas). Centralizar no runtime simplifica.

## Decisão

Socket.io server é atachado ao mesmo HTTP server do Hono no `apps/agent-runtime` (porta 3001). Cliente do `apps/web` conecta direto em `NEXT_PUBLIC_AGENT_RUNTIME_URL` via `socket.io-client`.

Auth no handshake: JWT do Clerk validado via `@clerk/backend.verifyToken` (JWKS network + cache). Resolve `clerk_org_id` → `tenant_id` interno via service-role do Supabase. Socket entra automaticamente em room `tenant:{id}`.

Redis pub/sub continua sendo o bus interno entre processos do runtime; agora um único subscriber dentro do mesmo agent-runtime traduz `tenant:*` → `io.to(channel).emit(...)`. Sem necessidade de pub/sub atravessar fronteira de serviço só pra alimentar a UI.

## Alternativas consideradas

- **Manter Socket.io no web (ADR-003 original):** custom server no Next, latência extra, dois locais de auth. Rejeitado.
- **SSE via Next route:** suficiente pra eventos uni-direcionais mas perde bi-direção (heartbeat, ack de aprovação interativa). Hoje só precisamos uni, mas o roadmap (escritório isométrico com user reagindo a agentes) puxa pra bi.
- **WebSocket "puro" sem Socket.io:** menos overhead, mas sem rooms, reconexão automática e binary protocol. Reinventaria o que Socket.io já entrega.

## Consequências

Positivas:
- Eventos do agent-runtime chegam ao cliente sem pulo extra.
- Auth concentrada onde a permissão é resolvida (JWKS + tenant lookup já são necessários por outras razões).
- Web fica "puro Next" — sem custom server.

Negativas:
- agent-runtime acumula mais responsabilidades (HTTP REST + WS + workers + boot do OTEL). Mitigação: extrair pacotes (`shared-events` já isolou bus); split em serviços só quando blast radius justificar.
- CORS precisa ser configurado pra permitir o origin do web (env `WEB_ORIGIN`).
- Em produção, infra precisa rotear `wss://` pra mesma instância (sticky em load balancer). Sem sticky, Socket.io reconecta no host errado e a room some.

## Quando reverter

Se o agent-runtime virar gargalo de CPU/memória servindo muitas conexões WS simultâneas, considerar:
- Separar Socket.io num serviço dedicado (`apps/realtime`) consumindo o mesmo Redis pub/sub.
- Voltar pra ADR-003 original, com Next custom server, só se o benefício superar a perda de features do App Router.
