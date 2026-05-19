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

### TD-006 🟢 `.env.local` duplicado em 3 apps (MITIGADO em Sprint Fase 2-prep)

**Detectado em:** 2026-05-15
**Mitigado em:** Sprint Fase 2-prep (2026-05-19, commit ca89070) — drift check no `pnpm check-env`
**Impacto:** dev precisa manter 3 cópias sincronizadas; drift silencioso entre arquivos era a causa raiz dos bugs (não a duplicação per se)
**Status atual (Opção B do sprint):** `pnpm check-env` falha rápido se valor de uma chave compartilhada divergir entre apps. Duplicação física persiste mas drift fica visível.
**Próximo passo (Opção A, sob demanda):** consolidar pra raiz via simlinks ou wrapper dotenvx. Custo estimado 2-3h. Fazer só se drift voltar a causar dor mesmo com check ativo.

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

<!-- TD-012 fechado no Sprint Fase 2-prep — ver seção "Itens fechados" no fim do arquivo. -->

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

<!-- TD-019 fechado no Sprint Fase 2-prep — ver seção "Itens fechados" no fim do arquivo. -->

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

<!-- TD-027 fechado no Sprint 1.6 — ver seção "Itens fechados" no fim do arquivo. -->

### TD-028 🟢 Diff de edição salvo em JSONB mas UI só mostra "editado"

**Detectado em:** Sprint 1.5 (decisão arquitetural #3)
**Impacto:** quando operador edita draft antes de aprovar, salvamos `edit_diff = { original, edited, char_distance }` no banco. UI atual renderiza apenas badge "editado" — não mostra diff visual (texto colorido add/remove).
**Solução:** componente DiffViewer (libs como react-diff-viewer ou implementação custom com diff-match-patch). Mostra side-by-side ou inline.
**Quando atacar:** Sprint 1.6+ quando primeiro tenant pedir ou eval de promoção de prompt depender de revisão das edições.

### TD-030 🟢 Catálogo de tipos de obligation/document como constantes

**Detectado em:** Sprint 1.3 (mencionado no self-review como TD-023 do 1.3 mas nunca persistido)
**Impacto:** `getObligationsForAccount` e `getDocumentsForAccount` aceitam strings livres; não há validação de domínio. Catálogo de tipos (DAS, INSS, DCTFWeb, NFe, comprovante...) vive em código + seed data, não em tabela.
**Solução:** tabela `obligation_kinds` + `document_kinds` por tenant (custom per escritório) OU enum global. Seed mantém os atuais. Validar no INSERT.
**Quando atacar:** Fase 2+ quando escritórios pedirem taxonomia própria, ou se o número de tipos crescer muito.

### TD-031 🟢 Storage de arquivos pra documents ainda não existe

**Detectado em:** Sprint 1.3 (mencionado no self-review como TD-024 do 1.3 mas nunca persistido)
**Impacto:** tabela `documents` guarda metadata (kind, status, due_date, etc) mas não tem campo de URL/storage do arquivo real. Cliente final manda comprovante mas a gente só registra "recebido" sem persistir o arquivo.
**Solução:** Supabase Storage bucket por tenant (RLS) + coluna `documents.storage_path` apontando pro objeto. Upload via signed URL ou direto via API route.
**Quando atacar:** Fase 2+ quando primeiro fluxo de comprovante real entrar (provavelmente em pessoal/folha).

<!-- TD-032 fechado no Sprint Fase 2-prep — ver seção "Itens fechados" no fim do arquivo. -->

### TD-033 🟢 HUD da sala Atendimento é fixo no canto (não viewport-aware)

**Detectado em:** Sprint 1.6 Tarefa 3
**Impacto:** sprint pedia HUD que aparece SÓ quando câmera/foco do canvas está na sala Atendimento. Como o canvas atual não tem zoom/pan, a detecção não tem como ser feita — HUD ficou fixo no canto enquanto canvas montado. Funciona bem enquanto há só Atendimento operacional; quando outros departamentos entrarem com HUDs próprios, vão se sobrepor.
**Solução:** quando navegação câmera entrar (zoom/pan), detectar posição central da viewport vs centroide das salas e mostrar/esconder HUDs. Cada departamento ativo terá seu próprio HUD overlay.
**Quando atacar:** Fase 2+ junto com navegação de câmera no canvas.

### TD-034 🟢 Modo demo sem auto-login

**Detectado em:** Sprint 1.6 Tarefa 7
**Impacto:** `/demo` requer que Levi logue manualmente e selecione "Demo — Levi Lael" no Clerk Org Switcher antes de poder disparar cenários. Pra apresentação rápida de cliente novo, adiciona 2 cliques de fricção.
**Solução:** Clerk session API (`createSession` server-side) pra autenticar automaticamente como user demo pré-criado quando acessa `/demo`. Requer Clerk paid plan ou impersonation flow. Alternativa: deep link com session token assinado pra abrir direto.
**Quando atacar:** se demo virar canal principal de venda E fricção dos 2 cliques causar perda mensurável (test A/B). Fase 2+ ou nunca se não justificar.

### TD-035 🟢 Cleanup de tenant demo é manual

**Detectado em:** Sprint 1.6 Tarefa 7
**Impacto:** `pnpm seed:demo-tenant` cria org Clerk + tenant + dados. Pra "resetar" entre apresentações, é preciso (a) arquivar tenant via SQL ou webhook organization.deleted (b) apagar org Clerk manualmente no painel. Sem comando `pnpm seed:demo-cleanup`.
**Solução:** script `seed-demo-cleanup.ts` que (1) DELETE Clerk org via fetch API, (2) DELETE em ordem (channel_sessions → drafts → leads → conversations → messages → agents → accounts → obligations → documents → audit_log → tenant_users → tenant) respeitando ON DELETE RESTRICT.
**Quando atacar:** quando preparar primeira demo comercial de verdade e precisar reset rápido entre apresentações.

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

### TD-027 ✅ Página de detalhe de conversa não existe

**Detectado em:** Sprint 1.5 (orientação)
**Fechado em:** Sprint 1.6 (2026-05-19)
**Solução aplicada:** `/dashboard/atendimento/conversas/[id]` criada como Server Component que carrega via helper server-only `loadConversationDetail` (conversation + messages ASC + classifications + lead + drafts vinculados). Client component `ConversationDetailView` renderiza timeline + painel lateral collapsible, com subscriber socket.io filtrando `message.received` por conversationId pra refetch automático. Inbox de drafts e leads cards ganham link "Ver histórico completo →" pra a nova página.

### TD-022 ✅ Especialista Comercial envia direto sem materializar message_drafts

**Detectado em:** Sprint 1.4
**Fechado em:** Sprint 1.5 (2026-05-21)
**Solução aplicada:** novo helper `materializeProposal` em `packages/shared-domain/src/atendimento/materialize-proposal.ts` unifica o comportamento dos 2 Especialistas. Tier sugestivo cria draft `pending` real com `expires_at` configurável por tenant (`display_settings.drafts.expiration_minutes`, default 15min); tier semi_autonomo envia direto + draft `auto_approved` vinculado à mensagem final. Coordenador continua respondendo sociais direto (sem draft) e Especialistas escalam humano (T05/T_NO_DATA) DIRETO (sem draft) — feedback rápido pro cliente importa nessas duas exceções. Fecha também o TD-021 do self-review do Sprint 1.3 (que nunca foi persistido neste arquivo).

### TD-012 ✅ `database.types.ts` editado à mão; precisa regenerar via `pnpm db:types`

**Detectado em:** Sprint 1.0 finalização (2026-05-18)
**Fechado em:** Sprint Fase 2-prep (2026-05-19, commit fc1d603)
**Solução aplicada:** dois passos.
1. **Auditoria** (Tarefa 5 do sprint): regenerei `database.types.ts` contra Cloud linked. Diff vazio — schema do code e do Cloud estão sincronizados. Sem migrations faltando, sem campos editados à mão divergentes.
2. **Comando definitivo** (Tarefa 3, commit fc1d603): `package.json` agora tem `pnpm db:types` apontando pra `--linked` (default) e `pnpm db:types:local` pra Docker. Comando antigo tinha `--local` hardcoded e quebrava com `pnpm db:types -- --linked` (CLI rejeitava `--local --linked`).
Validação: regenerei via `pnpm db:types` e confirmei `git diff packages/shared-db/src/database.types.ts` vazio.

### TD-019 ✅ Coordenador subscreve `message.received` direto; ADR-016 prevê `message.routed`

**Detectado em:** Sprint 1.2 (2026-05-19)
**Fechado em:** Sprint Fase 2-prep (2026-05-19, commit 2ed12fb) — preparação pra Fase 2 Societário acionou o critério de reabertura do ADR-019
**Solução aplicada:** topologia em 3 camadas conforme ADR-016, agora também ativa pra mensagens inbound:
- Worker novo `apps/agent-runtime/src/workers/router-inbound.ts` subscreve `message.received`, lê o conteúdo no DB e enfileira o Roteador via fluxo normal de agent-tasks
- Roteador (graph) ganhou node `publish` condicional: emite evento novo `message.routed` + audit_log dedicado quando o input carrega conversationId/messageId/accountId. Triagem interna (Fase 0) sem esses campos faz o publish virar no-op
- Coordenador de Atendimento (`atendimento-coordenador.ts`) trocou subscription `message.received` → `message.routed` filtrado por `destinationDepartment === 'atendimento'`
- Prompt do Roteador bumpado pra v1.1.0 com `platform` explícito no enum (alinha com `shared-types.DEPARTMENTS`)
- ADR-019 marcado `superseded`; `docs/adrs/README.md` ganhou seção "Superseded". Sem ADR-020 — o plano de transição estava previsto no próprio ADR-019 e foi seguido fielmente
- 24 testes de eval do Roteador + 11 testes unit nos workers cobrem os caminhos novos. Manual ponta a ponta pendente (depende de Docker + dev server up — anotado no self-review)

### TD-032 ✅ Suite formal de RLS em tools do Atendimento

**Detectado em:** Sprint 1.3 (mencionado no self-review como TD-025 do 1.3 mas nunca persistido)
**Fechado em:** Sprint Fase 2-prep (2026-05-19, commit 2b617b5)
**Solução aplicada:** `tests/integration/rls-fase-1.test.ts` com 24 testes cobrindo as 8 tabelas adicionadas na Fase 1 (conversations, messages, channel_sessions, obligations, documents, message_drafts, leads, conversation_classifications). Cada tabela tem o trio SELECT/INSERT/UPDATE com 2 tenants concorrentes. Padrão idêntico ao existente `rls.test.ts` (pg local + claims JWT). Conversation_classifications é INSERT-only: o teste de UPDATE valida que REVOKE do role authenticated impede modificação. Padrão a replicar nas próximas tabelas (Societário, Fiscal, etc).
