# Office

Plataforma multi-tenant de agentes de IA para escritórios contábeis brasileiros.

**Status:** Fim da Fase 0 — Fundações (✅ `v0.1.0-fase-0`). Hello world ponta a ponta validado (web → BullMQ → agent-runtime → Claude → audit/Langfuse), custo de LLM medido, infra multi-tenant funcionando com Clerk + Supabase Cloud + Redis nativo + Socket.io.

Próxima fase: implementação do primeiro departamento (Atendimento).

## Setup

Pra subir o projeto do zero numa máquina nova, ver **[docs/development.md](./docs/development.md)** — pré-requisitos, envs, infra (Redis nativo + Supabase Cloud), validação e gotchas.

```bash
pnpm install
# seguir docs/development.md pra envs e infra
pnpm dev
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
  integration/      RLS / multi-tenant (roda contra Supabase Cloud do dev)
```

## Comandos

### Geral
- `pnpm dev` — todos os apps em paralelo
- `pnpm build` — build geral
- `pnpm lint` — lint
- `pnpm typecheck` — type-check em todos os pacotes
- `pnpm test` — testes unitários (Vitest)
- `pnpm test:integration` — testes de RLS contra Supabase Cloud

### Supabase (Cloud em dev — ver ADR-012)

- `pnpm exec supabase login` — autentica a CLI
- `pnpm exec supabase link --project-ref <ref>` — linka projeto local com cloud
- `pnpm exec supabase db push --linked` — aplica migrations no projeto cloud
- `pnpm exec supabase db diff --linked` — gera migration a partir do schema (precisa de Docker pra shadow DB)
- `pnpm exec supabase gen types typescript --linked > packages/shared-db/src/database.types.ts`

## Integração Clerk + Supabase

Usamos **Third-Party Auth Native** (Clerk como issuer, Supabase valida JWT via JWKS).
Não usamos o JWT template legado, que foi deprecated em abril/2025.

Configuração no Supabase Cloud: Dashboard → Authentication → Sign In/Up → Third Party Auth → adicionar Clerk com `CLERK_DOMAIN` (sem `https://`). Detalhes em [docs/development.md](./docs/development.md#supabase-cloud-adr-012).

## CI

![CI](https://github.com/levilael/office/actions/workflows/ci.yml/badge.svg)

Roda em todo PR e push em `main`: typecheck, lint, test e build via pnpm + Turborepo (cache de pnpm store e `.turbo/` reaproveitado entre runs).

## Regras

Veja [CLAUDE.md](./CLAUDE.md) e [.claude/rules/](./.claude/rules/) para princípios e regras detalhadas.
