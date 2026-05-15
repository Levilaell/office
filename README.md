# Office

Plataforma multi-tenant de agentes de IA para escritórios contábeis brasileiros.

## Setup

Requisitos: Node 20+, pnpm 10+, Docker (Supabase local).

```bash
pnpm install
pnpm db:start                 # sobe Supabase local (Postgres, Studio, Kong)
cp apps/web/.env.local.example apps/web/.env.local
# preencher CLERK_* e SUPABASE_* (URL + keys vêm do `db:start`)
pnpm dev                      # sobe os três apps em paralelo
```

`pnpm dev` sobe:

- `apps/web` — Next.js (UI + API routes) — http://localhost:3000
- `apps/agent-runtime` — serviço Node (Hono) — http://localhost:3001
- `apps/workers` — workers BullMQ (sem servidor HTTP)

## Estrutura

```
apps/
  web/              Next.js 15 App Router
  agent-runtime/    Node + Hono
  workers/          Node + BullMQ
packages/
  shared-types/     Tipos TS compartilhados
  shared-config/    Validação de env (Zod) e constants
  shared-db/        Cliente Supabase, tipos gerados
  shared-prompts/   Prompts versionados (placeholder)
  shared-domain/    Repositórios + modelo contábil
supabase/
  migrations/       SQL migrations
  config.toml       config local
tests/
  integration/      RLS / multi-tenant (vai contra Supabase local)
```

## Comandos

### Geral
- `pnpm dev` — todos os apps em paralelo
- `pnpm build` — build geral
- `pnpm lint` — lint
- `pnpm typecheck` — type-check em todos os pacotes
- `pnpm test` — testes unitários (Vitest)
- `pnpm test:integration` — testes de RLS contra Supabase local

### Supabase
- `pnpm db:start` — sobe Postgres + Studio + Kong locais (Docker)
- `pnpm db:stop` — derruba os containers
- `pnpm db:reset` — recria DB e aplica todas as migrations do zero
- `pnpm db:migrate` — aplica migrations pendentes
- `pnpm db:types` — gera tipos TS em `packages/shared-db/src/database.types.ts`
- `pnpm db:diff` — gera migration a partir de mudanças no schema

## Integração Clerk + Supabase

Usamos **Third-Party Auth Native** (Clerk como issuer, Supabase valida JWT via JWKS).
Não usamos o JWT template legado, que foi deprecated em abril/2025.

Pra ativar localmente:

1. `CLERK_DOMAIN=<seu-app>.clerk.accounts.dev` no `apps/web/.env.local`
2. No `supabase/config.toml`, mudar `[auth.third_party.clerk] enabled = true`
3. `pnpm db:stop && pnpm db:start`

O domain é validado pelo Supabase contra a API do Clerk no boot. Por isso o
default da config é `enabled = false` — `pnpm db:start` precisa funcionar
offline (CI, dev sem keys).

## CI

![CI](https://github.com/levilael/office/actions/workflows/ci.yml/badge.svg)

Roda em todo PR e push em `main`: typecheck, lint, test e build via pnpm + Turborepo (cache de pnpm store e `.turbo/` reaproveitado entre runs).

## Regras

Veja [CLAUDE.md](./CLAUDE.md) e [.claude/rules/](./.claude/rules/) para princípios e regras detalhadas.
