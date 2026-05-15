# ADR-003: Padrão de comunicação entre `apps/web` e `apps/agent-runtime`

Data: 2026-05-15
Status: aceito (item 3 atualizado pelo ADR-009)

## Contexto

`apps/web` (Next.js) e `apps/agent-runtime` (Node + LangGraph) são serviços separados. Web precisa: consultar status de tarefas, disparar execução de agentes, receber updates em tempo real. Filas puras impedem fluxos síncronos óbvios (carregar painel); HTTP puro força polling pra estado de agente.

## Decisão

Três canais com responsabilidades distintas:

1. **HTTP REST (web → agent-runtime):** operações síncronas com resposta rápida (consulta de status, listagem, triagem curta). Contratos validados com Zod nas duas pontas.
2. **BullMQ (Redis):** trabalho assíncrono de agente (execução, processamento de documento, workflows). Web enfileira, agent-runtime consome via workers internos.
3. **Redis pub/sub via Socket.io:** notificações ao usuário em tempo real (status de tarefa, aprovação pendente, eventos do escritório virtual). Agent-runtime publica em canal `tenant:{id}`. **Atualização (ADR-009):** o Socket.io server foi movido pro `apps/agent-runtime` na Sprint 0.3b — o web só hospeda o cliente. Motivação no ADR-009.

Auth entre serviços: token HMAC interno (`INTERNAL_SERVICE_TOKEN`) em payload assinado contendo `tenant_id`, `user_id`, `roles` previamente validados pelo Clerk no `apps/web`. Timestamps com janela de 30s pra mitigar replay. JWT do Clerk não trafega entre serviços.

## Alternativas consideradas

- **HTTP puro:** força polling pra status de agente — UX e custo ruins.
- **Filas puras:** impedem fluxos síncronos (consultas diretas, status check).
- **tRPC:** desenhado pra Next API ↔ Next client; entre Node apps separados perde graça e adiciona acoplamento. Reservado pra uso dentro de `apps/web`.
- **gRPC:** overkill (protobufs, codegen) pro estágio atual.

## Consequências

Positivas:
- Cada modo de interação tem o canal apropriado.
- Trace_id propagado pelos três canais via headers (HTTP), metadata (BullMQ), payload (pub/sub).

Negativas:
- Três canais pra manter, monitorar e versionar contratos.
- Mitigação: Zod nas duas pontas dos três canais; observabilidade unificada via Langfuse + Sentry com trace_id correlacionado.

## Quando reverter

Se o blast radius de comprometimento do `apps/web` virar inaceitável (ex: terceiros chamando o runtime), trocar HMAC interno por OAuth client credentials.
