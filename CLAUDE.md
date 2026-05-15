# CLAUDE.md

Plataforma multi-tenant de agentes de IA pra escritórios contábeis brasileiros. Operação por departamentos com UI de "escritório virtual" isométrico. Cliente alvo: 4-15 pessoas. Posicionamento: amplifica equipe, não substitui.

## Princípios (filtro de toda decisão)

1. **Plataforma, não produto.** Departamento novo = config + lógica de domínio.
2. **Estado canônico compartilhado.** Departamentos consultam o mesmo modelo.
3. **Determinismo onde possível, IA onde necessário.** Agente decide, workflow executa.
4. **Human-in-the-loop em toda ação externa de impacto.**
5. **Auditabilidade total e imutável** (requisito regulatório).
6. **Multi-tenant dia 1.** RLS em toda tabela com `tenant_id`.
7. **Autonomia em tiers** (manual / sugestivo / semi-autônomo / autônomo) por agente por tenant.

## Stack (não desviar sem ADR)

- Web: Next.js 14 App Router, TypeScript estrito, Tailwind, shadcn/ui, PixiJS, Socket.io, TanStack Query, Zustand
- Agentes: serviço Node separado com LangGraph.js; BullMQ pra filas; Temporal só a partir da Fase 2
- Dados: Supabase (Postgres + Storage + Realtime), pgvector, Redis
- Auth: Clerk com Organizations (Clerk Org = Tenant)
- LLM: Claude Sonnet 4 padrão | Opus 4.7 crítico | Haiku 4.5 triagem; OpenAI fallback; Langfuse pra tracing
- Observabilidade: Langfuse + Sentry + Better Stack + PostHog

## Hierarquia de dados

`platform → tenants (escritórios) → accounts (empresas clientes) → entities`

Toda tabela de domínio carrega `tenant_id`. RLS obrigatório.

## Regras de código

- TypeScript estrito (`strict`, `noUncheckedIndexedAccess`). Sem `any` exceto com comentário justificando.
- Server Components por padrão; Client Components só quando necessário.
- Toda entrada e saída de API route validada com Zod.
- Imports absolutos via `@/...`.
- Lógica de domínio em `packages/shared-domain`; nunca dentro de API route.
- Sem chamada direta de LLM em React — sempre via serviço de agentes.
- Erros sempre logados com `trace_id` e contexto; nunca silenciados.
- `pnpm lint` e `pnpm test` passam antes de commit. Sem commit em `main` — sempre PR.

## Regras de agentes

- Toda chamada de LLM passa por wrapper que registra: prompt versionado, modelo, latência, custo, `trace_id` no Langfuse.
- Agentes comunicam via bus de eventos (BullMQ). Sem chamadas diretas entre agentes.
- Todo agente declara: papel, ferramentas (whitelist), escopo, prompt versionado, budget (tokens/turnos/$).
- Ação externa: passar por aprovação respeitando o tier do tenant. Ação de impacto regulatório SEMPRE aprova, independente do tier.
- Loop detectado (mesma ação 3+ vezes) ou budget esgotado → escala pro supervisor.

## Regras de multi-tenancy

- Toda query filtra por `tenant_id` explícito OU usa cliente Supabase com RLS ativo.
- `tenant_id` vem do JWT do Clerk, nunca da URL ou body.
- `service_role` só em código server-side e com filtro manual explícito.
- Chaves Redis prefixadas com `tenant_id`.
- Feature nova que toca dados → teste de isolamento entre 2 tenants é obrigatório.

## Regras de auditoria

- Toda ação relevante grava em `audit_log`: `trace_id`, `tenant_id`, `account_id`, actor, action, resource, before/after, `prompt_version`, model, `cost_usd`, timestamp, metadata.
- `audit_log` é INSERT-only. Sem policy de UPDATE ou DELETE.
- Logs estruturados em JSON com `trace_id` propagado em toda chamada.
- Falha em logar = falha da operação (não silenciar pra continuar).

## Estrutura do monorepo

```
apps/
  web/                  # Next.js (UI + API routes)
  agent-runtime/        # Serviço Node com LangGraph
  workers/              # Workers BullMQ
packages/
  shared-domain/        # Modelo contábil compartilhado
  shared-db/            # Schema, migrations, tipos Supabase
  shared-prompts/       # Prompts versionados
  shared-types/         # Tipos TS compartilhados
  shared-config/        # Env, constants
.claude/rules/          # Regras detalhadas por tema
docs/adrs/              # ADRs
```

Cada `apps/*` pode ter CLAUDE.md local com contexto específico que sobrescreve o raiz.

## Comandos

- `pnpm dev` — todos apps em paralelo
- `pnpm build` — build geral
- `pnpm test` / `pnpm test:e2e` — unit / E2E
- `pnpm lint` — lint + format check
- `pnpm db:migrate` / `pnpm db:types` — schema Supabase

## NÃO fazer

- LLM direto de React → sempre via serviço de agentes
- Tabela sem `tenant_id` + RLS (exceto plataforma)
- Pular aprovação humana em ação regulatória
- `any` sem comentário justificando
- Lógica de domínio em API route
- Nova dependência grande sem ADR
- Commit direto em `main`
- Decidir arquitetura sozinho — escalar (ver seção abaixo)

## Quando pausar e perguntar

- **Domínio contábil** (regime tributário, obrigação, prazo, cálculo, termo do nicho) → não chutar, pedir confirmação. Levi consulta o sócio.
- **Decisão arquitetural** que toca um princípio ou introduz padrão novo → pausar, levar pro projeto Claude web, voltar com decisão e ADR.
- **Produto** (escopo, prioridade, UX) → pausar, levar pro projeto Claude web.

Dentro de padrão já estabelecido: executar sem perguntar.

## Modelos preferidos pra rodar Claude Code

- Tarefa simples (rename, lint fix, busca): Haiku 4.5
- Tarefa operacional típica: Sonnet 4
- Tarefa crítica (refactor grande, debug complexo, decisão arquitetural local): Opus 4.7

## Referências

- `@docs/escopo-produto.md` — escopo completo
- `@docs/adrs/` — decisões arquiteturais
- `@.claude/rules/multi-tenancy.md` — RLS, hierarquia, isolamento
- `@.claude/rules/agents-architecture.md` — runtime, handoffs, memória
- `@.claude/rules/llm-cost.md` — budgets, cascade, cache
- `@.claude/rules/auditability.md` — o que registrar
- `@.claude/rules/llm-prompts.md` — estrutura padrão de prompts
- `@.claude/rules/testing.md` — pirâmide, mock de LLM, eval
- `@.claude/rules/contabilidade-brasileira.md` — glossário e regras do nicho
