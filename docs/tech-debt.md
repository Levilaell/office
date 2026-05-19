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

<!-- TD-017 fechado no Sprint 1.5 — ver seção "Itens fechados" no fim do arquivo. -->

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

### TD-021 🟢 leads.primary_contact_id sem FK (contacts não existe ainda)

**Detectado em:** Sprint 1.4
**Impacto:** referência opaca, sem enforce de integridade. Tolerável porque na Fase 1 ninguém escreve nesse campo (sempre null — Coordenador não cria contact estruturado, qualification_data.contact_name guarda nome em texto livre).
**Solução:** quando tabela `contacts` for criada (Sprint 1.5+ ou Fase 2), adicionar FK via migration aditiva (`ALTER TABLE leads ADD CONSTRAINT leads_primary_contact_id_fkey FOREIGN KEY (primary_contact_id) REFERENCES contacts(id) ON DELETE SET NULL`).
**Quando atacar:** sprint que criar tabela `contacts`.

<!-- TD-022 fechado no Sprint 1.5 — ver seção "Itens fechados" no fim do arquivo. -->

### TD-023 🟢 leads sem unique partial index em (tenant_id, primary_conversation_id)

**Detectado em:** Sprint 1.4 (advisor review)
**Impacto:** dois turnos quase-simultâneos do Especialista Comercial podem criar dois leads pra mesma conversation se rodarem antes do primeiro commit. BullMQ dedup por messageId protege parcialmente; ainda fura se duas mensagens chegarem em rajada no início (sem lead pré-existente). Em volume Fase 1 (≤ 1 cliente real, leads esparsos), nunca acontece — risco real surge ao escalar.
**Solução:** migration aditiva com `CREATE UNIQUE INDEX leads_one_per_conversation ON leads(tenant_id, primary_conversation_id) WHERE primary_conversation_id IS NOT NULL`. Repository code precisa tratar erro 23505 no `createLead` (retry via getLeadByConversationId).
**Quando atacar:** Sprint 1.5 ou quando primeiro double-lead aparecer em produção.

### TD-024 🟢 schedule-parser não converte sugestão de horário em Date

**Detectado em:** Sprint 1.4
**Impacto:** `parseScheduleSuggestion` detecta que cliente sugeriu horário mas retorna `scheduledAt=null`. Operador humano vê o texto em `leads.notes` e confirma manualmente com o cliente. Em volume baixo é tolerável; quando lead.scheduled_call_at virar gatilho de notificação/Calendar (Fase 2+), parser real vai precisar.
**Solução:** parser robusto com tz America/Sao_Paulo, mapeamento de "terça da próxima semana" → Date concreto, handling de períodos do dia ("à tarde") como range/janela. Bibliotecas tipo chrono-node podem ajudar mas adicionam dep.
**Quando atacar:** Fase 2 (integração com Calendar) ou Sprint 1.5+ quando humano reclamar do trabalho manual.

### TD-025 🟢 display_settings sem campo commercial_lead_name

**Detectado em:** Sprint 1.4
**Impacto:** T10/T10b ("Vou agendar conversa com {{responsavel_name}}") usa `tenants.display_settings.signature` como fallback. Funciona ("Vou agendar com Equipe Levi Lael") mas semanticamente ruim — `signature` é assinatura de fechamento, não nome do responsável comercial. Quando o escritório tiver vários atendentes humanos, queremos referenciar a pessoa que vai assumir.
**Solução:** adicionar `commercial_lead_name: string | null` em `display_settings`. `resolveDisplaySettings` retorna esse campo com fallback `signature || bot_name`. Especialista Comercial usa esse campo em vez de signature direto.
**Quando atacar:** Sprint 1.5 (UI de display_settings) ou quando primeiro tenant pedir.

### TD-020 🟢 Pre-classify determinístico é mínimo

**Detectado em:** Sprint 1.2 (2026-05-19)
**Impacto:** `pre-classify.ts` resolve só não-texto e saudações curtas. Mensagens com palavras-chave fortes de urgência ("multa", "intimação") ainda passam pelo LLM. Custo evitável.
**Solução:** regex pra urgência crítica + classificação determinística pra `urgente`. Adicionar match de palavras-chave configuráveis por tenant na Fase 2.
**Quando atacar:** Sprint 1.5+ quando análise de custo revelar volume de mensagens urgentes que justifique

### TD-026 🟡 Draft órfão pending em falha de envio (send_failed)

**Detectado em:** Sprint 1.3 (mental, não persistido) + Sprint 1.5 (formalizado)
**Impacto:** dois caminhos deixam draft como `pending` indefinidamente:
1. Tier `semi_autonomo` em materializeProposal: cria draft `pending` antes de chamar sendAgentMessage; se send falhar, draft fica órfão (status `pending` mas sem expires_at futuro coerente, sem operador esperado).
2. Endpoint `/decide` (approve/edit): se envio externo falhar após draft estar pending, retorna 502 mas draft continua pending — operador pode retentar mas se desistir, ocupa inbox.
Worker de expiração cobre eventualmente (15 min default) mas até lá fica visível como "fantasma" no inbox.
**Solução:** dois caminhos:
1. Marcar draft com `expires_at = now() + 5min` ou status `send_failed` separado em vez de pending, com motivo guardado em `decision_metadata.send_failure`.
2. Quando operador retenta um draft expirado, permitir reabertura (status `pending` de novo).
**Quando atacar:** Sprint 1.6+ ou primeiro reclamo de operador. Volume Fase 1 baixo, não bloqueia produção.

### TD-027 🟢 Página de detalhe de conversa não existe — badge cross-page só em leads

**Detectado em:** Sprint 1.5 (orientação)
**Impacto:** Sprint 1.5 promete badge "Rascunho pendente" em todos os cards de conversa/lead que tenham draft pending. Implementado em `/atendimento/leads` (página existe). NÃO implementado em `/atendimento/conversations/[id]` porque essa página NÃO EXISTE — só há API route `/api/conversations/[id]`, sem UI de detalhe.
**Solução:** quando UI de conversation detail for criada (provavelmente Sprint 1.6 ou Fase 2 quando inbox de mensagens unificado entrar), adicionar `usePendingDraftByConversation(conv.id)` + badge no mesmo padrão.
**Quando atacar:** quando primeira página de conversation detail for desenhada.

### TD-028 🟢 Diff de edição salvo em JSONB mas UI só mostra "editado"

**Detectado em:** Sprint 1.5 (decisão arquitetural #3)
**Impacto:** quando operador edita draft antes de aprovar, salvamos `edit_diff = { original, edited, char_distance }` no banco. UI atual renderiza apenas badge "editado" — não mostra diff visual (texto colorido add/remove).
**Solução:** componente DiffViewer (libs como react-diff-viewer ou implementação custom com diff-match-patch). Mostra side-by-side ou inline.
**Quando atacar:** Sprint 1.6+ quando primeiro tenant pedir ou eval de promoção de prompt depender de revisão das edições.

### TD-029 🟡 Janela <50ms entre read-and-send permite duplicate send

**Detectado em:** Sprint 1.5 (advisor review pós-implementação)
**Impacto:** endpoint `/decide` faz `getDraftById` → `sendAgentMessage` → `approveDraftWithMessage`. Entre a leitura e o send, outro operador concorrente pode ler o mesmo draft pending e disparar o seu próprio send. Ambos enviam, só o primeiro `approveDraftWithMessage` muda status — o segundo retorna 409 com `sentMessageId` no body, mas a mensagem dele JÁ FOI pro cliente. Cliente recebe 2 mensagens.
Em Fase 1 (1-2 operadores ativos por tenant) a probabilidade é baixa, mas existe.
**Solução:** padrão "claim atomic → send → complete". UPDATE atômico marcaria `status='approving'` ANTES de enviar; segunda chamada falha no claim com 409 e nunca envia. Após send, UPDATE final pra `approved`. Custa 1 round-trip a mais por aprovação.
**Quando atacar:** quando primeiro duplicate send aparecer (audit_log mostra 2 mensagens outbound com mesmo `source_message_id`) OU quando primeiro tenant com >3 operadores simultâneos chegar.

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

### TD-017 ✅ UI de configuração de tier de autonomia ausente

**Detectado em:** Sprint 1.2 (2026-05-19)
**Fechado em:** Sprint 1.5 (2026-05-21)
**Solução aplicada:** página `/dashboard/configuracoes/agentes` lista agentes do tenant em atendimento (Coordenador + Especialista Operacional + Especialista Comercial); dropdown muda entre `sugestivo` e `semi_autonomo`. Endpoint `PATCH /api/configuracoes/agentes/[id]` valida via novo helper `getCurrentTenantUserRole` que role do user em `tenant_users` está em `{owner_tenant, manager}`. Audit_log `agent.autonomy_tier_changed` com before/after. Tiers `manual` e `autonomo` rejeitados (Fase 1 não suporta).

### TD-022 ✅ Especialista Comercial envia direto sem materializar message_drafts

**Detectado em:** Sprint 1.4
**Fechado em:** Sprint 1.5 (2026-05-21)
**Solução aplicada:** novo helper `materializeProposal` em `packages/shared-domain/src/atendimento/materialize-proposal.ts` unifica o comportamento dos 2 Especialistas. Tier sugestivo cria draft `pending` real com `expires_at` configurável por tenant (`display_settings.drafts.expiration_minutes`, default 15min); tier semi_autonomo envia direto + draft `auto_approved` vinculado à mensagem final. Coordenador continua respondendo sociais direto (sem draft) e Especialistas escalam humano (T05/T_NO_DATA) DIRETO (sem draft) — feedback rápido pro cliente importa nessas duas exceções. Fecha também o TD-021 do self-review do Sprint 1.3 (que nunca foi persistido neste arquivo).
