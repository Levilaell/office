# Tech Debt

Lista priorizada de dívidas técnicas conhecidas. Não é backlog completo —
só itens identificados durante implementação que merecem revisita.

## Severidade

- 🔴 **Alta**: bug latente ou risco de produção
- 🟡 **Média**: limita evolução ou qualidade
- 🟢 **Baixa**: melhoria de DX/qualidade marginal

---

## Itens abertos

### TD-003 🟡 Eventos `task.*` e `approval.*` carregam delta, não snapshot

**Detectado em:** Sprint 0.3d-A (commit 21be719)
**Impacto:** RealtimeProvider precisa refetch da coleção inteira ao receber evento (`replaceTasks`, `replaceApprovals`); ineficiente com >100 entidades concorrentes ou alta frequência de eventos
**Solução:** migrar payloads pra carregar snapshot completo da entidade afetada; permite mergear delta no store sem refetch
**Estimativa:** médio (~4h) — requer atualizar schemas em shared-events + producers em agent-runtime + consumers no provider
**Quando atacar:** quando demo pro sócio mostrar fila de >50 approvals OU quando latência de update virar reclamação

### TD-005 🟢 Script `scripts/seed-existing-tenants.ts` aponta pra URL errada

**Detectado em:** 2026-05-15 (chat sessão Fase 0)
**Impacto:** script bate em supabase.com em vez da API REST; usa env default em vez do `.env.local`
**Solução:** garantir leitura via dotenvx + usar `SUPABASE_URL` do env correto; ou rodar com `dotenvx run`
**Estimativa:** trivial (~20min)
**Quando atacar:** quando precisar reseedar tenants existentes (situação rara após onboarding síncrono da ADR-007)

### TD-006 🟡 `.env.local` duplicado em 3 apps

**Detectado em:** 2026-05-15
**Impacto:** dev precisa manter 3 cópias sincronizadas; fácil de divergir
**Solução:** single fonte na raiz + dotenvx `--env-file=../../.env.local` nos apps; Next.js requer hack (`next.config.ts` com `loadEnvConfig`) pra ler de fora do diretório
**Estimativa:** médio (~2h) — incluindo validação que Next continua lendo certo
**Workaround atual:** `.env.example` documentado (Sessão A) + script `check-env.ts` validando (este worktree, TD-007)

### TD-007 🟢 Turbo dev sai com "Tasks: 0 successful, 3 total"

**Detectado em:** 2026-05-15
**Impacto:** cosmético, mas assusta dev novo. Long-running dev servers nunca "completam" no modelo turbo
**Solução:** investigar `turbo.json` flag `persistent: true` na task `dev`; configurar UI mode adequado
**Estimativa:** baixo (~30min)

### TD-008 🟢 ESLint 8 deprecated

**Detectado em:** Sprint 0.3c
**Impacto:** warning no install; sairá do suporte em algum momento
**Solução:** migrar pra ESLint 9 quando Next.js 16 sair (que vai depreciar `next lint`)
**Estimativa:** baixo, esperar Next 16

### TD-009 🟢 Warning peer dep do Clerk v7 no Next 15

**Detectado em:** Sprint 0.3a
**Impacto:** warning no install, mas Clerk funciona OK em runtime
**Solução:** esperar próxima release de @clerk/nextjs com peer dep atualizada

### TD-010 🟢 Naming inconsistente de ADRs 001-009 vs 010-017

**Detectado em:** 2026-05-18 (durante criação dos ADRs 014-017)
**Impacto:** cosmético — busca/grep em histórico fica ligeiramente fragmentada. ADRs 001-009 usam `ADR-NNN-titulo.md`; 010-017 usam `NNN-titulo.md` (sem prefixo). Convenção mais recente é a sem prefixo.
**Solução:** renomear ADRs 001-009 pro padrão `NNN-titulo.md`. Atualizar referências em `docs/adrs/README.md`, `CLAUDE.md` e qualquer outro lugar que mencione por nome de arquivo.
**Quando atacar:** quando houver outro motivo pra mexer em `docs/adrs/` (criação de novo ADR, refatoração de docs etc). Não justifica PR isolado.

### TD-011 🟢 `docs/adrs/README.md` sem seções por status

**Detectado em:** 2026-05-18 (durante criação dos ADRs 014-017)
**Impacto:** estrutural — README atual lista ADRs sob `## Aceitos` mas não tem seções pra `superseded`, `depreciado` ou outros status. Quando o primeiro ADR mudar de status, o índice precisa crescer.
**Solução:** refatorar README com seções por status (`## Aceitos`, `## Superseded`, `## Depreciados`). Eventualmente adotar tabela única com coluna de status se a lista crescer muito.
**Quando atacar:** trigger é o primeiro ADR transitar pra status não-aceito. Não há valor em fazer antes.

### TD-013 🟡 Webpack Next.js não resolve imports relativos com extensão .js em shared-domain

**Detectado em:** CI de main após merge do Sprint 1.0 aligned (commit 3e3cfad)
**Impacto:** build de produção quebra; passa typecheck/lint/test porque vitest e tsx aceitam .js
**Solução temporária:** removidos `.js` dos imports relativos em `packages/shared-domain/src/triagem/index.ts` (hotfix fix/triagem-import-extensions)
**Causa raiz:** moduleResolution config divergente entre runtime (NodeNext em alguns lugares, Bundler em outros) e o que webpack do Next.js espera
**Quando atacar:** próximo sprint que tocar config TS dos packages — alinhar moduleResolution em todo o monorepo (provavelmente Bundler em todos)

### TD-014 🟢 CI do PR #2 (Sprint 1.0-prep) não pegou quebra de build introduzida lá

**Detectado em:** mesmo commit do TD-013
**Impacto:** quebra só apareceu em main, no CI pós-merge
**Causa provável:** `apps/web/src/app/dashboard/page.tsx` não importava de `shared-domain` no momento do PR #2; o Sprint 1.0 aligned (PR #3) introduziu o import. Build do PR #3 também passou em algum momento — investigar histórico de Actions pra entender quando virou vermelho.
**Solução:** investigar histórico CI do PR #2 e PR #3. Se confirmado que `pnpm build` não rodou ou passou por config errada, ajustar CI.
**Quando atacar:** próxima sessão de manutenção de CI

### TD-012 🟡 `database.types.ts` editado à mão; precisa regenerar via `pnpm db:types`

**Detectado em:** Sprint 1.0 finalização (2026-05-18)
**Impacto:** os tipos do Supabase em `packages/shared-db/src/database.types.ts` foram editados manualmente em 3 momentos: (1) Sprint 1.0 original criou as tabelas `conversations`+`interactions` à mão; (2) Sprint 1.0-aligned renomeou `interactions`→`messages` à mão; (3) Sprint 1.0-aligned adicionou `conversations.intent_current` à mão. Se alguém rodar `pnpm db:types` contra cloud que ainda não tem TODAS as migrations aplicadas, os tipos regridem silenciosamente — e o build quebra de forma confusa.
**Solução:** após o merge desta PR, aplicar as 3 migrations no Supabase Cloud (`20260515103000_atendimento_foundations`, `20260518163051_rename_interactions_to_messages`, `20260518163548_conversations_intent_current`) e então rodar `pnpm db:types --linked` pra alinhar tipos com schema real. Commitar o resultado.
**Quando atacar:** parte do processo operacional de merge desta PR. Idealmente antes de Sprint 1.1 começar a consumir os tipos.

---

## Itens fechados

### TD-002 ✅ `incrementRunUsage` varria `agent_messages.content` em vez de accumulator

**Detectado em:** Sprint 0.3c
**Fechado em:** Sprint 1.0-prep (2026-05-18)
**Solução aplicada:** invertida a estratégia — o agente acumula tokens/custo direto após cada `llmCall` chamando `incrementRunUsage` (agora com signature por objeto: `{ turns?, tokensIn, tokensOut, costUsd }`, turns default = 1). Worker em `agent-runtime/workers/agent-tasks.ts` deixou de escanear `agent_messages`. Semântica de `turns` formalizada como "número de chamadas de LLM no run", coerente com `agents.budget.maxTurns`. Função agora throwa `RunNotFoundError` em vez de retornar null silenciosamente — tokens perdidos viram bug invisível de billing. Testes em `packages/shared-domain/src/runs/__tests__/increment-run-usage.test.ts` cobrem soma sequencial, default de turns, runs ausentes.

**Residual:** read-modify-write não é atômico em multi-writer. Aceitável hoje porque runs são single-threaded por design (1 worker BullMQ processa 1 run por vez). Atomicidade real exigiria função Postgres + migration — registrado como caminho futuro mas sem TD ativo enquanto runs forem single-threaded.

### TD-001 ✅ `enqueueTriagem` fazia 2 writes na tabela tasks

**Detectado em:** Sprint 0.3c (commit e447a43)
**Fechado em:** Sprint 1.0-prep (2026-05-18)
**Solução aplicada:** `createTask` em `packages/shared-domain/src/tasks/index.ts` ganhou campo opcional `assignedAgentId`; quando presente, o INSERT já popula `assigned_agent_id` e seta `status='assigned'`. `enqueueTriagem` (agora em `packages/shared-domain/src/triagem/index.ts`) usa o novo campo — 1 write em vez de 2. Audit ainda registra `task.created` E `task.assigned` separadamente porque são duas transições lógicas; colapsar perderia informação no histórico.

### TD-004 ✅ `decideApproval` sem `eq('status', 'pending')` no UPDATE

**Detectado em:** Sprint 0.3d-B
**Fechado em:** Sprint 1.0-prep (2026-05-18)
**Solução aplicada:** `packages/shared-domain/src/approvals/index.ts` agora aplica `.eq('status','pending')` no UPDATE e lança `ApprovalRaceConditionError` se zero rows. Endpoint `POST /api/approvals/[id]/decide` traduz o erro pra HTTP 409 com body `{ error: 'approval_already_resolved', approvalId }`. Testes em `packages/shared-domain/src/approvals/__tests__/decide-approval.test.ts`.
