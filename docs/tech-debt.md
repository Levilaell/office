# Tech Debt

Lista priorizada de dívidas técnicas conhecidas. Não é backlog completo —
só itens identificados durante implementação que merecem revisita.

## Severidade

- 🔴 **Alta**: bug latente ou risco de produção
- 🟡 **Média**: limita evolução ou qualidade
- 🟢 **Baixa**: melhoria de DX/qualidade marginal

---

## Itens abertos

### TD-001 🟡 `enqueueTriagem` faz 2 writes na tabela tasks

**Detectado em:** Sprint 0.3c (commit e447a43)
**Impacto:** dobra writes desnecessários; race window pequena entre create e assignTask
**Solução:** combinar em INSERT único com `assigned_agent_id` já preenchido
**Estimativa:** trivial (~30min)

### TD-002 🟡 `incrementRunUsage` varre `agent_messages.content` em vez de accumulator

**Detectado em:** Sprint 0.3c
**Impacto:** funciona pra single-call mas vai falhar/imprecisar quando agentes fizerem multi-call (ex: Sonnet com tool use iterativo)
**Solução:** adicionar `usage` e `costUsd` accumulator explícito no AgentContext, propagado pelo wrapper de LLM
**Estimativa:** médio (~2h)
**Bloqueador:** entra obrigatoriamente na Sprint 0.4 (primeiro agente multi-call)

### TD-003 🟡 Eventos `task.*` e `approval.*` carregam delta, não snapshot

**Detectado em:** Sprint 0.3d-A (commit 21be719)
**Impacto:** RealtimeProvider precisa refetch da coleção inteira ao receber evento (`replaceTasks`, `replaceApprovals`); ineficiente com >100 entidades concorrentes ou alta frequência de eventos
**Solução:** migrar payloads pra carregar snapshot completo da entidade afetada; permite mergear delta no store sem refetch
**Estimativa:** médio (~4h) — requer atualizar schemas em shared-events + producers em agent-runtime + consumers no provider
**Quando atacar:** quando demo pro sócio mostrar fila de >50 approvals OU quando latência de update virar reclamação

### TD-004 🔴 `decideApproval` sem `eq('status', 'pending')` no UPDATE

**Detectado em:** Sprint 0.3d-B (relatório do CC)
**Impacto:** race em decisões concorrentes (2 reviewers clicam aprovar ao mesmo tempo); aceitável pra MVP single-reviewer mas vira bug real em demo multi-user
**Solução:** adicionar filtro no UPDATE + checar `rowsAffected`; se 0, retornar erro "approval já decidido"
**Estimativa:** trivial (~30min)
**Prioridade:** fechar antes de demo pro sócio

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

---

## Itens fechados

(quando fechar um TD, mover pra cá com data e link de commit)
