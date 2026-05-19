# ADR-022: Workflow engine para processos de longa duração no Societário

Data: 2026-05-19
Status: aceito (validar reabertura ao fim da Fase 2)

## Contexto

O departamento Societário (ADR-023) introduz a noção de **processo de longa duração** com múltiplos passos e dependências: uma alteração de capital social pode levar 3–15 dias, uma abertura de empresa 5–20 dias, um distrato 30–180 dias. Cada processo tem:

- Passos com dependências (passo B só roda quando passo A completou)
- Passos "automáticos" (Orquestrador chama tool/API) e "human_required" (humano efetua e marca como concluído)
- Espera de evento externo (`external_wait` — Junta deferir o ato, prazo legal vencer)
- Retry e timeout por passo
- Observabilidade: pra qualquer processo em curso, ver onde está, próxima ação, prazo, agente atribuído

Stack atual (`escopo-produto.md` + ADR-003): BullMQ (Redis) pra filas. Temporal mencionado como "introduzir na Fase 2+" pra workflows determinísticos de longa duração.

Pergunta da Fase 2: **BullMQ + cron + state em `legal_processes`/`process_steps` (ADR-024) bastam pra Fase 2 inteira, ou Temporal precisa entrar já?**

## Decisão

**Fase 2 começa com BullMQ + cron + state em `process_steps` como workflow engine.** Sem Temporal. Sem Step Functions. Sem custom engine.

Razões:

1. **Templates iniciais simples.** Sprint 2.2 desenha 3–5 templates (alteração de capital, alteração de sócios, atualização cadastral CNPJ, talvez abertura de empresa). Profundidade típica: 4–8 passos por template. Dependências quase sempre lineares com pouco branching. BullMQ delayed job + checagem de dependência em código TypeScript cobre tudo isso sem mistério.
2. **Equipe pequena.** Adotar Temporal exige aprender modelo de workflow vs activity, namespaces, versionamento, replay, worker pools. Curva de aprendizado real (2–4 semanas pra equipe nova). Não vale o investimento agora — Levi tá solo, tem 5–10 outros sprints na Fase 2.
3. **Operação leve.** Temporal exige cluster (self-hosted) ou cloud (Temporal Cloud, pago). Estamos em Redis + Supabase Cloud. Adicionar Temporal = mais um ponto de operação, monitoring, custo. Não justifica antes de validar produto.
4. **Custo de migração futura é tolerável.** O esquema `legal_processes` + `process_steps` é **snapshot legível do estado** — sobrevive a uma migração futura pra Temporal. Quando Temporal entrar, BullMQ jobs viram Temporal workflows, mas tabela continua sendo a UI de visualização.
5. **YAGNI explícito** — `escopo-produto.md` reservou Temporal pra "Fase 2+" sem amarrar à Fase 2 inteira. Esta é a leitura conservadora.

### Como BullMQ + cron implementa o workflow do Orquestrador

Orquestrador funciona em **dois modos** de invocação:

1. **Tick periódico** — cron BullMQ job (a cada 1–5 min) acorda todo `legal_process` com `status='in_progress'` que tem step `pending` cujas dependências estão satisfeitas. Orquestrador decide: disparar passo automatizado? Aguardar humano? Polling externo?
2. **Trigger por evento** — quando humano marca step como completed (via UI/API), quando agente publica `process_step.completed` no bus, quando consulta externa retorna deferimento, BullMQ enfileira job pro Orquestrador imediatamente.

State persiste em `process_steps` (`status`, `output`, `dependencies` resolvidas via query). Orquestrador é **stateless por turno** — lê o state ao acordar, decide, escreve, sai.

Recovery: se Orquestrador morre no meio de um turno, próximo tick reidempota baseado no `status` registrado. Não há "transação aberta" perdida — cada operação é commit atômico em `process_steps`.

Timeouts/retries: BullMQ tem backoff exponencial nativo. Falha em chamar Receita pós-Junta = retry 3x com backoff; persistir = move pra DLQ e gera `approval.created`.

### Quando reverter pra Temporal

Trigger explícito de revisitar **no fim da Fase 2** (sprint review da Fase 2 inteira). Sinais que justificam migrar:

1. **Templates passaram a ter branching complexo** (paralelismo, fan-out/fan-in, sagas). Ex: encerramento que dispara em paralelo "encerrar IE estadual" + "encerrar CCM municipal" + "baixa eSocial" e converge antes do passo final.
2. **Manutenção de "código de orquestração em TypeScript" virou bottleneck** — toda mudança de template exige refactor do Orquestrador. Templates como dados (Temporal workflows como código) podem ficar mais limpos.
3. **Volume passou da casa de centenas de processos ativos por tenant** — tickagem por cron começa a perder latência ou consumir Redis excessivamente.
4. **Replay/debug de incidente** — incidente real onde "qual era o estado exato do processo às 14h22?" não é respondível pelo state atual. Temporal grava event sourcing nativo.

Se 2+ desses sinais aparecerem ao fim da Fase 2, abrir ADR sucessor pra Temporal. Migração: workflows novos no Temporal, processos antigos drenam em BullMQ, depois aposenta.

## Alternativas consideradas

### Opção A — Temporal desde a Sprint 2.1

Adoção full Temporal pra todos os processos do Societário. Workflows + activities em código TypeScript (SDK Temporal). Worker pool em apps/agent-runtime ou novo serviço.

**Rejeitada (agora):**
- Custo de aprendizado alto, equipe pequena.
- Adiciona componente de infra (Temporal Cluster ou Temporal Cloud).
- Templates iniciais simples não exigem.
- Pode entrar depois sem perda — state atual é compatível.

### Opção B (escolhida) — BullMQ + cron + state em tabela

Detalhada acima.

### Opção C — AWS Step Functions ou GCP Workflows

Workflow engine cloud-managed.

**Rejeitada:**
- Acoplamento ao cloud provider (Supabase Cloud é a base; AWS introduz overhead operacional separado).
- Custo por execução pode escalar mal com longa duração e polling.
- Latência de cross-cloud (Supabase ↔ AWS) é desnecessária pra caso interno.
- Disponibilidade da função de "stop and wait for external event" é menos ergonômica que Temporal.

### Opção D — Custom orchestration engine em TypeScript (sem framework)

Escrever próprio worker que lê tabela e roda steps.

**Rejeitada parcialmente:**
- BullMQ JÁ É isso — wrapper de filas/jobs sobre Redis com retry/backoff. Não precisa reinventar.
- Codificar TODO o orquestrador "do zero" em código vs usar BullMQ + lógica em TypeScript é falsa alternativa — Opção B usa BullMQ E codifica lógica do Orquestrador em TypeScript. Não há diferença prática.

### Opção E — Mistura BullMQ pra passos curtos + Temporal pra processos longos

Híbrido.

**Rejeitada:**
- Pior dos dois mundos — equipe lida com 2 modelos mentais.
- Definição de "curto vs longo" é arbitrária e migra na prática.
- Manutenção dobrada.

## Consequências

**Positivas:**

- Stack atual continua suficiente. Sprint 2.1 instala worker novo (Orquestrador) sem novo serviço.
- Operação leve: Redis + Postgres já estão monitorados; nada novo pra Levi cuidar.
- Custo zero adicional além de tempo de CPU (Sonnet 4 vai sempre custar mais que infraestrutura).
- Schema `legal_processes` + `process_steps` é fonte da verdade; UI consome direto sem mediador.
- Migração futura pra Temporal não exige rewrite — schema sobrevive.

**Negativas:**

- "Reinventar workflow engine no código do Orquestrador" tem risco de bugs sutis em dependências/retry/timeout. Mitigação: testes unitários por template; supervisor existente (ADR-010) detecta loops e budget esgotado.
- Sem event sourcing nativo — replay de incidente exige juntar `audit_log` + state atual. Funciona mas é menos ergonômico.
- Sem suporte first-class a "wait for signal" / "wait for external event" como em Temporal. Implementação: polling com BullMQ delayed job + verificação periódica de condição. Funciona pra casos simples; vira chato se condições viram muitas.
- Branching/saga complexa exigirá código custom no Orquestrador — pode acumular dívida se templates crescerem.

**Restrições de implementação:**

- Orquestrador NUNCA mantém state em memória entre turnos. Tudo escreve em `process_steps` antes de retornar.
- Cron de tick é configurável por tenant — default 5 min, override possível pra processos urgentes (1 min).
- Retry de step automatizado tem cap de 3 tentativas (backoff exponencial). Após 3, marca `failed` e gera `approval.created`.
- `external_wait` steps têm `deadline` obrigatório. Vencido sem confirmação = escalação humana.
- Cada step de Orquestrador roda em job próprio BullMQ (não compartilha job entre 2 processos). Permite paralelismo natural por shard de Redis.

## Vínculo com ADRs adjacentes

- **ADR-003** (comunicação inter-serviços via BullMQ): este ADR é coerente — workflow engine = mais um uso de BullMQ, não uma nova tech.
- **ADR-010** (orquestração 3 camadas + supervisor): Orquestrador é a "Camada 2 persistente"; supervisor detecta loops e budget no Orquestrador também.
- **ADR-023** (topologia Societário): Orquestrador depende deste ADR.
- **ADR-024** (schema `legal_processes`): state que workflow engine manipula.

## Métrica de revisão (final da Fase 2)

Ao fim da Fase 2, revisitar este ADR com dados:

- Quantos processos ativos por tenant? (média e p95)
- Quantos templates com branching/paralelismo? (count + complexidade qualitativa)
- Frequência de "bug por dependência mal resolvida"? (incident count)
- Tempo gasto por sprint mantendo lógica de Orquestrador? (estimativa qualitativa do Levi)
- Custo Redis aumentou significativamente? (monitoring)

Se 2+ sinais negativos, ADR-NN sucessor migra pra Temporal. Senão, mantém BullMQ + cron.
