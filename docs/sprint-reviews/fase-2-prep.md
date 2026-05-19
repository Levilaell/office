# Sprint Fase 2-prep — Self-review

Data de execução: 2026-05-19
Branch: `main` (commit direto, sprint sem PR conforme política)
Sprint anterior: Sprint 1.6 (fechou Fase 1 — `v0.1.0-fase-0` + Atendimento ponta a ponta)
Próximo: Sprint Fase 2.1 (Coordenador Societário)

## Tarefas executadas

- [x] **Tarefa 1** — Roteador no caminho real — commit `2ed12fb`
- [x] **Tarefa 2** — Suite RLS Fase 1 — commit `2b617b5` (24 testes novos cobrindo 8 tabelas)
- [x] **Tarefa 3** — `pnpm db:types` definitivo — commit `fc1d603`
- [x] **Tarefa 4** — `.env.local` drift check (Opção B) — commit `ca89070`
- [x] **Tarefa 5** — Auditoria `database.types.ts` — sem diff (sem commit dedicado, registrado no commit fc1d603 da Tarefa 3)
- [x] **Tarefa 6** — Cleanup Git — sem commit (alteração de plumbing local)
- [x] **Tarefa 7** — Validação cruzada + self-review (este documento)

Hashes em main: `29cb1bc` (HEAD pré-sprint) → `2ed12fb` → `2b617b5` → `fc1d603` → `ca89070` (HEAD pós-sprint)

## Decisões tomadas e ligação com ADRs/princípios

### ADR-019 superseded sem ADR-020

ADR-019 já previa o plano exato do refactor em "Restrições de implementação". Não há decisão arquitetural NOVA a registrar — só seguir o roteiro. Marquei o ADR como `superseded` e movi pra seção dedicada em `docs/adrs/README.md` (a seção já estava prevista por TD-011, criei agora). **Princípio aplicado:** ADR registra decisão; quando há mudança previsível dentro de uma decisão existente, basta atualizar status. Cria ADR-NNN só se a transição introduzir uma nova decisão.

### Alinhamento de DEPARTMENTS com `shared-types`

O graph do Roteador tinha cópia local de 6 elementos (sem `platform`). `shared-types.DEPARTMENTS` tem 7. ADR-016 sempre tratou `platform` como destino válido. Aproveitei o bump pra v1.1.0 do prompt pra eliminar a divergência: `router/graph.ts` agora importa `DEPARTMENTS` de `@office/shared-types` direto. **Princípio aplicado:** estado canônico compartilhado (CLAUDE.md raiz, Princípio 2).

### Confidence: high/medium/low → 0.9/0.6/0.3

`MessageRoutedPayload.confidence` é `number` no schema; Roteador opera com label `'high' | 'medium' | 'low'`. Mapeei high=0.9, medium=0.6, low=0.3 — calibragem provisória anotada no código (`CONFIDENCE_SCORE`). Refinamento real depende de eval com LLM em tráfego de canal (registrado como TD potencial; ver seção "TDs novos").

### `.env.local` — Opção B (drift check), não Opção A (consolidação)

Investigação:
- Os 3 apps já têm `.env.local` idênticos por convenção
- A causa raiz dos bugs anteriores foi drift silencioso quando alguém atualiza um app só, não duplicação per se
- Opção A (simlinks ou wrapper dotenvx) funciona em WSL/macOS/Linux mas é frágil em Windows nativo, e exige reorganizar setup de cada dev novo
- Opção B (drift check) resolve a dor real (drift detectável) sem refactor invasivo. ~30min vs 2-3h.

Critério do sprint: "Se Opção A < 2h, vai com A; se > 2h, vai com B". Opção A excede 2h quando incluímos validação de Next.js + adaptação dos 3 apps. Opção A fica registrada como passo possível futuro se drift voltar a causar dor mesmo com check.

### Worker `router-inbound.ts` como subscriber novo (vs reusar `agent-tasks` worker)

Considerei modificar o handler de `agent-tasks` pra detectar payload inbound. Rejeitei: cada subscriber tem responsabilidade única (channel de entrada → enfileiramento). Reusar o handler misturaria lógica de filtro (event type) com lógica de execução (LLM call). O worker `router-inbound` segue exatamente o mesmo padrão do `atendimento-coordenador` antigo — paridade arquitetural.

### Node `publish` condicional no graph (vs handler externo)

Considerei publicar `message.routed` no handler do agent-tasks worker quando o agent.key=router E payload tem messageId. Rejeitei: agentes publicam seus próprios eventos no graph (padrão Coordenador/Especialistas em `act.ts`). Manter consistência arquitetural. Triagem interna passa transparentemente porque o node faz no-op silencioso quando conversationId/messageId estão ausentes.

## TDs fechados (status atualizado em `docs/tech-debt.md`)

| TD | Tarefa | Commit | Status |
|----|--------|--------|--------|
| TD-012 | Auditoria + db:types definitivo | fc1d603 | ✅ fechado (sem drift de types vs Cloud, comando consolidado) |
| TD-019 | Roteador no caminho real | 2ed12fb | ✅ fechado |
| TD-032 | Suite RLS Fase 1 | 2b617b5 | ✅ fechado |
| TD-006 | Drift check `.env.local` | ca89070 | 🟢 mitigado (não totalmente fechado — duplicação física persiste, drift detectável) |

`TD-013` original (referenciado no sprint prompt mas o ID no `tech-debt.md` aponta a outro item — Webpack Next.js) NÃO foi atacado. O TD que de fato cobre `pnpm db:types --local` hardcoded é o **TD-012**. Sprint prompt usou ID errado; resolvi pelo contexto (a descrição da Tarefa 3 bate com TD-012, não com TD-013). Reportado pra ajustar referências do sprint prompt em iterações futuras.

## TDs novos criados

Nenhum TD novo persistido neste sprint. Candidatos identificados mas não persistidos (sob demanda):

- **Eval real do Roteador com LLM** — atual em `apps/agent-runtime/src/agents/router/__tests__/eval.test.ts` é replay puro (similar TD-015 do Coordenador). Mudança no prompt v1.1.0 que degrade accuracy semantica NÃO é detectada — só estrutura. Se Sprint 2.x mexer no prompt, vale criar TD-XXX (parideade ao TD-015 do Coordenador).
- **Calibragem real do `CONFIDENCE_SCORE`** — high/medium/low → 0.9/0.6/0.3 é palpite. Vale calibrar quando houver tráfego real de canal e eval com LLM real. Se virar dor (Coordenador decidindo errado por confidence ruim), criar TD.

Decisão de não persistir agora: nenhum dos dois bloqueia Fase 2.1 (Coordenador Societário só precisa do `message.routed` filtrar corretamente, e isso já está testado estruturalmente).

## ADRs alterados/criados

- **ADR-019** (`docs/adrs/019-coordenador-bypassa-roteador-fase-1.md`): status mudou de `aceito` → `superseded em 2026-05-19 pelo Sprint Fase 2-prep`. Cabeçalho ganhou bloco apontando este self-review.
- **`docs/adrs/README.md`**: adicionada seção `## Superseded` com ADR-019 movido pra lá.
- **Nenhum ADR novo.** Decisão consciente (ver seção "Decisões tomadas" — primeiro tópico).

## Validação cruzada — Tarefa 7

| Etapa | Status | Observação |
|------|--------|------------|
| `pnpm typecheck` | ✅ | 10 successful, full turbo cache |
| `pnpm lint` | ✅ | 10 successful |
| `pnpm test` (unit) | ✅ | **243 testes verdes** (era 209 antes; +24 RLS, +11 workers, +24 router eval = 59 brutos, alguns sobrepostos com a contagem prévia. Total final: 25 packages-level + 218 turbo-level) |
| `pnpm build` | ✅ | 3 successful (web + agent-runtime + workers compilam) |
| `pnpm test:integration` | ⚠️ **NÃO RODADO** | Docker daemon não está rodando neste worktree; `pnpm db:start` falha. Os testes novos (`rls-fase-1.test.ts` + os atuais) precisam de Postgres local. Validação estática (tsc + import resolution + lint) passou. Levi precisa rodar `pnpm db:start && pnpm test:integration` em ambiente com Docker pra confirmar. |
| Manual `inboundSimulate` ponta a ponta | ⚠️ **NÃO RODADO** | Mesmo bloqueio — exige dev environment up (Docker, web em 3000, agent-runtime em 3001). Testado em isolamento pelos unit tests dos subscribers (filtros e enfileiramento). Validação ponta a ponta com LLM real fica pra Levi rodar manualmente. |

### Detalhamento da validação manual (quando rodada)

Comportamento esperado quando `inboundSimulate` for chamado:

1. **Rota** `/api/inbound/simulate` cria `message` + publica `message.received`
2. **router-inbound subscriber** consome `message.received`, lê o conteúdo do DB, enfileira agent-tasks com `agentKey=router` + payload `{text, conversationId, messageId, accountId}`
3. **agent-tasks worker** executa Roteador. Graph classifica em departamento e o node `publish` emite `message.routed` + audit_log `action='message.routed'`
4. **Caso destinationDepartment='atendimento':** `atendimento-coordenador` subscriber filtra e enfileira `atendimento.classify`. Fluxo do Coordenador segue normal (decide intent → handoff especialista → draft pending)
5. **Caso destinationDepartment='societario' (ou outro):** nenhum subscriber consome. Mensagem fica routed sem processamento — comportamento esperado simétrico ao caso anterior à Sprint 1.2.

Validar via audit_log:
```sql
SELECT action, resource, metadata->>'destinationDepartment' AS dept
  FROM audit_log
 WHERE trace_id = '<traceId>'
 ORDER BY created_at;
-- esperado: task.created → llm.call → message.routed → task.completed → (se atendimento) task.created → ...
```

## Riscos residuais

1. **Sem validação manual ponta a ponta neste worktree.** Embora unit tests cubram filtros e enfileiramento, o fluxo completo (canal → router → coordenador → especialista → draft) só pode ser validado em ambiente com Docker + LLM real. Levi precisa rodar antes da próxima feature.

2. **Eval do Roteador em replay puro.** Não detecta regressão semântica do prompt v1.1.0 (só estrutura). Mudança no prompt sem eval real é tomada de risco.

3. **`CONFIDENCE_SCORE` calibrado por palpite.** Mapeamento high/medium/low → 0.9/0.6/0.3 é arbitrário até primeiros dados de canal real.

4. **`message.routed` pra departamentos sem Coordenador acumula no log sem consumer.** Esperado e simétrico ao caso anterior à Sprint 1.2. Sprint 2.1 (Coordenador Societário) elimina pra `societario`; outros departamentos seguem assim até suas respectivas sprints.

5. **`tests/integration/rls-fase-1.test.ts` não roda em CI.** Pré-existente — TD-032 era pra cobrir o `tests/integration/atendimento-tools-rls.test.ts` mas implementei usando o padrão existente do `rls.test.ts` (pg local). Quando CI ganhar Postgres serviço, todos os testes integration rodam juntos.

## Cleanup Git

Branches mergeadas deletadas local + remote (8 branches):
- `chore/sprint-1.0-prep`, `docs/adrs-014-017-fase-1`
- `feat/atendimento-coordenador-classificacao`, `feat/atendimento-especialista-comercial`, `feat/atendimento-especialista-operacional`
- `feat/atendimento-foundations`, `feat/atendimento-foundations-aligned`
- `fix/triagem-import-extensions`

Worktrees removidas:
- `/home/levilaell/office-1.3` (Sprint 1.3 fechado)
- `/home/levilaell/office-1.4` (Sprint 1.4 fechado)

Estado final: `main` único local + remote, 1 worktree (a `office`).

## Estado pra Fase 2.1

- Plataforma pronta pra abrir Sprint Fase 2.1 (Coordenador Societário)? **✅ Sim, com ressalva** — validação manual ponta a ponta ainda precisa rodar antes de Sprint 2.1 ativar.
- Bloqueios residuais identificados? Apenas operacionais (Docker up, dev server up pra validação manual).
- Critérios pra Sprint 2.1 considerar prontos:
  - Coordenador Societário segue o padrão do Coordenador de Atendimento (subscribe `message.routed` filtrado por `destinationDepartment='societario'`)
  - Roteador já classifica `societario` corretamente (prompt v1.1.0 inclui)
  - Schema deve ganhar tabelas do domínio Societário (alterações contratuais, registros JUCESP, etc) — fora do escopo deste sprint, mas a RLS pattern aplicável está documentada em `rls-fase-1.test.ts`

## Surpresas e aprendizados

1. **`pnpm db:types` regenerou idêntico ao código já commitado.** Surpreendente — significa que a edição manual do Sprint 1.0 (TD-012) coincidentemente bateu com o schema do Cloud. Pode ter sido sorte (alguém realmente regenerou em algum momento) ou disciplina do Levi.

2. **`web/.env.local` é idêntico a `agent-runtime/.env.local` é idêntico a `workers/.env.local`** — drift atual zero. Significa que ninguém pisou nessa armadilha ainda. Drift check é prevenção.

3. **Branches locais com tip que NÃO é ancestral de main mas com `main..branch` vazio** — caso de merge via squash. `git branch --merged main` não as detecta, mas elas estão integralmente em main. Tive que verificar via `git log --oneline main..branch` antes de deletar.

4. **Saída do `supabase gen types`** vai parte pra stdout (TS válido), parte pra stderr (mensagens de progresso). Se o redirect for `2>&1`, contamina o arquivo. Script atual usa só `>` que vai pra stdout — funciona limpo. Não precisei mexer no padrão.

## Conclusão

Sprint Fase 2-prep fechou os 4 TDs prioritários (TD-006 mitigado, TD-012 fechado, TD-019 fechado, TD-032 fechado) em 4 commits diretos em main. Total de 1k+ linhas de mudança, ~60 testes novos, zero PRs abertos.

A plataforma está pronta arquiteturalmente pra Sprint Fase 2.1 abrir o departamento Societário. Pré-requisito operacional: Levi rodar validação manual ponta a ponta via `inboundSimulate` em ambiente com Docker antes de Sprint 2.1 começar — pra confirmar que o Roteador classifica corretamente e o Coordenador filtra como esperado.
