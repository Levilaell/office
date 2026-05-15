# Office

Plataforma multi-tenant de agentes de IA para escritórios contábeis brasileiros.

## Setup

Requisitos: Node 20+, pnpm 9+.

```bash
pnpm install
pnpm dev
```

`pnpm dev` sobe os três apps em paralelo:

- `apps/web` — Next.js (UI + API routes) — http://localhost:3000
- `apps/agent-runtime` — serviço Node (Hono) — http://localhost:3001
- `apps/workers` — workers BullMQ (sem servidor HTTP)

## Estrutura

```
apps/
  web/              Next.js 14 App Router
  agent-runtime/    Node + Hono
  workers/          Node + BullMQ
packages/
  shared-types/     Tipos TS compartilhados
  shared-config/    Validação de env (Zod) e constants
  shared-db/        Schema Supabase, migrations, tipos (placeholder)
  shared-prompts/   Prompts versionados (placeholder)
  shared-domain/    Modelo contábil compartilhado (placeholder)
```

## Comandos

- `pnpm dev` — todos os apps em paralelo
- `pnpm build` — build geral
- `pnpm lint` — lint
- `pnpm typecheck` — type-check em todos os pacotes
- `pnpm test` — testes (Vitest)

## Regras

Veja [CLAUDE.md](./CLAUDE.md) e [.claude/rules/](./.claude/rules/) para princípios e regras detalhadas.
