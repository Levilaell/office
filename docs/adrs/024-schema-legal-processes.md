# ADR-024: Esboço de schema para processos legais do Societário

Data: 2026-05-19
Status: aceito (conceitual — migração real é trabalho da Sprint 2.1)

## Contexto

ADR-023 fixou a topologia de agentes do Societário: Coordenador conversacional + Orquestrador de processo + Especialistas + Portal Adapters. O Orquestrador precisa de uma representação canônica de **"processo societário em execução"** — uma alteração de capital social, uma abertura de filial, um distrato — que se estende por dias ou semanas e passa por múltiplos passos com dependências.

O schema atual da plataforma (Fase 0+1) já contempla:

- `accounts` (cliente final do escritório — pessoa jurídica). `tenant_id`, `cnpj`, `razao_social`, `entities[]`.
- `entities` (sub-unidades — filial, sócio individual). Vinculadas a `account`.
- `conversations` + `messages` (atendimento).
- `obligations` com `category` ∈ {`federal`, `estadual`, `municipal`, `trabalhista`, **`societaria`**} — obrigações recorrentes ou pontuais a cumprir.
- `documents` com `category` ∈ {`fiscal`, `contabil`, **`societario`**, `trabalhista`, `financeiro`, `outro`}.
- `audit_log` (INSERT-only — ADR-006).
- `approvals` (HITL — Fase 0).

Falta:
- Representação de **processo em execução** (status, passos, dependências, prazo previsto, próxima ação esperada, agente atribuído).
- Representação de **passo individual** dentro de um processo (gerar documento, protocolar, aguardar deferimento, atualizar Receita).
- Representação de **sessão em portal externo** quando aplicável (cookie, token, expiração) — apenas pros casos de "Automatizar" da matriz que envolvem portal web sem API formal.

Este ADR esboça o schema mínimo. Tipos exatos, defaults, constraints e índices ficam pra Sprint 2.1 quando primeira migração for escrita.

## Decisão

Quatro tabelas novas e duas extensões de tabelas existentes.

### Tabelas novas

#### `legal_processes`

Representa um processo societário em execução. Um por ato (uma alteração de capital = um `legal_process`; uma abertura de empresa = outro).

Colunas conceituais:

- `id` UUID PRIMARY KEY
- `tenant_id` UUID NOT NULL REFERENCES `tenants(id)`
- `account_id` UUID NOT NULL REFERENCES `accounts(id)` — quem é o cliente do escritório alvo do processo
- `entity_id` UUID REFERENCES `entities(id)` — opcional, quando o ato é de filial/sócio específico
- `template_key` TEXT NOT NULL — identificador do template (ex: `alteracao_capital`, `abertura_empresa`, `baixa_filial`). Catálogo gerenciado em código + tabela auxiliar `legal_process_templates` (Sprint 2.2).
- `title` TEXT NOT NULL — título humano ("Alteração de capital — ACME LTDA — 2026-06")
- `status` TEXT NOT NULL — `draft` | `in_progress` | `waiting_external` (aguardando órgão) | `waiting_human` (aguardando humano interno) | `completed` | `cancelled` | `failed`
- `started_at` TIMESTAMPTZ — quando saiu de `draft`
- `expected_completion` TIMESTAMPTZ — previsão baseada em template
- `actual_completion` TIMESTAMPTZ — quando entrou em `completed` ou `cancelled`
- `assigned_agent_id` UUID REFERENCES `agents(id)` — Orquestrador atribuído (sempre não nulo se status ≠ draft)
- `assigned_human_id` UUID NULL — operador humano responsável quando aplicável
- `priority` TEXT NOT NULL DEFAULT `'normal'` — `low` | `normal` | `high` | `urgent`
- `source_conversation_id` UUID REFERENCES `conversations(id)` — quando processo nasceu de conversa com cliente final
- `params` JSONB NOT NULL DEFAULT `'{}'` — parâmetros específicos do template (ex: `{"new_capital_brl": 100000, "increase_method": "integralizacao_cash"}`)
- `metadata` JSONB NOT NULL DEFAULT `'{}'`
- `created_at` / `updated_at` TIMESTAMPTZ

Características-chave:
- `tenant_id` no topo (multi-tenant dia 1) — RLS por `public.current_tenant_id()`
- `params` em JSONB permite flexibilidade entre templates sem schema rígido — mas templates publicam schema Zod em código pra validação.
- `status` com CHECK constraint. Transições de status são responsabilidade do Orquestrador (não da UI direta).

#### `process_steps`

Representa um passo individual dentro de um `legal_process`. Cada template define a lista canônica de steps; instância grava o estado de cada um.

Colunas conceituais:

- `id` UUID PRIMARY KEY
- `tenant_id` UUID NOT NULL REFERENCES `tenants(id)` — herdado do `legal_process` mas duplicado pra RLS direto
- `legal_process_id` UUID NOT NULL REFERENCES `legal_processes(id)` ON DELETE CASCADE
- `order_index` INT NOT NULL — ordem de execução prevista (não muda); steps podem ser puladas se não aplicáveis
- `step_key` TEXT NOT NULL — identificador estável dentro do template (ex: `gerar_minuta_alteracao`, `protocolar_junta`, `aguardar_deferimento_junta`, `atualizar_receita_pos_junta`)
- `title` TEXT NOT NULL — descrição humana ("Protocolar alteração na JUCESP")
- `step_type` TEXT NOT NULL — `automated` (Orquestrador executa via tool/portal API) | `human_required` (humano efetua) | `external_wait` (aguarda órgão externo — Junta deferir, etc) | `agent_generated_document` (Especialista Documental gera artefato)
- `status` TEXT NOT NULL — `pending` | `in_progress` | `completed` | `skipped` | `failed`
- `assigned_to` TEXT — `agent:<agent_id>` ou `human:<user_id>` (textual pra suportar ambos; alternativa: 2 colunas FK separadas opcionais)
- `requires_approval` BOOLEAN NOT NULL DEFAULT FALSE — se quando completar, exige `approval` HITL antes do próximo
- `started_at` / `completed_at` TIMESTAMPTZ
- `deadline` TIMESTAMPTZ — prazo legal/operacional do passo (ex: "comunicar Receita em 30 dias após NIRE")
- `dependencies` JSONB NOT NULL DEFAULT `'[]'` — lista de `step_key` que precisam estar `completed` pra este disparar (ex: `["protocolar_junta"]` é dependência de `aguardar_deferimento_junta`)
- `output` JSONB — resultado quando completado (ex: protocolo da Junta, NIRE deferido, hash do documento gerado)
- `error` JSONB — diagnóstico quando `failed`
- `audit_trace_id` UUID — vinculo a `audit_log`
- `metadata` JSONB
- `created_at` / `updated_at` TIMESTAMPTZ

Características-chave:
- `dependencies` em JSONB referencia `step_key` (string estável do template), não `id`. Permite que template evolua sem quebrar instâncias antigas.
- `step_type=external_wait` é o caso especial: Orquestrador agenda polling (BullMQ delayed job) e libera quando confirmação chega.
- `assigned_to` textual evita 2 FKs separadas com lógica de XOR. Padronizar formato e validar em camada de aplicação.

#### `portal_sessions`

Apenas pra casos da matriz onde "Automatizar via portal web sem API" exige sessão persistente (token/cookie). Hoje a matriz só identifica 1 caso (polling público de status na Junta — linha #44), então a tabela é pequena e pode até ser dispensada na Sprint 2.1 e introduzida tarde. Modelo conceitual mesmo assim:

- `id` UUID PRIMARY KEY
- `tenant_id` UUID NOT NULL REFERENCES `tenants(id)`
- `portal_id` TEXT NOT NULL — `jucesp_consulta`, `jucerja_consulta`, etc (catálogo em código)
- `auth_type` TEXT NOT NULL — `public` | `certificate` | `oauth` | `cookie`
- `secrets_ref` TEXT — apontador pra secrets manager (NUNCA credencial inline — mesmo padrão de `channel_sessions`)
- `state` JSONB NOT NULL DEFAULT `'{}'` — token, cookie jar, último uso
- `expires_at` TIMESTAMPTZ
- `last_used_at` TIMESTAMPTZ
- `created_at` / `updated_at` TIMESTAMPTZ

Características-chave:
- Maioria dos portais relevantes usa cert. A1 do escritório, que NÃO é "sessão" — é credencial usada por chamada. Portal session só serve quando há login web com cookie persistente.
- `tenant_id` no topo (RLS). Credenciais em secrets manager (`secrets_ref`).

#### `legal_process_templates` (opcional na Sprint 2.1, recomendado em 2.2)

Catálogo de templates de processo conhecidos. Pode começar como código (constante TypeScript em `shared-domain/legal/templates/`) e migrar pra tabela quando volume justificar (paralelo a obligation `type` que hoje é TEXT livre — TD-030 cobre catalogação semelhante).

Colunas conceituais:

- `template_key` TEXT PRIMARY KEY
- `title` TEXT NOT NULL
- `description` TEXT
- `category` TEXT — `alteracao_contratual` | `constituicao` | `encerramento` | `cadastral` | `mei` | `outros`
- `default_steps` JSONB NOT NULL — array de objetos `{step_key, order_index, step_type, title, default_dependencies}`
- `default_priority` TEXT
- `params_schema` JSONB — JSON Schema ou Zod compilado pra validar `legal_processes.params`
- `active` BOOLEAN NOT NULL DEFAULT TRUE

Multi-tenant nota: catálogo de templates é **plataforma**, não por-tenant. Sem `tenant_id`. Tenants podem ter overrides via tabela auxiliar (`tenant_template_overrides`) se virar necessário — fora do escopo Sprint 2.1.

### Extensões de tabelas existentes

#### `documents`

Sem mudança estrutural — o schema já contempla `category='societario'`. **Adicionar uma coluna opcional `legal_process_id UUID REFERENCES legal_processes(id) ON DELETE SET NULL`** pra vincular documentos a processos. Vinculação opcional (documentos avulsos continuam sem processo).

Razão: NÃO criar `legal_documents` separada. Reutilizar `documents` que já está pronto pra storage, RLS, audit. Single source of truth de "documento do cliente".

#### `audit_log`

Sem mudança estrutural. Já é INSERT-only com `tenant_id`, `actor`, `action`, `resource`, `before`, `after`, `metadata` (ADR-006). Eventos novos do Societário usam `resource='legal_process:<id>'` e `resource='process_step:<id>'`. Catálogo de novos `action` strings:

- `legal_process.created`
- `legal_process.status_changed`
- `legal_process.assigned_to`
- `legal_process.completed`
- `legal_process.cancelled`
- `process_step.started`
- `process_step.completed`
- `process_step.failed`
- `process_step.skipped`
- `portal_session.authenticated`
- `portal_session.expired`

Nada novo de tabela — só uso disciplinado do que existe.

#### `obligations`

Sem mudança estrutural — `category='societaria'` já existe. Sprint 2.2 vai inserir obligations societárias específicas (ex: "comunicar Receita pós-Junta — prazo 30 dias") como obligations vinculadas a `legal_process` via `metadata.legal_process_id` ou (preferível) extensão similar `legal_process_id` UUID opcional como em `documents`.

### Relacionamentos resumidos

```
tenants
  └── accounts
        ├── entities
        ├── obligations (existente; pode ganhar legal_process_id FK opcional)
        ├── documents (existente; ganha legal_process_id FK opcional)
        ├── conversations (existente; legal_process pode ter source_conversation_id)
        └── legal_processes (NOVO)
              └── process_steps (NOVO)
                    └── audit_log entries via audit_trace_id

portal_sessions (NOVO, isolado, escopado por tenant)
legal_process_templates (NOVO, plataforma — sem tenant_id)
```

### Multi-tenancy

- TODA tabela nova carrega `tenant_id` UUID NOT NULL no topo, exceto `legal_process_templates` que é plataforma.
- RLS por `public.current_tenant_id()` em todas. Policies SELECT/INSERT/UPDATE/DELETE seguindo padrão de `obligations`/`documents` (ver `20260520000000_obligations_and_documents.sql`).
- `process_steps.tenant_id` redundante com `legal_process.tenant_id` por design — permite RLS direto sem JOIN.
- Suite de RLS (similar à de Atendimento — TD-032 fechado) obrigatória pra novas tabelas. Adicionar em `tests/integration/legal-processes-rls.test.ts` na Sprint 2.1.

### Auditoria

- Toda transição de status em `legal_processes` e `process_steps` gera audit_log entry.
- `audit_trace_id` em `process_steps` é a chave de correlação.
- `before`/`after` capturam JSONB completo do step (não só status — observabilidade total exigida pelo princípio 5).

## Alternativas consideradas

**A) Tabela única `processes` genérica pra todos os departamentos (Societário + DP + Fiscal):** mais reuso futuro. Rejeitada agora — não temos dados suficientes pra projetar a forma certa. Risco de over-engineering. Sprint 2.x valida com Societário; se Fase 3 (DP) e Fase 5 (Fiscal) puxarem padrão similar, vira ADR sucessor que generaliza.

**B) `legal_documents` separada de `documents`:** mais limpo conceitualmente. Rejeitada — duplica esforço de storage, RLS, audit, listagem unificada. `documents.category='societario'` + `legal_process_id` FK opcional resolve com 1 coluna nova.

**C) `process_steps.dependencies` como tabela separada `step_dependencies (step_id, depends_on_step_id)`:** normalização clássica. Rejeitada pra Sprint 2.1 — JSONB é mais leve, queries de "esse step pode rodar?" são programáticas (Orquestrador roda em código), e mudança de template no futuro é mais flexível. Se virar gargalo de query, refatorar.

**D) Sem `template_key` na linha — Orquestrador deduz template:** acoplamento implícito ruim. Rejeitada. Template é informação canônica do processo.

**E) `assigned_to` com 2 FKs (`assigned_agent_id` + `assigned_user_id`) e CHECK XOR:** mais type-safe que TEXT polimórfico. **Aceita parcialmente** — Sprint 2.1 decide forma final; ambas opções aceitáveis, vou anotar a TEXT como ponto a revisar.

**F) `portal_sessions` desde o dia 1 mesmo sem caso forte:** prepara terreno. Rejeitada — YAGNI. Único caso atual é polling público em consulta de NIRE, que pode rodar sem sessão (HTTP simples). Adicionar tabela quando primeiro portal autenticado entrar (improvável na Fase 2).

## Consequências

**Positivas:**

- Schema mínimo viável (2 tabelas novas core + 1 opcional + extensões pontuais). Migração da Sprint 2.1 fica contida.
- Reuso de `documents`, `obligations`, `audit_log`, `approvals` — não recriar abstrações.
- `template_key` + `params` JSONB permite adicionar templates sem migração de schema. Catálogo cresce com sprints.
- `dependencies` em JSONB referenciando `step_key` (não `id`) sobrevive a evolução de template.
- RLS consistente com padrão existente. Suite de testes RLS replicável.

**Negativas:**

- JSONB em vários campos (`params`, `dependencies`, `output`, `error`) significa que queries específicas precisam de operadores `->`/`->>` ou conversão. Postgres lida bem mas ergonomia é menor que colunas planas.
- `assigned_to` polimórfico (TEXT) vs 2 FKs separadas: decisão adiada à Sprint 2.1; risco baixo, refatoração local.
- Sem `legal_process_templates` em tabela na Sprint 2.1 = templates em código TypeScript. Mudança de template exige deploy. Aceitável Fase 2 (volume baixo, equipe pequena); revisitar quando virar dor.
- `portal_sessions` adiada — primeira automação via portal web autenticado vai puxar a tabela.

**Restrições de implementação:**

- TODO `legal_process` ativo tem `assigned_agent_id` não-nulo (CHECK constraint). Apenas `status='draft'` permite agent nulo.
- Transição `status='draft' → 'in_progress'` no `legal_process` exige TODO `process_step` criado e validado contra schema do template. Sprint 2.2 codifica.
- `process_step.completed_at` exige `status='completed'`. CHECK constraint.
- `legal_process.expected_completion` calculado pelo template no momento da instanciação — não atualizado livremente depois.
- `audit_log` insere entry pra TODA mudança de status. Sem skip.

## Quando reverter

- Se Sprint 2.2 mostrar que `params` JSONB se torna gigante (>10 chaves complexas) por template, considerar tabela auxiliar `process_params (legal_process_id, key, value)` — mas só se queries específicas em params virarem comuns.
- Se um segundo departamento (Fase 3 — DP) puxar mesma estrutura "processo + steps + dependencies", **generalizar** numa ADR sucessor (`processes` + `process_steps` polimórficas). Sinaliza maturidade.
- Se padrão "agente persistente por processo" (ADR-023) for substituído por Temporal, schema pode encolher (Temporal gerencia state); mas `legal_processes` continua valendo como snapshot legível pra UI operacional.

## Vínculo com ADRs adjacentes

- **ADR-006** (audit_log INSERT-only): reutilizado integralmente.
- **ADR-010** (orquestração 3 camadas): Orquestrador é a "Camada 2 persistente" que precisa deste schema.
- **ADR-014/016/017**: padrões de Atendimento (modo shadow, tiers, conversation/account) cabem com `legal_processes` via `source_conversation_id`.
- **ADR-023** (topologia Societário): este ADR é a base de dados que aquele exige.
- **ADR-022** (workflow engine — condicional): se Temporal entrar, `legal_processes` + `process_steps` viram leitura/visualização do estado mantido em Temporal. Schema sobrevive.

## Decisões deixadas pra Sprint 2.1 (migração real)

- Tipos exatos (`TEXT` vs `VARCHAR(N)` vs ENUM) — usar TEXT + CHECK como padrão atual da plataforma
- Defaults exatos e constraints precisas
- Índices: `(tenant_id, status)`, `(account_id, status)`, `(assigned_agent_id, status)` em `legal_processes`; `(legal_process_id, order_index)` em `process_steps`
- Triggers de `updated_at` (padrão `set_updated_at()` já existe)
- `assigned_to`: TEXT polimórfico vs 2 FKs separadas (decisão final na Sprint 2.1)
- Catálogo inicial de `template_key` (lista de 3–5 templates de partida — definir junto com sócio antes da Sprint 2.1)
