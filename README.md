# Office

Plataforma multi-tenant de agentes de IA para escritórios contábeis brasileiros.

## Rodar localmente

### Pré-requisitos

- Node 20+, pnpm 10+
- Docker (Desktop, OrbStack ou compatível) — usado por Supabase e Redis
- Supabase CLI (já em `devDependencies` do workspace)

### Dependências de infra

```bash
# Supabase local (Postgres + Studio + Kong em http://localhost:54323)
pnpm db:start

# Redis (BullMQ + pub/sub — obrigatório a partir da Sprint 0.3b)
docker compose up -d redis

# Conferir saúde
docker compose ps

# Tudo junto pra dev local:
docker compose up -d redis    # Redis
pnpm db:start                 # Supabase
pnpm dev                      # web (3000), agent-runtime (3001 http+ws), workers
```

Pra parar:

```bash
pnpm db:stop
docker compose down            # mantém dados do Redis no volume
docker compose down -v         # apaga volumes (Redis zera)
```

### Variáveis de ambiente

- `.env.example` na raiz — variáveis comuns aos apps (ex: `REDIS_URL`)
- `apps/web/.env.local.example` — Clerk + Supabase
- `apps/agent-runtime/.env.example` — Anthropic + Langfuse (a partir da Sprint 0.3a)

```bash
pnpm install
cp apps/web/.env.local.example apps/web/.env.local
# preencher CLERK_* e SUPABASE_* (URL + keys vêm do `db:start`)
```

### Apps

```bash
pnpm dev                      # sobe os três apps em paralelo
```

- `apps/web` — Next.js (UI + API routes) — http://localhost:3000
- `apps/agent-runtime` — serviço Node (Hono + Socket.io + workers BullMQ) — http://localhost:3001 (http + ws no `/socket.io`)
- `apps/workers` — placeholder reservado para notificações outbound (sem código real ainda; workers de agente vivem em `apps/agent-runtime`)

### Testar fluxo de triagem (Sprint 0.3c)

Pipeline completo: API web → BullMQ → agent-runtime → Claude → audit/Langfuse.

```bash
# 1. subir infra
docker compose up -d redis
pnpm db:start

# 2. subir apps (em outro terminal)
pnpm dev

# 3. seedar roteador em tenants existentes (idempotente)
pnpm seed:agents

# 4. validação rápida via teste de integração (precisa de ANTHROPIC_API_KEY + LANGFUSE_*)
pnpm test:integration
```

Disparar `POST /api/triagem` via browser autenticado:

```bash
# Recupera session cookie do browser logado, depois:
curl -X POST http://localhost:3000/api/triagem \
  -H 'cookie: <session do browser>' \
  -H 'content-type: application/json' \
  -d '{"text":"Recebi um boleto de ICMS pra pagar, qual o vencimento?"}'
# → 202 { "taskId": "...", "traceId": "..." }

# Acompanhar status:
curl http://localhost:3000/api/tasks/<taskId> -H 'cookie: <session>'
# → { "status": "completed", "result": { "department": "fiscal", ... } }
```

## Estrutura

```
apps/
  web/              Next.js 15 App Router
  agent-runtime/    Node + Hono + Socket.io + workers BullMQ
  workers/          Reservado pra notificações outbound (placeholder)
packages/
  shared-types/     Tipos TS compartilhados
  shared-config/    Validação de env (Zod) e constants
  shared-db/        Cliente Supabase, tipos gerados
  shared-prompts/   Prompts versionados (placeholder)
  shared-domain/    Repositórios + modelo contábil
  shared-events/    BullMQ + Redis pub/sub + schemas de eventos
  shared-llm/       Wrapper Anthropic + tracing Langfuse + budget
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
