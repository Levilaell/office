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

Versões refletem o instalado em maio/2026 (Fase 0 fechada). Lock no `pnpm-lock.yaml`.

- Web: Next.js 15.5 App Router, React 19, TypeScript estrito, Tailwind 3.4, shadcn/ui, PixiJS 8, Socket.io-client 4, Zustand 5
- Agentes: serviço Node separado com LangGraph.js 1.3 + Hono 4; BullMQ 5 pra filas; Temporal só a partir da Fase 2
- Dados: Supabase Cloud (Postgres + Storage + Realtime, ADR-012), pgvector, Redis nativo em dev (ADR-013)
- Auth: Clerk v7 com Organizations (Clerk Org = Tenant, ADR-004); TPA nativo no Supabase (ADR-005)
- LLM: @anthropic-ai/sdk 0.96 — Claude Sonnet 4 padrão | Opus 4.7 crítico | Haiku 4.5 triagem; OpenAI como fallback futuro
- Observabilidade: Langfuse 5 (tracing LLM) já integrado; Sentry + Better Stack + PostHog planejados (Fase 1+)

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
- `pnpm lint` e `pnpm test` passam antes de commit.

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

## Política de PR vs commit direto

**Default: PR obrigatório.** Não fazer commits direto em `main` exceto nos casos abaixo.

**Commit direto em `main` permitido APENAS quando todas as condições forem satisfeitas:**
1. Mudança mecânica e óbvia (< 30 linhas, lógica trivial)
2. Erro de implementação seria visível em segundos (build/lint/test quebra na hora)
3. Não toca: schema, migrations, multi-tenancy, auth, RLS, audit, wrapper LLM, prompts, agentes, CI, deps grandes
4. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` rodados local e verdes ANTES do push

**Casos típicos:** fix de typo, fix de import path / extensão, fix de lint trivial, atualização de doc/comentário sem mudança de código, fix de config óbvia (env var faltando).

**Em qualquer dúvida, vai PR.** A regra existe pra preservar gate de revisão em mudanças não-triviais, não pra criar fricção em hotfix de 5 minutos.

**Mesmo em commit direto, CI tem que passar.** Não é "skipa tudo", é "skipa o PR review".

Detalhes em `.claude/rules/pr-policy.md`.

## Estrutura do monorepo

```
apps/
  web/                  # Next.js (UI + API routes)
  agent-runtime/        # Serviço Node com LangGraph + Socket.io
  workers/              # Reservado pra notificações outbound (placeholder)
packages/
  shared-domain/        # Lógica de domínio + repositórios + triagem
  shared-db/            # Cliente Supabase + tipos gerados
  shared-events/        # BullMQ queues + Redis pub/sub + schemas Zod
  shared-llm/           # Wrapper Anthropic + tracing Langfuse + budget
  shared-prompts/       # Prompts versionados
  shared-types/         # Tipos TS compartilhados (enums, branded types)
  shared-config/        # Env (Zod) + constants
.claude/rules/          # Regras detalhadas por tema
docs/adrs/              # ADRs
```

Cada `apps/*` pode ter CLAUDE.md local com contexto específico que sobrescreve o raiz.

## Estado atual (v0.1.0-fase-0, entrando em Fase 1)

- Fase 0 (Fundações): CONCLUÍDA. Tag `v0.1.0-fase-0`.
- Sprint 0.3e (runs/métricas no AgentSheet): CONCLUÍDA. UI de runs recentes e métricas (24h/7d/30d) por agente já live.
- Sprint 1.0-prep: CONCLUÍDA. Fechou TD-001, TD-002, TD-004. Triagem migrou pra `packages/shared-domain/src/triagem` (ponto de entrada único pra rota Next e futuros webhooks de canal).
- Hello world: roteador Haiku 4.5 classificando triagens em produção. Custo médio ~USD 0.0008, latência 2-3s ponta a ponta.
- Cobertura: 80 testes unit + 17 integration verdes (rodam em `pnpm test` e `pnpm test:integration`).
- Departamentos: só `platform` tem agente real (Roteador). `atendimento`, `societario`, `pessoal`, `contabil`, `fiscal`, `financeiro_interno` têm salas no escritório 2D mas vazios.
- ADRs de Fase 1 publicados (014-017): escopo do Atendimento, ChannelAdapter, Coordenador, modo shadow + tiers de autonomia em conversa síncrona.
- Próximo: Sprint 1.0 — Fundações de Atendimento (schema `conversations` + `messages`, seed dos 3 agentes, endpoint dev `inbound/simulate`). PR de integração: `feat/atendimento-foundations-aligned`. Sprint 1.1 conecta o Coordenador real ao bus; Sprint 1.3 introduz ChannelAdapter e canais reais.

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
- `@docs/adrs/` — decisões arquiteturais (incluindo 014-017 para Fase 1: escopo Atendimento, ChannelAdapter, Coordenador, modo shadow)
- `@docs/tech-debt.md` — dívidas técnicas conhecidas, priorizadas
- `@docs/development.md` — setup e workflow de dev
- `@docs/levantamento.md` — snapshot completo do código (estrutura, schemas, kernels, gaps) congelado no fim da Fase 0. Útil pra orientar uma sessão fresca sem ter que reexplorar o repo.
- `@.claude/rules/multi-tenancy.md` — RLS, hierarquia, isolamento
- `@.claude/rules/agents-architecture.md` — runtime, handoffs, memória
- `@.claude/rules/llm-cost.md` — budgets, cascade, cache
- `@.claude/rules/auditability.md` — o que registrar
- `@.claude/rules/llm-prompts.md` — estrutura padrão de prompts
- `@.claude/rules/testing.md` — pirâmide, mock de LLM, eval
- `@.claude/rules/contabilidade-brasileira.md` — glossário e regras do nicho
