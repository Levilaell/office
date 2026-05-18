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

### TD-015 🟡 Eval do Coordenador roda em replay puro, sem accuracy de modelo real

**Detectado em:** Sprint 1.2 (2026-05-19)
**Impacto:** `apps/agent-runtime/src/agents/atendimento/coordenador/__tests__/eval.test.ts` testa a pipeline (parse JSON + decide + ação) com 37 fixtures, mas o LLM é mockado. Mudança de prompt que degrada accuracy semântica NÃO é detectada por essa bateria — só estrutura é validada.
**Solução:** workflow scheduled (diário/semanal) que roda eval com LLM real contra fixtures + cassettes gravados; threshold de regressão (ex: < 5% de queda em accuracy de classificação) reprova promoção de prompt.
**Quando atacar:** Sprint 1.5+ (modo shadow + eval contínuo)

### TD-016 🟢 Catálogo de intents do Atendimento é constante, não tabela `intents`

**Detectado em:** Sprint 1.2 (2026-05-19)
**Impacto:** `packages/shared-domain/src/atendimento/intents.ts` define 15 intents como constante tipada. Tenants não podem customizar (adicionar/remover/redefinir defaultDecision). Suficiente pra Fase 1; vira gargalo quando escritórios pedirem taxonomia própria.
**Solução:** migration cria tabela `intents` (tenant_id, slug, display_name, category, default_decision, target_agent_key, template_id, always_human, alwaysHuman). Seed inicial popula a constante atual. Catálogo passa a ser carregado por tenant.
**Quando atacar:** primeiro tenant que pedir customização OU início da Fase 2

### TD-017 🟡 UI de configuração de tier de autonomia ausente

**Detectado em:** Sprint 1.2 (2026-05-19)
**Impacto:** `agents.autonomy_tier` é coluna no DB com default `sugestivo`. Sprint 1.2 lê (Coordenador apenas; sem efeito prático ainda) mas não há UI. Mudança de tier exige SQL direto.
**Solução:** página `/dashboard/configuracoes/agentes` com lista de agentes do tenant + dropdown de tier (com permission check pra owner/manager). Mudança grava em `audit_log` com before/after.
**Quando atacar:** Sprint 1.5 (modo shadow completo) — modo shadow precisa que operador alterne tiers facilmente pra observar comportamento

### TD-018 🟡 `conversations` não tem coluna `assigned_to` nem status `waiting_human`

**Detectado em:** Sprint 1.2 (2026-05-19)
**Impacto:** Sprint 1.2 marca conversation como aguardando humano via `metadata.assigned_to_human=true` em vez de mexer no CHECK constraint de `conversations.status`. Funciona mas força UI a olhar metadata; queries futuras tipo "todas as conversations aguardando humano" precisam ler metadata em vez de status.
**Solução:** migration adiciona coluna `assigned_to UUID NULL REFERENCES users(id)` + amplia CHECK de status com `'waiting_human'`. Refactor de `act.ts` pra setar status + assigned_to em vez de patch metadata. Backfill: tudo com metadata.assigned_to_human=true vira status='waiting_human'.
**Quando atacar:** Sprint 1.3 (quando especialista entrar) ou Sprint 1.5

### TD-019 📘 Coordenador subscreve `message.received` direto; ADR-016 prevê `message.routed`

**Detectado em:** Sprint 1.2 (2026-05-19)
**Impacto:** ADR-016 desenhou 3 camadas (Roteador global → Coordenador → Especialista). Na Fase 1, com Atendimento como único departamento, Coordenador subscreve direto a `message.received` — Roteador não roda em mensagens inbound de canais externos (só na rota `/api/triagem`). Quando segundo departamento entrar (Fase 2), Coordenador atual vai roteamento erroneamente toda mensagem inbound como Atendimento.
**Solução:** introduzir evento `message.routed` (publicado pelo Roteador após classificar departamento). Coordenadores subscrevem `message.routed` filtrando pelo destination_department. Worker de "ingest inbound → Roteador" entra na cadeia entre o canal e o Coordenador.
**Quando atacar:** Sprint quando segundo departamento (provavelmente Pessoal ou Fiscal) for ativado — sem desvio na Fase 1 com 1 departamento
**Status:** documentado em ADR-019 (não é dívida ativa — é decisão consciente com critério de reabertura)

### TD-020 🟢 Pre-classify determinístico é mínimo

**Detectado em:** Sprint 1.2 (2026-05-19)
**Impacto:** `pre-classify.ts` resolve só não-texto e saudações curtas. Mensagens com palavras-chave fortes de urgência ("multa", "intimação") ainda passam pelo LLM. Custo evitável.
**Solução:** regex pra urgência crítica + classificação determinística pra `urgente`. Adicionar match de palavras-chave configuráveis por tenant na Fase 2.
**Quando atacar:** Sprint 1.5+ quando análise de custo revelar volume de mensagens urgentes que justifique

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
