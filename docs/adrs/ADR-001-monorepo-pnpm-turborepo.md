# ADR-001: pnpm workspaces + Turborepo como gerenciador de monorepo

Data: 2026-05-15
Status: aceito

## Contexto

A plataforma é composta por múltiplos apps (`apps/web`, `apps/agent-runtime`, `apps/workers`) e packages compartilhados (`packages/shared-*`). Sem gerenciamento adequado de workspace, instalação de dependências, execução de tasks (build/lint/test) e descoberta de grafo de dependências entre packages viram fonte de erro e lentidão em CI conforme o projeto cresce.

## Decisão

Adotar pnpm workspaces como instalador (resolução de deps, hoisting controlado, performance) combinado com Turborepo como orquestrador de tasks (cache local e remoto, descoberta automática do grafo, execução paralela respeitando dependências).

## Alternativas consideradas

- **pnpm workspaces puro:** funciona no dia zero, mas `pnpm -r run test` roda tudo todo PR sem cache. Vira gargalo de CI quando o projeto cresce. Adicionar Turborepo depois é trabalho duplicado.
- **Nx:** mais opinativo, com geradores e plugins. Curva de aprendizado significativa (projects, executors, plugins). Overkill pro tamanho atual do time. Ganharia em times grandes com múltiplas equipes paralelas.

## Consequências

Positivas:
- Cache de build/lint/test reduz tempo de CI conforme o projeto cresce.
- Descoberta automática do grafo de dependências entre packages.
- Execução paralela respeitando ordem de dependência.
- Baixo lock-in: pnpm é padrão de mercado, Turborepo é configuração descartável.

Negativas:
- Arquivo `turbo.json` é fonte de complexidade adicional pra tasks não-padrão.
- Pipeline declarativo tem curva de aprendizado pequena.
