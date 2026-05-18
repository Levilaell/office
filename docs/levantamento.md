# Snapshot Codebase — 2026-05-18
Branch: docs/adrs-014-017-fase-1
Último commit: 9d5c680 — docs(tech-debt): register TD-010 (ADR naming) and TD-011 (README status sections)
Tag mais recente: v0.1.0-fase-0
Total de arquivos TS/TSX: 119
Working tree: clean

> Read-only snapshot. Nenhum arquivo foi modificado. ADRs 014-017 (Fase 1) já existem no branch atual mas ainda não há código de Atendimento implementado — só docs.

## 1. Visão geral do monorepo

### Diretórios (até nível 5, sem node_modules/.next/dist/.git/.turbo)

```
.
├── .claude/rules/
├── apps/
│   ├── agent-runtime/src/{agents/router,realtime,workers}
│   ├── web/src/{app/(public),app/api,app/dashboard,app/onboarding,components/{approvals,office,ui},lib/{hooks,__tests__}}
│   └── workers/src/
├── docs/{adrs,...}
├── packages/
│   ├── shared-config/src
│   ├── shared-db/src/clients
│   ├── shared-domain/src/{agents,approvals,audit,llm,runs,tasks,tenants,users}
│   ├── shared-events/src
│   ├── shared-llm/src
│   ├── shared-prompts/src
│   └── shared-types/src
├── scripts/__tests__
├── supabase/{migrations,snippets,.branches,.temp}
└── tests/{integration,setup}
```

### Raiz — `package.json`

```json
{
  "name": "office",
  "version": "0.0.0",
  "private": true,
  "packageManager": "pnpm@10.33.3",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test && vitest run scripts/__tests__",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "typecheck": "turbo run typecheck",
    "clean": "turbo run clean && rm -rf node_modules",
    "check-env": "tsx scripts/check-env.ts",
    "db:start": "dotenvx run --env-file=.env.local -- supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:migrate": "supabase migration up --local",
    "db:types": "supabase gen types typescript --local > packages/shared-db/src/database.types.ts",
    "db:diff": "supabase db diff",
    "seed:agents": "tsx scripts/seed-existing-tenants.ts"
  },
  "devDependencies": {
    "@dotenvx/dotenvx": "^1.66.0",
    "@office/shared-domain": "workspace:*",
    "@office/shared-events": "workspace:*",
    "@office/shared-llm": "workspace:*",
    "@types/node": "^22.10.0",
    "@types/pg": "^8.20.0",
    "@typescript-eslint/eslint-plugin": "^8.18.1",
    "@typescript-eslint/parser": "^8.18.1",
    "dotenv": "^17.4.2",
    "eslint": "^8.57.1",
    "pg": "^8.20.0",
    "supabase": "^2.98.2",
    "tsx": "^4.19.2",
    "turbo": "^2.3.3",
    "typescript": "^5.6.3",
    "vitest": "^2.1.8"
  },
  "pnpm": {
    "onlyBuiltDependencies": ["esbuild", "msgpackr-extract", "supabase", "unrs-resolver"],
    "overrides": { "@types/react": "19.2.14", "@types/react-dom": "19.2.3" }
  }
}
```

### `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### `turbo.json`

```json
{
  "$schema": "https://turborepo.com/schema.json",
  "ui": "tui",
  "tasks": {
    "build":     { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**", "!.next/cache/**"] },
    "lint":      { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"], "outputs": [] },
    "test":      { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
    "dev":       { "cache": false, "persistent": true },
    "clean":     { "cache": false }
  }
}
```

### Apps & packages — 1 linha cada (extraído dos `package.json` deles)

| Workspace | Tipo | Descrição |
|---|---|---|
| `@office/web` | Next.js 15.5 (App Router, React 19.2, Tailwind 3.4, Pixi 8, Zustand 5, Clerk v7, Socket.io-client 4) | UI + API routes |
| `@office/agent-runtime` | Node ESM, Hono 4, Socket.io 4 server, LangGraph.js 1.3 + LangChain core 1.1, BullMQ via shared-events, Clerk backend 3.4 | Serviço de execução de agentes + WS server |
| `@office/workers` | Node ESM, BullMQ 5 — **placeholder**, stub `setInterval` apenas | Reservado pra notificações outbound futuras |
| `@office/shared-config` | Zod 3 | Validação de env (`parseAgentRuntimeEnv`, `parseWebEnv`, etc) + constants (PORTS, DEFAULTS, mapeamento tier→model) |
| `@office/shared-db` | `@supabase/supabase-js` 2.105 | Factories `createAuthenticatedClient` / `createServiceRoleClient` + tipos gerados |
| `@office/shared-domain` | depende de shared-db + shared-llm + shared-types | **Camada de acesso a dados única**. Re-exporta shared-db pra cumprir ADR-002 |
| `@office/shared-events` | BullMQ 5, ioredis 5, Zod | Queue `agent-tasks` + pub/sub `tenant:*` + schemas |
| `@office/shared-llm` | `@anthropic-ai/sdk` 0.96 + Langfuse OTel 5 + openinference-anthropic 0.1 + OpenTelemetry SDK | Wrapper LLM com tracing automático |
| `@office/shared-prompts` | só shared-config | Registry de prompts versionados (só `routerPrompt` + `examplePrompt` por enquanto) |
| `@office/shared-types` | nenhuma runtime dep | Enums + branded types compartilhados |

## 2. Configuração de TS, lint, format

### `tsconfig.base.json` (não há `tsconfig.json` na raiz)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": false,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "useUnknownInCatchVariables": true,
    "skipLibCheck": true,
    "declaration": true, "declarationMap": true, "sourceMap": true, "incremental": true
  },
  "exclude": ["node_modules", "dist", ".next", ".turbo"]
}
```

### Tsconfigs por workspace (apenas paths/overrides relevantes)

- `apps/web/tsconfig.json`: jsx=preserve, allowJs=true, noEmit=true, `paths: { "@/*": ["./src/*"] }`, plugin next, include `.next/types/**/*.ts`.
- `apps/agent-runtime/tsconfig.json`: emite pra `dist/`, `paths: { "@/*": ["src/*"] }`.
- `apps/workers/tsconfig.json`: idem.
- `packages/shared-llm/tsconfig.json`: noEmit=false, `paths: { "@/*": ["src/*"] }`.
- Demais packages: `noEmit=true`, sem paths customizados (consumidos via workspace).

### `.eslintrc.json` — boundaries reforçadas via ESLint

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": { "ecmaVersion": "latest", "sourceType": "module" },
  "plugins": ["@typescript-eslint"],
  "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
  },
  "ignorePatterns": ["node_modules", "dist", ".next", ".turbo", "*.config.js", "*.config.mjs", "*.config.cjs", "next-env.d.ts"],
  "overrides": [{
    "files": ["apps/**/*.{ts,tsx}"],
    "rules": {
      "no-restricted-imports": ["error", {
        "patterns": [
          { "group": ["@office/shared-db", "@office/shared-db/*"], "message": "Apps não podem importar @office/shared-db direto. Acesso a dados deve passar por @office/shared-domain ou pelo serviço de agentes." },
          { "group": ["@supabase/supabase-js", "@supabase/supabase-js/*"], "message": "Use shared-domain. Cliente Supabase só em shared-db, acesso via shared-domain (ADR-002)." }
        ]
      }]
    }
  }]
}
```

- ❌ não encontrado: `prettier.config.*` ou bloco `prettier` em `package.json`. Formatter não configurado explicitamente — projeto roda só `eslint` e `next lint`.

### Aliases em uso
- `@/*` → `src/*` (web, agent-runtime, workers, shared-llm). Padrão idêntico em todos, mas cada workspace tem seu próprio `baseUrl`.
- Resolução de packages workspace via `workspace:*` no `package.json`.

## 3. Schema do banco (Supabase)

### Localização
`supabase/migrations/` (5 arquivos). Tipos gerados em `packages/shared-db/src/database.types.ts` (793 linhas — não colado).

### Migrations em ordem cronológica
1. `20260515073313_initial_schema.sql` (153 linhas)
2. `20260515073314_rls_policies.sql` (110)
3. `20260515073315_webhook_events.sql` (16)
4. `20260515093000_agents_schema.sql` (136)
5. `20260515093001_agents_rls.sql` (137)

### `20260515073313_initial_schema.sql` — completo

```sql
-- Updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

-- tenants — 1:1 com Clerk Organization
CREATE TABLE public.tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_org_id  TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','archived')),
  tier          TEXT NOT NULL DEFAULT 'solo'   CHECK (tier IN ('solo','small','medium')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tenants_clerk_org_id ON public.tenants(clerk_org_id);
CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- users — espelho local do Clerk user
CREATE TABLE public.users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id  TEXT NOT NULL UNIQUE,
  email          TEXT NOT NULL,
  full_name      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_clerk_user_id ON public.users(clerk_user_id);
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- tenant_users — membership com role
CREATE TABLE public.tenant_users (
  tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id)   ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('owner_tenant','manager','operator','end_client','ai_supervisor')),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);
CREATE INDEX idx_tenant_users_user_id ON public.tenant_users(user_id);

-- accounts — empresa cliente do escritório
CREATE TABLE public.accounts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  cnpj               TEXT NOT NULL,
  razao_social       TEXT NOT NULL,
  nome_fantasia      TEXT,
  regime_tributario  TEXT CHECK (regime_tributario IN ('simples_nacional','lucro_presumido','lucro_real','mei')),
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, cnpj)
);
CREATE INDEX idx_accounts_tenant_id ON public.accounts(tenant_id);
CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- entities — matriz/filial
CREATE TABLE public.entities (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES public.tenants(id)  ON DELETE RESTRICT,
  account_id           UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  type                 TEXT NOT NULL CHECK (type IN ('matriz','filial')),
  inscricao_estadual   TEXT,
  inscricao_municipal  TEXT,
  address              JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_entities_account_id ON public.entities(account_id);
CREATE INDEX idx_entities_tenant_id  ON public.entities(tenant_id);
CREATE TRIGGER trg_entities_updated_at BEFORE UPDATE ON public.entities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- audit_log — INSERT-only
CREATE TABLE public.audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id        TEXT NOT NULL,
  tenant_id       UUID REFERENCES public.tenants(id)  ON DELETE SET NULL,
  account_id      UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  actor           TEXT NOT NULL,
  action          TEXT NOT NULL,
  resource        TEXT NOT NULL,
  before          JSONB,
  after           JSONB,
  prompt_version  TEXT,
  model           TEXT,
  cost_usd        NUMERIC(12,6),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_tenant_created ON public.audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_audit_log_trace_id       ON public.audit_log(trace_id);

-- current_tenant_id() resolve clerk_org_id (claim o.id) → UUID
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT id FROM public.tenants
  WHERE clerk_org_id = (auth.jwt() -> 'o' ->> 'id') LIMIT 1
$$;
```

### `20260515073314_rls_policies.sql` — completo (resumido nas tabelas similares)

- **tenants**: SELECT `id = current_tenant_id()`; sem INSERT/UPDATE/DELETE pro authenticated.
- **users**: SELECT `clerk_user_id = jwt->>'sub'` (próprio registro).
- **tenant_users**: SELECT `tenant_id = current_tenant_id()`.
- **accounts**, **entities**: CRUD completo restrito a `tenant_id = current_tenant_id()` (USING + WITH CHECK).
- **audit_log**: SELECT por tenant; INSERT permite `tenant_id IS NULL OR = current_tenant_id()`; `REVOKE UPDATE, DELETE ON public.audit_log FROM authenticated;`.

### `20260515073315_webhook_events.sql` — completo

```sql
CREATE TABLE public.webhook_events (
  svix_id       TEXT PRIMARY KEY,
  event_type    TEXT NOT NULL,
  payload       JSONB NOT NULL,
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
-- Sem policy = nada visível pro authenticated. Service role bypassa RLS.
```

### `20260515093000_agents_schema.sql` — extrato relevante

- **agents**: PK UUID; FK `tenant_id` CASCADE; CHECKs em `department` (7 valores: 6 deptos + `platform`), `role` (router/coordinator/specialist/supervisor), `tier` (triage/default/critical), `autonomy_tier` (manual/sugestivo/semi_autonomo/autonomo), `state` (idle/working/awaiting_approval/error/paused). `budget JSONB` default `{"maxTokens":4000,"maxCostUsd":0.10,"maxTurns":10}`. `tools JSONB` default `[]`. `state_metadata JSONB` default `{}`. UNIQUE `(tenant_id, agent_key)`. Índices `(tenant_id, department)` e parcial `(tenant_id, state) WHERE state != 'idle'`. Trigger updated_at.
- **tasks**: PK UUID; FK `tenant_id` CASCADE, `account_id` SET NULL, `assigned_agent_id` SET NULL, `parent_task_id` CASCADE (self-FK). `trace_id TEXT NOT NULL`, `task_type TEXT NOT NULL`, `status` CHECK (pending/assigned/in_progress/awaiting_approval/completed/failed/cancelled), `priority INT 1-10 default 5`, `payload JSONB default {}`, `result JSONB`. Timestamps started_at/completed_at/due_at. Índices em (tenant_id, status, created_at DESC), assigned_agent (parcial), trace_id, parent (parcial).
- **agent_runs**: PK UUID; FK CASCADE pra tenant/agent/task. `status` (running/completed/failed/escalated/timeout). `turns INT default 0`, `tokens_used INT default 0`, `cost_usd NUMERIC(12,6) default 0`, `error_message TEXT`. Índices por task, agent, trace_id.
- **agent_messages**: PK UUID; FK CASCADE pra tenant/run. `role` (system/user/assistant/tool), `content JSONB NOT NULL`, `turn_index INT`. Índice (run_id, turn_index).
- **approvals**: PK UUID; FK CASCADE pra tenant/task/agent, `reviewer_user_id` SET NULL. `action_type TEXT NOT NULL`, `proposal JSONB`, `context JSONB default {}`. `status` (pending/approved/rejected/modified/cancelled). `decision JSONB`, `decided_at`, `expires_at`. Índices por (tenant, status, created_at DESC), parcial em pendentes, por task.

### `20260515093001_agents_rls.sql`

Padrão idêntico ao `accounts/entities`: SELECT/INSERT/UPDATE/DELETE filtrando `tenant_id = current_tenant_id()` pra **agents, tasks, agent_runs, agent_messages, approvals**. Sem policies por role ainda — a regra "manager vê tudo, operator só próprio" fica no código (comentário menciona Sprint 0.3c, mas ainda não foi implementado).

### Tabelas pedidas que NÃO existem
- ❌ `documents` — não encontrado.
- ❌ `prompts` — não encontrado (prompts vivem em `packages/shared-prompts`, não em DB).
- ❌ `agent_policies` — não encontrado.
- ❌ `knowledge_base` — não encontrado.
- ❌ `task_history` — não existe; histórico vem de `audit_log` filtrado por `resource = 'task:<uuid>'`.

### Tipos exportados em `packages/shared-db/src/database.types.ts`
`Json`, `Database`, `Tables<>`, `TablesInsert<>`, `TablesUpdate<>`, `Enums<>`, `CompositeTypes<>`. Tabelas geradas: `accounts, agent_messages, agent_runs, agents, approvals, audit_log, entities, tasks, tenant_users, tenants, users, webhook_events`.

## 4. Kernel de agentes (`apps/agent-runtime`)

### Estrutura

```
apps/agent-runtime/src/
├── agents/
│   ├── registry.ts            # mapa agentKey → handler
│   ├── router/{graph.ts,index.ts}
│   └── types.ts               # AgentContext, AgentHandler
├── realtime/
│   ├── clerk.ts               # verifyClerkToken via JWKS
│   ├── socket.ts              # setupSocketIo + handshake auth
│   └── tenant.ts              # resolveTenantId(clerkOrgId)
├── workers/
│   └── agent-tasks.ts         # makeAgentTaskHandler (BullMQ consumer)
├── index.ts                   # Hono + Socket.io + worker boot
└── instrumentation.ts         # init tracing (precisa ser 1º import)
```

### `package.json` (resumo nas dependências críticas)

```json
"dependencies": {
  "@clerk/backend": "^3.4.8",
  "@hono/node-server": "^1.13.7",
  "@langchain/core": "^1.1.0",
  "@langchain/langgraph": "^1.3.0",
  "@office/shared-{config,domain,events,llm,prompts,types}": "workspace:*",
  "hono": "^4.6.14",
  "socket.io": "^4.8.3",
  "zod": "^3.23.8"
}
```

### Wrapper de LLM

**Path:** `packages/shared-llm/src/call.ts` — `llmCall(input: LlmCallInput): Promise<LlmCallOutput>`.

**Exports principais** (`packages/shared-llm/src/index.ts`):
- `llmCall` — função principal.
- `initLlmTracing` / `shutdownLlmTracing` / `isLlmTracingInitialized` (`./instrumentation`).
- `getAnthropicClient` / `resetAnthropicClient` (singleton em `./client`).
- `calculateCost`, `MODEL_PRICING` (`./pricing`).
- `estimateInputTokens`, `preflightBudget` (`./budget`).

**Tipos** (`./types`):
```ts
export type LlmMessage = Anthropic.MessageParam;
export interface LlmCallBudget   { maxTokens?: number; maxCostUsd?: number; }
export interface LlmCallMetadata { traceId?: string; tenantId?: string; accountId?: string; agentId?: string; promptVersion?: string; }
export interface LlmCallInput {
  tier: AgentTier;                  // 'triage' | 'default' | 'critical'
  messages: LlmMessage[];
  system?: string;
  maxTokens?: number;
  temperature?: number;
  budget?: LlmCallBudget;
  metadata?: LlmCallMetadata;
}
export interface LlmUsage { inputTokens; outputTokens; cacheReadInputTokens; cacheCreationInputTokens; }
export interface LlmCallOutput {
  text: string; modelId: LlmModelId; usage: LlmUsage;
  costUsd: number; latencyMs: number;
  stopReason: LlmStopReason | null;
  traceId: string; spanId?: string;
}
```

**Seleção de tier→model** (`packages/shared-config/src/constants.ts` + `env.ts`):
```ts
export const DEFAULT_TIER_TO_MODEL = {
  triage:   'claude-haiku-4-5-20251001',
  default:  'claude-sonnet-4-6',
  critical: 'claude-opus-4-7',
};
// resolveModelForTier(tier, env) usa LLM_MODEL_TRIAGE/DEFAULT/CRITICAL como override
```

**Custo capturado** em `call.ts`:
- `calculateCost(modelId, usage)` (pricing/M tokens com cache read 0.1x e cache write 1.25x da Anthropic).
- Atributos OTEL setados no span pai: `llm.tier`, `llm.model`, `llm.cost_usd`, `llm.usage.input_tokens`, `llm.usage.output_tokens`, `app.tenant_id`, `app.account_id`, `app.agent_id`, `app.prompt_version`.

**Trace propagation (Langfuse):**
- `initLlmTracing` em `packages/shared-llm/src/instrumentation.ts` registra NodeSDK + `LangfuseSpanProcessor`.
- Filtro custom `shouldExportLlmSpan` aceita scopes `@arizeai/openinference*` E `@office/shared-llm` (default da Langfuse rejeitaria o último).
- `llmCall` cria um span pai `llm.call` via `tracer.startActiveSpan` — o `traceId` retornado é estável e correlacionável.
- `getLlmTracer()` resolvido lazy (sem isso `trace.getTracer()` no top-level pegaria NoOp).

### Base/interface de agente

**Path:** `apps/agent-runtime/src/agents/types.ts`

```ts
export type AgentContext = {
  tenantId: string;
  accountId: string | null;
  taskId: string;
  runId: string;
  traceId: string;
  agentId: string;
  agentKey: string;
  supabase: ServiceRoleClient;            // worker não tem JWT — service_role
  recordMessage: (role: 'system'|'user'|'assistant'|'tool', content: Json) => Promise<void>;
};

export type AgentHandler<TInput = unknown, TOutput = unknown> =
  (input: TInput, ctx: AgentContext) => Promise<TOutput>;
```

**Registry** (`apps/agent-runtime/src/agents/registry.ts`):
```ts
export const AGENT_HANDLERS: Record<string, AgentHandler> = {
  router: runRouter as AgentHandler<any, any>,
};
export const getAgentHandler = (agentKey: string): AgentHandler => { /* throws se desconhecido */ };
```

> ⚠️ Só existe **um** agente concreto (o `router`). Coordenadores/specialists ainda não têm template.

### Agente Roteador

**Paths:**
- `apps/agent-runtime/src/agents/router/graph.ts` — graph LangGraph (2 nós: `classify` → `validate`).
- `apps/agent-runtime/src/agents/router/index.ts` — `runRouter(input, ctx)`.
- Prompt: `packages/shared-prompts/src/router.ts` (id `router.classify`, version `1.0.0`, tier `triage`).

**Lógica de execução** (resumo):
1. `classify` registra `system` (prompt renderizado) e `user` (texto) via `ctx.recordMessage`.
2. Chama `llmCall({ tier: 'triage', system, messages, maxTokens:600, temperature:0, budget:{maxTokens:1500, maxCostUsd:0.02}, metadata:{traceId, tenantId, accountId, agentId, promptVersion} })`.
3. `appendLlmAuditLog` grava `audit_log` com action=`llm.call`, resource=`task:<id>`, prompt_version, model, cost.
4. Registra `assistant` com text/modelId/cost/latency/usage.
5. `validate` parseia JSON (strip fences tolerante) e valida com Zod (`RouterDepartment = 'atendimento'|'societario'|'pessoal'|'contabil'|'fiscal'|'financeiro_interno'`, `confidence`, `reasoning`, `alternatives?`).
6. Falha de schema vira `RouterValidationError` → worker marca run como `failed`.

**Como ele publica o resultado:** retorna `RouterDecision`. **NÃO emite evento direto** — o worker (`makeAgentTaskHandler`) detecta `result.department` via `extractDepartment` e publica `task.completed` no canal `tenant:{id}`. O design previsto pelos ADRs (10/16) é roteador → `task.assigned` no bus pro coordenador subscrever; isso ainda **não está implementado** porque não há coordenador.

### Sistema de budget/limites

**Path:** `packages/shared-llm/src/budget.ts`
- `estimateInputTokens(messages, system?)`: heurística `chars/4`.
- `preflightBudget({ estimatedInputTokens, requestedMaxTokens, modelId, budget })`: throw se `requestedMaxTokens > maxTokens` OU se worst-case (`input + maxTokens output`) `> maxCostUsd`.
- Defaults (`process.env.LLM_DEFAULT_BUDGET_MAX_TOKENS`=4000 e `..._MAX_COST_USD`=0.1) lidos a cada call.
- Pós-call: se `costUsd > budget.maxCostUsd`, só `console.warn` (não bloqueia).

> ❌ **Não encontrado:** hard limit de `maxTurns`. O DB tem `agents.budget.maxTurns` e `agent_runs.turns`, mas nada decrementa ou enforça. Loop detection (`mesma ação 3+ vezes`) e timeout por run também **não estão implementados**.

### Sistema de audit log de agente run

**Wrappers** (`packages/shared-domain/src/audit/index.ts` + `llm/audit.ts`):

```ts
// Genérico
export const appendAuditLog = async (supabase, entry: AuditEntryInput): Promise<void>;

// Atalho pra ciclo de vida de task (resource = `task:<id>`)
export const recordTaskLifecycle = async (supabase, {
  tenantId, accountId?, taskId, traceId, actor, action: 'task.created'|'task.assigned'|'task.completed'|'task.failed', metadata?
}): Promise<void>;

// LLM-specific (popula prompt_version, model, cost_usd, metadata.usage/latency/stop_reason)
export const appendLlmAuditLog = async (supabase, output: LlmCallOutput, ctx: LlmAuditContext): Promise<void>;
```

**Quem chama:**
- `apps/agent-runtime/src/workers/agent-tasks.ts` chama `recordTaskLifecycle` em `task.completed` e `task.failed`.
- `apps/agent-runtime/src/agents/router/graph.ts` chama `appendLlmAuditLog` por `llm.call`.
- `apps/web/src/lib/triagem.ts` chama `recordTaskLifecycle` em `task.created`.
- `apps/web/src/app/api/approvals/[id]/decide/route.ts` chama `appendAuditLog` direto pra `approval.decided` e `approval.info_requested`.

> ❌ **Não há** `recordTaskLifecycle('task.assigned', ...)` em nenhum lugar — `assignTask` é chamado em `triagem.ts` mas não loga audit dessa transição.

## 5. Bus de eventos e filas (BullMQ + Redis)

### Setup de Redis
**Path:** `packages/shared-events/src/redis.ts`
- Pool com 3 clientes nomeados: `publisher`, `subscriber`, `bullmq`.
- `bullmq`: `{ maxRetriesPerRequest: null, enableOfflineQueue: false }` (exigido pelo BullMQ).
- `subscriber`: `{ maxRetriesPerRequest: null }`.
- URL via `process.env.REDIS_URL` (lazy throw).
- `closeAllRedis()` para shutdown.

### Queues existentes

```ts
// packages/shared-events/src/queues.ts
const AGENT_TASKS_QUEUE = 'agent-tasks';
defaultJobOptions: {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { age: 24*3600, count: 1000 },
  removeOnFail: { age: 7*24*3600 },
}
```

Lista oficial em `JOB_QUEUES = ['agent-tasks']` (schemas.ts) — **só uma fila por enquanto**, payload carrega `agentKey` e o roteamento fica no handler.

### Schemas de eventos (`packages/shared-events/src/schemas.ts`)

```ts
EVENT_TYPES = [
  'task.created.global', 'task.assigned', 'task.status_changed',
  'task.completed', 'task.failed', 'subtask.completed',
  'handoff.requested', 'agent.state_changed',
  'approval.created', 'approval.resolved',
]

// Payloads (todos Zod):
TaskCreatedPayload      { taskId, tenantId, traceId, taskType, priority(1-10) }
TaskAssignedPayload     { taskId, tenantId, agentId, department, traceId }
TaskStatusChangedPayload{ taskId, tenantId, traceId, previousStatus, status }
TaskCompletedPayload    { taskId, tenantId, traceId, department?, result? }
TaskFailedPayload       { taskId, tenantId, traceId, department?, error }
SubtaskCompletedPayload { parentTaskId, taskId, tenantId, traceId }
HandoffRequestedPayload { fromAgentId, toAgentId|null, tenantId, taskId, traceId, reason, payload? }
AgentStateChangedPayload{ agentId, tenantId, previousState, state, metadata? }
ApprovalCreatedPayload  { approvalId, tenantId, taskId, agentId, traceId, actionType }
ApprovalResolvedPayload { approvalId, tenantId, status, reviewerUserId|null }

// Envelope
EventEnvelope { type, payload(unknown), traceId, timestamp }

// Job
AgentTaskJobPayload { taskId(uuid), tenantId(uuid), traceId, agentKey }
```

### Padrão de worker

```ts
// queues.ts
export const createAgentTasksWorker = (handler, opts) => new Worker(AGENT_TASKS_QUEUE,
  async (job) => { const parsed = AgentTaskJobPayload.parse(job.data); await handler(parsed); },
  { connection: getRedis('bullmq'), concurrency: opts.concurrency ?? 5 }
);
```

Worker concreto é montado em `apps/agent-runtime/src/index.ts` com `BULLMQ_CONCURRENCY` (default 5) e usa `makeAgentTaskHandler` de `workers/agent-tasks.ts`.

### Trace ID na publicação
`publishEvent(eventType, channel, payload, traceId = crypto.randomUUID())` — quem chama deve passar o `traceId` correlacionado, senão um novo é gerado. **Não há propagação automática** entre publish e consume além do `traceId` no envelope; cada handler precisa ler `envelope.traceId` se quiser correlação.

### Retry / DLQ
- BullMQ: `attempts:3 + backoff exponential 1s`. **Não há DLQ formal** — failed jobs ficam 7 dias com `removeOnFail.age`.
- Pub/sub: fire-and-forget; mensagens malformadas viram `console.warn`.

## 6. Realtime (Socket.io)

### Servidor
**Path:** `apps/agent-runtime/src/realtime/socket.ts` (montado em `apps/agent-runtime/src/index.ts`)
- Mesmo `http.Server` Hono é host do Socket.io (`path: '/socket.io'`).
- CORS `origin: WEB_ORIGIN, credentials: true`.
- Middleware `io.use` valida `socket.handshake.auth.token` (Clerk JWT) via `verifyClerkToken` (JWKS) → resolve `tenantId` via `getTenantByClerkOrgId(serviceRoleClient)` → grava em `socket.data`.
- Connection handler: `socket.join('tenant:'+tenantId)` e `emit('connected', {tenantId})`.
- **Bridge Redis pub/sub → Socket.io rooms**: `subscribeEvents('tenant:*', (channel, type, payload) => io.to(channel).emit(type, payload))` em `index.ts`. Tudo publicado em `tenant:*` é repassado pros sockets da room correspondente.

### Cliente
**Path:** `apps/web/src/components/realtime-provider.tsx`
- Montado em `apps/web/src/app/dashboard/layout.tsx` com `initialSnapshot` server-side (agents + tasks(50) + approvals pendentes via RLS).
- Conecta `io(NEXT_PUBLIC_AGENT_RUNTIME_URL, { auth: { token: await getToken() }, transports: ['websocket'] })`.

### Eventos emitidos pelo runtime (e consumidos pelo provider)
- `connected` → `{ tenantId }` (handshake).
- `agent.state_changed` → aplica delta direto no store (`updateAgentState(agentId, state, metadata)`).
- `task.status_changed | task.assigned | task.completed | task.failed | task.created.global` → triggera `refetchTasks()` (GET `/api/tasks/recent`) e `replaceTasks`.
- `approval.created | approval.resolved` → triggera `refetchApprovals()` (GET `/api/approvals?status=pending`) e `replaceApprovals`.

### Stores Zustand
**Path:** `apps/web/src/lib/realtime-store.ts` — único store `useRealtimeStore` com `agents/tasks/approvals` indexados por id. Selectors usam `useShallow` quando retornam arrays derivados.

## 7. Multi-tenancy e auth

### Clerk
- Provider: `apps/web/src/app/layout.tsx` envolve tudo em `<ClerkProvider localization={ptBR}>`.
- Middleware: `apps/web/src/middleware.ts` — `clerkMiddleware` com `createRouteMatcher(['/dashboard(.*)', '/onboarding(.*)'])` chamando `auth.protect()`.
- Helper auth: `apps/web/src/lib/auth.ts` — `getCurrentAuthContext()` resolve `userId, orgId, role, email` (role vindo de `sessionClaims.publicMetadata.role`, default `operator`).

### Derivação de `tenant_id`
**Apenas via JWT**, nunca via URL/body. Caminhos:
- Server-side em API routes que usam RLS: cliente Supabase autenticado lê `auth.jwt() -> 'o' ->> 'id'`, função `current_tenant_id()` resolve UUID interno.
- API routes que precisam de service_role: chamam `getTenantByClerkOrgId(supabase, auth.orgId)` e usam `tenant.id`.
- Socket handshake: `claims.o.id` → `resolveTenantId(clerkOrgId)`.

### Clientes Supabase
**Path:** `packages/shared-db/src/clients/server.ts` e `service.ts`
```ts
// Authenticated (RLS ativo) — Third-Party Auth Native:
export const createAuthenticatedClient = ({ url, anonKey, accessToken }): SupabaseClient<Database> =>
  createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    async accessToken() { return (await config.accessToken()) ?? ''; },
  });

// Service role (bypass RLS — server-only):
export const createServiceRoleClient = ({ url, serviceRoleKey }): SupabaseClient<Database>;
```

**Instanciados em** `apps/web/src/lib/supabase.ts`:
- `getSupabaseForCurrentUser()`: usa `auth().getToken()` (Clerk session) — RLS aplicada.
- `getServiceRoleSupabase()`: usado em webhook Clerk, `complete-org`, `triagem.ts`. ESLint bloqueia import direto de `@office/shared-db` em apps.

### Onde service_role é usado (legítimo)
- `apps/web/src/app/api/webhooks/clerk/route.ts` — dedup via `webhook_events` + sync de tenants/users/membership.
- `apps/web/src/app/api/onboarding/complete-org/route.ts` — criação síncrona pós-organization.
- `apps/web/src/lib/triagem.ts` — busca router do tenant + cria task + assigna + enfileira (workaround porque task criada antes do worker rodar).
- `apps/web/src/app/api/triagem/route.ts` — só pra `getTenantByClerkOrgId(serviceRole)` antes de enfileirar.
- `apps/agent-runtime` inteiro — worker BullMQ não tem JWT de user.

### Helpers de tenant context
- `current_tenant_id()` SQL function (initial_schema.sql) — STABLE SECURITY DEFINER.
- `getTenantByClerkOrgId(supabase, clerkOrgId)` em `packages/shared-domain/src/tenants/index.ts`.
- `getCurrentTenant(supabase)` faz `SELECT * FROM tenants` confiando que RLS retorna no máximo 1 linha.
- ❌ **Não há** helper "validateTenantContext" em API route — cada rota chama `getCurrentAuthContext()` + checa null + (se precisar service_role) busca tenant via clerk org.

### Testes de isolamento
✅ Existem em `tests/integration/rls.test.ts` (8 testes, tabelas base) e `tests/integration/events.test.ts` (4 testes RLS pras tabelas de agente). Rodam contra Postgres local Supabase com `SET LOCAL request.jwt.claims`. **Não rodam em CI** — `pnpm test` (CI) não inclui `test:integration`.

## 8. UI (`apps/web`)

### Estrutura de rotas (App Router)

```
src/app/
├── (public)/
│   ├── page.tsx                     # landing
│   ├── sign-in/[[...sign-in]]/page.tsx
│   └── sign-up/[[...sign-up]]/page.tsx
├── api/
│   ├── agents/
│   │   ├── route.ts                          # GET — lista agents do tenant (RLS)
│   │   └── [id]/{metrics,runs}/route.ts      # GET — métricas/runs do agente
│   ├── approvals/
│   │   ├── route.ts                          # GET ?status=pending|...
│   │   └── [id]/decide/route.ts              # POST approve|reject|modify|request_info
│   ├── health/route.ts
│   ├── onboarding/complete-org/route.ts      # POST — sync síncrono
│   ├── tasks/
│   │   ├── recent/route.ts                   # GET ?limit=50
│   │   └── [taskId]/route.ts                 # GET — status + result + traceId
│   ├── triagem/route.ts                      # POST — enfileira no roteador
│   └── webhooks/clerk/route.ts               # webhook Svix
├── dashboard/
│   ├── layout.tsx                            # redirect /sign-in|/onboarding, pre-busca snapshot, RealtimeProvider
│   ├── page.tsx                              # info do tenant (placeholder)
│   ├── aprovacoes/page.tsx                   # client-only — usa usePendingApprovals()
│   └── escritorio/page.tsx                   # OfficeCanvasShell (PixiJS)
├── onboarding/
│   ├── page.tsx                              # CreateOrganization Clerk
│   └── finishing/page.tsx                    # POST complete-org → redirect dashboard
├── globals.css
└── layout.tsx                                # ClerkProvider + pt-BR
```

Route groups: só `(public)`. Demais rotas vivem direto em `dashboard/` (protegidas pelo middleware).

### Páginas implementadas
- `/` (landing simples).
- `/sign-in`, `/sign-up` (Clerk catch-all).
- `/onboarding` (criar org) + `/onboarding/finishing` (sync).
- `/dashboard` (info tenant — placeholder).
- `/dashboard/escritorio` (canvas isométrico).
- `/dashboard/aprovacoes` (inbox).

❌ **Não há** página de conversa, painel de tasks, ou listagem de agents fora do canvas. Existem só as **superfícies básicas previstas pelo ADR-011**, parcialmente.

### Canvas isométrico (PixiJS)

**Paths:**
- `apps/web/src/components/office/OfficeCanvas.tsx` — Application Pixi 8, init async, container ref.
- `apps/web/src/components/office/OfficeCanvasShell.tsx` — lê `useAgents()` do store, mapeia pra `RenderAgent[]`, abre `AgentSheet` ao clicar.
- `scene.ts` — renderScene + updateAgents (footprint diamond, accent corners, ticker pulse pra `working`).
- `rooms.ts` — 7 salas hardcoded em grid 3×3 (incluindo `recepcao` que não tem departamento de domínio).
- `iso.ts`, `positioning.ts`, `agent-render.ts`, `visuals.ts` — helpers de coordenadas e visuais por estado.

**Lê estado real do banco:** sim — via `useAgents()` (Zustand) hidratado server-side em `dashboard/layout.tsx` (RLS) + deltas Socket.io (`agent.state_changed`).

### Inbox de aprovações

**Path:** `apps/web/src/components/approvals/`
- `ApprovalsInbox.tsx` — header com filtros (departamento, urgência "expirando em 4h"), grid de cards.
- `ApprovalCard.tsx` — clicável, mostra agente, ação humanizada, descrição, expira-em.
- `ApprovalSheet.tsx` — Sheet lateral com Descrição/Contexto/Proposta(JSON)/Histórico(placeholder) + botões (Aprovar/Rejeitar/Modificar/Pedir info).
- `ActionDialog.tsx` — dialog modal por ação, valida JSON em "modify", justificativa obrigatória em reject/request_info.
- `ApprovalsList.tsx` — variante mais simples (não usada pela inbox).
- Página: `dashboard/aprovacoes/page.tsx` (client-only).

### AgentSheet
**Path:** `apps/web/src/components/office/AgentSheet.tsx` — Sheet aberto ao clicar agente no canvas.
- Mostra: nome, descrição, departamento+role+state (badges com cor por state), tier (Haiku/Sonnet/Opus), autonomia, agentKey, id.
- Seções "Runs recentes" (hook `useAgentRuns(id)` → GET `/api/agents/:id/runs?limit=10`) e "Métricas" com toggle 24h/7d/30d (`useAgentMetrics`).
- Footer com botão "Configurar" disabled.

### Stores Zustand
Único store: `useRealtimeStore` em `apps/web/src/lib/realtime-store.ts`. Selectors exportados:
`useAgents`, `useAgent(id)`, `useAgentsByDepartment(dept)`, `usePendingApprovals`, `useApproval(id)`, `useTask(id)`, `useRecentTasks(limit=20)`, `useHydrated`, `useSocketConnected`.

### Componentes shadcn/ui em uso (`apps/web/src/components/ui/`)
`badge.tsx`, `button.tsx`, `card.tsx`, `dialog.tsx`, `select.tsx`, `sheet.tsx`, `textarea.tsx`. Mínimo viável — sem `toast`, sem `tooltip`, sem `tabs`.

### Build/style configs
- `next.config.mjs`: `reactStrictMode: true`, `transpilePackages: [...]` pra todos os shared-* (necessário pra packages ESM TS direto).
- `tailwind.config.ts`: presets shadcn padrão + `tailwindcss-animate`.

## 9. Sistema de aprovação

### Endpoint decide
**Path:** `apps/web/src/app/api/approvals/[id]/decide/route.ts`. Resumo:

- Auth via `getCurrentAuthContext()` (Clerk session).
- Body validado via `z.discriminatedUnion('action', [approve, reject, modify, request_info])`.
- Lê approval com cliente RLS — `getApprovalById` retorna null se for de outro tenant (tratado como 404).
- `request_info`: só registra `approval.info_requested` no audit, não muda approval.
- Demais ações: bloqueia se `status !== 'pending'` (409). Resolve `reviewer_user_id` via `getUserByClerkUserId` (UUID interno, não Clerk ID).
- Chama `decideApproval(supabase, id, { status, decision, reviewerUserId })`.
- Grava `appendAuditLog({ action: 'approval.decided', resource: 'approval:<id>', before, after, metadata: decisionPayload })`.
- Publica `approval.resolved` no canal `tenant:<id>`. Falha de publish vira `console.error` (não derruba a operação).

### Função domain
**Path:** `packages/shared-domain/src/approvals/index.ts` — `decideApproval(supabase, approvalId, { status, decision, reviewerUserId })` faz `update().eq('id', approvalId).select().maybeSingle()`.

> ⚠️ TD-004 (tech-debt.md): `decideApproval` **NÃO filtra `eq('status', 'pending')` no UPDATE** — race em decisões concorrentes.

### Tier de autonomia
**Definido em** schema (`agents.autonomy_tier` CHECK manual/sugestivo/semi_autonomo/autonomo) e tipos (`AUTONOMY_TIERS` em shared-types).

**❌ NÃO há código** que consulte `autonomy_tier` antes de criar uma approval ou bypassar a aprovação. Hoje a única coisa que aprovação gerencia é a transição `pending → approved|rejected|modified|cancelled`. Não há produtor de approvals em código (nenhum agente cria approval ainda).

### UI listando pendentes
`ApprovalsInbox` (item 8) + `/dashboard/aprovacoes`.

## 10. Prompts versionados

### Estrutura
`packages/shared-prompts/src/`
- `index.ts` — declara interface `PromptDefinition` e exporta `routerPrompt`, `examplePrompt`.
- `router.ts` — prompt único concreto.

```ts
export interface PromptDefinition {
  id: string;
  version: string;
  description: string;
  tier: AgentTier;
  testedAt: string | null;
  render: (input: Record<string, unknown>) => string;
}
```

### Identificação
Chave composta `id@version` (ex: `router.classify@1.0.0`). Quem chama o LLM passa essa string em `metadata.promptVersion`.

### Como o wrapper sabe a versão
Não sabe automaticamente — caller passa em `LlmCallInput.metadata.promptVersion`. Ex: `promptVersion: \`${routerPrompt.id}@${routerPrompt.version}\`` em `router/graph.ts`.

### Prompts existentes
1. `routerPrompt` (id `router.classify`, v1.0.0, tier triage) — classifica em 6 departamentos.
2. `examplePrompt` (id `example.health-check`, v0.0.1, tier triage) — placeholder.

> Ausência notável: nenhum prompt pra coordenador, specialist, ou supervisor. **Fase 1 vai precisar começar a popular esse pacote**.

## 11. Observabilidade

### Langfuse — **único integrado**
- `packages/shared-llm/src/instrumentation.ts` — `initLlmTracing` configura `LangfuseSpanProcessor` + `AnthropicInstrumentation` (openinference).
- Chamado em `apps/agent-runtime/src/instrumentation.ts` (precisa ser 1º import, antes de qualquer `Anthropic`).
- Atributos exportados: `llm.tier`, `llm.model`, `llm.cost_usd`, `llm.usage.input_tokens`, `llm.usage.output_tokens`, `app.tenant_id`, `app.account_id`, `app.agent_id`, `app.prompt_version`.
- Filtro custom aceita scopes `@arizeai/openinference*` e `@office/shared-llm`.

### Sentry / PostHog / Better Stack
❌ **Não integrados.** Nenhum import de `@sentry/*`, `posthog-*` ou `@logtail/*` em código. Mencionados no `CLAUDE.md` como "planejados Fase 1+".

### Logging
- Não há helper de logging estruturado. Tudo via `console.log/warn/error` com prefixos manuais (`[agent-runtime]`, `[realtime]`, `[workers/agent-tasks]`, `[approvals.decide]`, `[shared-events]`).
- Sem propagação de `trace_id` automática em logs — quando aparece, é interpolado manualmente (`trace=${traceId}`).

## 12. Testes

### Configs
- Unit: `vitest.config.ts` — globals=false, env=node, include `**/*.{test,spec}.{ts,tsx}`, `passWithNoTests: true`.
- Integration: `vitest.integration.config.ts` — include `tests/integration/**/*.test.ts`, setupFiles `tests/setup/load-env.ts`, `fileParallelism: false`, `testTimeout: 30000`.
- ❌ Playwright **não configurado** — sem `playwright.config.*`, sem suite E2E.

### Localização dos testes

**Unit** (rodam em `pnpm test` via turbo + extra `vitest run scripts/__tests__`):
- `apps/web/src/lib/__tests__/` — `agent-detail-api.test.ts`, `approvals-api.test.ts`, `realtime-store.test.ts`, `relative-time.test.ts` (807 linhas totais com os abaixo).
- `apps/web/src/components/office/__tests__/` — `iso.test.ts`, `positioning.test.ts`.
- `apps/web/src/components/approvals/__tests__/` — `action-labels.test.ts`.
- `scripts/__tests__/check-env.test.ts`.

**Integration** (rodam só em `pnpm test:integration`, contra Postgres + Redis locais):
- `tests/integration/rls.test.ts` — isolamento + audit immutability (8 testes).
- `tests/integration/events.test.ts` — pub/sub + BullMQ + RLS agents/tasks/approvals (5 testes).
- `tests/integration/llm.test.ts` — call real Anthropic (skip se não tem keys) + budget preflight.
- `tests/integration/router-e2e.test.ts` — kernel ponta a ponta (enfileira → worker → router → assertions em runs/messages/audit/eventos).

### Mocking de LLM
❌ **Não há helper de mock LLM**. Testes unitários **não mockam** o cliente Anthropic — quem precisa de LLM cai pro `integration` que chama real (com `skipIf(!hasKeys)`). Nenhum sistema VCR-style.

### Comandos efetivos
- `pnpm test` — rodam unit (incluindo scripts).
- `pnpm test:integration` — rodam tudo de `tests/integration/` (requer Supabase local + Redis + opcionalmente keys Anthropic/Langfuse).
- `pnpm typecheck`, `pnpm lint`, `pnpm build` — todos via turbo.

### Suite de isolamento de tenant
✅ `tests/integration/rls.test.ts` + `tests/integration/events.test.ts` (seção RLS). **Não roda em CI** — Postgres local não está disponível no workflow.

### Cobertura
❌ Não há `c8`/`istanbul` configurado. `pnpm test` não emite coverage.

## 13. Scripts e tooling

### Pasta `scripts/`
- `check-env.ts` (~156 linhas) — valida `.env.local` por app contra `.env.example`. Tem testes.
- `seed-existing-tenants.ts` (~83 linhas) — seed retroativo de agentes pra tenants pré-existentes (idempotente via upsert). Carrega `.env.local` da raiz + apps/web/.env.local + apps/agent-runtime/.env (gatilho de TD-005 — paths inconsistentes).

### Scripts npm úteis
- `pnpm db:start | db:stop | db:reset` — Supabase CLI local.
- `pnpm db:migrate` — `supabase migration up --local`.
- `pnpm db:types` — `supabase gen types typescript --local > packages/shared-db/src/database.types.ts`.
- `pnpm db:diff` — gera migration diff.
- `pnpm seed:agents` — roda `seed-existing-tenants.ts`.
- `pnpm check-env` — valida envs (não bloqueia `dev`).

### Seeds
- Único seed: `seedDefaultAgentsForTenant` (em `packages/shared-domain/src/agents/seed.ts`) cria/atualiza o agente `router` (department=platform, role=router, tier=triage, autonomy=autonomo, budget {1500 tokens, 0.02 USD, 1 turn}). Idempotente via `upsert onConflict: 'tenant_id,agent_key'`. Campos `tier/autonomy_tier/budget` **NÃO** são sobrescritos em re-runs (preserva customizações).
- Chamado em: webhook Clerk `organization.created|updated`, API `complete-org`, script `seed-existing-tenants.ts`.

### CI (`.github/workflows/ci.yml`)
Trigger: push em `main` + PRs pra `main`. Job único `ci` em `ubuntu-latest`:
1. Checkout.
2. Setup pnpm v4 + Node 20 com cache pnpm.
3. `pnpm install --frozen-lockfile`.
4. Cache `.turbo`.
5. **Guard custom**: grep falha se `NEXT_PUBLIC_*SERVICE_ROLE*` aparecer em `apps/`/`packages/`.
6. `pnpm typecheck` → `pnpm lint` → `pnpm test` → `pnpm build`.

Workflows totais: `.github/workflows/ci.yml` (1). Sem deploy, sem release.

Outros arquivos `.github/`: `CODEOWNERS` (`* @levilael`), `pull_request_template.md` (sessões: O que muda, Como testei, ADR relacionado, Riscos).

## 14. Documentação existente

### `CLAUDE.md` raiz
Define princípios (1-7), stack travada (versões maio/2026), regras de código, regras de agentes, regras multi-tenancy, regras de auditoria, estrutura monorepo, estado atual (Fase 0 fechada, v0.1.0-fase-0), comandos, NÃO fazer, quando pausar, modelos preferidos, referências.

### `.claude/rules/` (7 arquivos)
- `README.md`, `agents-architecture.md`, `auditability.md`, `contabilidade-brasileira.md`, `llm-cost.md`, `llm-prompts.md`, `multi-tenancy.md`, `testing.md`.

### ADRs em `docs/adrs/` (17 + README)

| # | Título | Status |
|---|---|---|
| 001 | pnpm workspaces + Turborepo como gerenciador de monorepo | aceito |
| 002 | Boundaries entre packages e regra de acesso a dados | aceito |
| 003 | Padrão de comunicação entre web e agent-runtime | aceito (item 3 atualizado pelo ADR-009) |
| 004 | Auth via Clerk + Third-Party Auth Native do Supabase | aceito |
| 005 | Multi-tenancy com tenant_id UUID + clerk_org_id mapping | aceito |
| 006 | audit_log INSERT-only + estrutura mandatória | aceito |
| 007 | Sincronização Clerk → DB via webhook + onboarding síncrono | aceito |
| 008 | Abstração de tier de LLM com override por env | aceito |
| 009 | Socket.io server vive em apps/agent-runtime | aceito (substitui detalhe do ADR-003) |
| 010 | Orquestração de agentes em 3 camadas + supervisor | aceito |
| 011 | UX em quatro superfícies complementares | aceito |
| 012 | Supabase Cloud como dev | aceito |
| 013 | Redis nativo no WSL como backend de filas em dev | aceito |
| 014 | Escopo Atendimento Fase 1 (operacional + comercial leve) | aceito |
| 015 | Abstração ChannelAdapter | aceito |
| 016 | Coordenador de Atendimento como camada de roteamento | aceito |
| 017 | Modo shadow + tiers de autonomia em conversa síncrona | aceito |

> Naming inconsistente: 001-009 usam prefixo `ADR-NNN-...`, 010-017 só `NNN-...` (TD-010).

### `docs/tech-debt.md` — TDs ativos

| ID | Severidade | Resumo |
|---|---|---|
| TD-001 | 🟡 | `enqueueTriagem` faz 2 writes (create+assign) — race pequena |
| TD-002 | 🟡 | `incrementRunUsage` varre `agent_messages.content` — falha em multi-call. **Bloqueador Sprint 0.4** |
| TD-003 | 🟡 | Eventos `task.*`/`approval.*` carregam delta — provider refetch coleção inteira |
| TD-004 | 🔴 | `decideApproval` sem `eq('status','pending')` — race em multi-reviewer. **Fechar antes de demo** |
| TD-005 | 🟢 | `seed-existing-tenants.ts` lê env de paths incorretos |
| TD-006 | 🟡 | `.env.local` duplicado em 3 apps |
| TD-007 | 🟢 | Turbo dev sai com "0 successful, 3 total" — cosmético |
| TD-008 | 🟢 | ESLint 8 deprecated |
| TD-009 | 🟢 | Warning peer dep Clerk v7 / Next 15 |
| TD-010 | 🟢 | Naming inconsistente ADRs 001-009 vs 010-017 |
| TD-011 | 🟢 | `docs/adrs/README.md` sem seções por status |

Nenhum item fechado ainda.

### Outros docs
- `docs/escopo-produto.md` (257 linhas) — escopo completo do produto.
- `docs/development.md` (185 linhas) — setup, envs, infra, gotchas.
- `README.md` raiz — status v0.1.0-fase-0, comandos, link pra development.md.

### Sub-CLAUDE.mds
❌ Nenhum `CLAUDE.md` em `apps/*` ou `packages/*`. Só `CLAUDE.md` raiz + `CLAUDE.local.md` (gitignored).

## 15. Variáveis de ambiente

### `.env.example` — chaves declaradas

```
ANTHROPIC_API_KEY
LANGFUSE_HOST
LANGFUSE_PUBLIC_KEY
LANGFUSE_SECRET_KEY
SUPABASE_URL
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_DOMAIN
REDIS_URL
INTERNAL_SERVICE_TOKEN
NEXT_PUBLIC_AGENT_RUNTIME_URL
```

### Lidas no código (via `grep process.env.*`)

Subset que efetivamente aparece:
- `ANTHROPIC_API_KEY` (shared-llm/client.ts).
- `CLERK_WEBHOOK_SECRET` (webhooks/clerk/route.ts) — **declarada no schema env mas NÃO listada no `.env.example`**.
- `LLM_DEFAULT_BUDGET_MAX_COST_USD`, `LLM_DEFAULT_BUDGET_MAX_TOKENS` (shared-llm/call.ts) — não declaradas no `.env.example`.
- `LLM_TRACING_DEBUG` (shared-llm/instrumentation.ts) — debug opt-in.
- `NEXT_PUBLIC_AGENT_RUNTIME_URL` (realtime-provider).
- `NODE_ENV`, `REDIS_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`.

Outras (`SUPABASE_ANON_KEY`, `CLERK_*`, `LANGFUSE_*`, `INTERNAL_SERVICE_TOKEN`, `WEB_ORIGIN`, `BULLMQ_CONCURRENCY`, `LLM_MODEL_TRIAGE|DEFAULT|CRITICAL`) são lidas via parsers Zod em `packages/shared-config/src/env.ts` (`parseLlmEnv`, `parseSupabaseEnv`, `parseAgentRuntimeEnv`, `parseWebEnv`).

### Schemas Zod em `shared-config/src/env.ts`
- `baseEnvSchema` → NODE_ENV, LOG_LEVEL, LLM_MODEL_TRIAGE|DEFAULT|CRITICAL (opcionais).
- `redisEnvSchema` → REDIS_URL.
- `supabaseEnvSchema` → SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY + CLERK_DOMAIN + CLERK_WEBHOOK_SECRET.
- `webEnvSchema` extends supabase → NEXT_PUBLIC_CLERK_*, CLERK_SECRET_KEY, defaults sign-in/up/redirects, NEXT_PUBLIC_AGENT_RUNTIME_URL, INTERNAL_SERVICE_TOKEN?, REDIS_URL?.
- `llmEnvSchema` extends base → ANTHROPIC_API_KEY, LANGFUSE_PUBLIC/SECRET/HOST, LLM_DEFAULT_BUDGET_MAX_TOKENS (4000), LLM_DEFAULT_BUDGET_MAX_COST_USD (0.1).
- `agentRuntimeEnvSchema` extends llm → REDIS_URL, BULLMQ_CONCURRENCY (5), INTERNAL_SERVICE_TOKEN (required), WEB_ORIGIN (http://localhost:3000), CLERK_DOMAIN, CLERK_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

## 16. Inconsistências, gaps e tech debt observados

### Schema vs. código
- **Tabelas no DB sem produtor de dados:** `entities` (nenhum INSERT em código), `approvals` (nenhum agente cria approval — só endpoint `/decide` consome), `agent_messages` (escrito só pelo router), `subtask_completed`/`handoff.requested` events (definidos no schema mas sem publisher).
- **Campo `agents.budget.maxTurns` e `agent_runs.turns`** — escritos mas **nenhum enforce**. Worker incrementa `turns: 1` literal em todo run, sem propagar valor real do loop interno do agente.
- **Campo `agent_runs.status='escalated'`** — definido mas nenhum código atribui.
- **Tabela `webhook_events`** sem cleanup — cresce indefinidamente (Svix IDs nunca expiram).

### Camadas/boundaries
- `apps/web/src/lib/triagem.ts` é "server-only" mas faz lógica de domínio (criar task + assignar + recordTaskLifecycle + enqueue). Pela regra "lógica de domínio em `shared-domain`" do CLAUDE.md raiz, isso deveria estar em `packages/shared-domain/src/triagem/index.ts` ou similar.
- Apps **NÃO** podem importar `@office/shared-db` (ESLint guard), mas o re-export em `packages/shared-domain/src/index.ts` expõe `Database`, `Json`, `createServiceRoleClient` etc — efetivamente apps importam shared-db por proxy. Mantém o guard funcional mas a separação é nominal.
- `apps/web/src/components/office/rooms.ts` redefine `Department` localmente como union de strings (inclui `recepcao` que não é depto de domínio), separado do `Department` canônico em `shared-types`. `agent-render.ts` carrega os dois (`Department` from shared-types + `RoomDepartment` from rooms).

### Padrões inconsistentes
- **Naming ADRs** (TD-010): `ADR-NNN-...` vs `NNN-...`.
- **Audit lifecycle incompleto**: nenhum `task.assigned` registrado no audit (a transição existe mas não é logada).
- **Logging**: prefixos manuais (`[shared-events]`, `[agent-runtime]`, `[approvals.decide]`) sem padrão estruturado; nenhum logger central.
- **`process.env` lido em vários lugares fora dos parsers**: `shared-llm/call.ts` (defaults de budget), `shared-llm/instrumentation.ts` (LLM_TRACING_DEBUG, NODE_ENV) — bypassam o Zod schema.
- **Service role lookup duplicado**: `realtime/tenant.ts` e `lib/supabase.ts` e `workers/agent-tasks.ts` cada um instancia seu próprio singleton de `ServiceRoleClient` (sem reuso). 3 conexões no agent-runtime.
- **Singleton vs lazy**: `getRedis` é por-tipo (3 clientes), `getAnthropicClient` é único (e tem `resetAnthropicClient` só pra testes). Não há `closeAllClients()` agregador.

### TODOs/FIXMEs in-code
Nenhum `TODO`, `FIXME`, `HACK`, `XXX` ou `@deprecated` encontrado no grep — toda dívida está só no `docs/tech-debt.md`. Comentários "tech debt" inline aparecem só em `.env.example` ("tech debt: consolidar...") e nos próprios arquivos do tech-debt.md.

### Coisas começadas e não terminadas
- `apps/workers/src/index.ts` — placeholder com `setInterval` vazio (boot OK, sem worker registrado). Existe só pra `pnpm dev` não reclamar.
- `ApprovalSheet`: seção "Histórico" mostra "Sem eventos registrados ainda. O histórico aparece aqui após integração com o bus de eventos." → integração nunca foi feita.
- `OfficeCanvasShell`: `onRoomClick` é no-op explícito (`// sem ação por enquanto; sala não abre painel`).
- `AgentSheet`: botão "Configurar" `disabled title="Em breve"`.
- Endpoint `/llm/test` no `agent-runtime/src/index.ts` é "temporário pra validação manual em dev (será removido na 0.3c)" — sprint 0.3c já fechou (kernel ponta a ponta), endpoint ainda existe.
- `apps/web/src/components/approvals/ApprovalsList.tsx` existe mas não é importado por nada — variante "simples" da inbox que parece ter sido refatorada e esquecida.

### Discrepâncias docs vs código
- `CLAUDE.md` diz "Sentry + Better Stack + PostHog planejados (Fase 1+)" — coerente, nada instalado.
- `CLAUDE.md` lista "Cobertura: 47 testes unit + integration verdes" — não há ferramenta de coverage configurada pra confirmar o número.
- `rules/agents-architecture.md` afirma "Máximo de turnos por agente por task: configurável (default 10)" e "Detecção de loop: mesma ação repetida 3+ vezes = escalar pro supervisor" — **nenhum dos dois implementado**.
- `rules/llm-cost.md`: "Pre-flight check: estimar tokens antes de chamar" ✅ feito. "Hard stop quando atingir 90% do budget" ❌ não — só `console.warn` pós-call. "cascade Haiku → Sonnet → Opus baseado em confidence" ❌ não — caller escolhe tier manualmente.
- `rules/auditability.md`: "Aprovação humana registra user_id, timestamp, decisão" ✅ feito. "Se modificou: registra o que foi modificado" ✅ no `metadata.modifiedProposal`. "Justificativa opcional mas recomendada" ✅ aceita.
- `README.md` lista `apps/web/components/realtime-provider` no diretório mas o componente está em `src/components/`. Cosmético.

### Faltando pra Fase 1 (Atendimento)
Levantamento puro — só registrando o que **não existe** que os ADRs 014-017 vão precisar:
- Tabelas `conversations`, `messages`, `channels`, `accounts.channels` — não existem.
- Tipos/Zod schemas pra ChannelAdapter (ADR-015) — não existem.
- Handler de coordenador (`agentKey: 'atendimento.coordinator'` ou similar) — não registrado.
- Prompt do coordenador — não criado.
- Sistema de "modo shadow" (ADR-017) — sem código.
- Modelagem de autonomia em conversa síncrona — sem código.

## Resumo executivo

- **Fundação sólida e enxuta.** Kernel ponta a ponta (web → BullMQ → agent-runtime → LLM → audit) funciona com 1 agente real (router/Haiku) e cobertura razoável de testes de integração (RLS, pub/sub, BullMQ, llm, e2e). Stack travada com versões coerentes (Next 15.5, React 19, LangGraph 1.3, Anthropic SDK 0.96).
- **Auditoria e RLS estão bem cimentados.** `audit_log` INSERT-only com REVOKE, `current_tenant_id()` via Clerk claim, RLS uniforme em todas as tabelas de domínio, suite de testes provando isolamento. Bom alicerce regulatório.
- **Wrapper de LLM é o ponto mais maduro do código.** Tracing OTEL → Langfuse com filtro custom, span pai estável, custo calculado com pricing cache-aware, budget preflight. Pronto pra escalar pra Sonnet/Opus sem refactor.
- **Sistema de agentes está esqueleto.** O contrato `AgentContext/AgentHandler` existe e o registry é trivial de expandir, mas: zero enforce de turns/timeout/loop-detection, nenhum produtor de approvals em código, `incrementRunUsage` quebra em multi-call (TD-002 — bloqueador da Fase 1). Coordenador/specialist/supervisor não têm template.
- **`apps/workers` é placeholder.** Só `setInterval` vazio. Toda Fase 1 vai usar `apps/agent-runtime` direto, ou esse workspace precisa ganhar propósito.
- **UI tem 3 superfícies das 4 do ADR-011** (inbox, escritório 2D, painel mínimo). Falta "conversa". Inbox tem race latente (TD-004 🔴) que precisa fechar antes de qualquer demo multi-user.
- **Domínio de Atendimento é terra zero.** Sem tabelas (`conversations`, `messages`, `channels`), sem ChannelAdapter, sem coordenador, sem prompt. Os 4 ADRs novos (014-017) definem o desenho, mas zero linha de implementação.
- **Boundaries ESLint são bem definidas** mas vazadas por re-export em `shared-domain/index.ts` — apps efetivamente acessam tipos/factories de `shared-db` por proxy. Funcional, mas a separação é nominal.
- **Observabilidade só tem Langfuse.** Sem Sentry/PostHog/Better Stack, sem logger estruturado central. Logs são `console.*` com prefixos manuais — vai começar a doer quando a Fase 1 multiplicar agentes/canais.
- **Triagem mora em `apps/web/src/lib/triagem.ts`**, não em `shared-domain`. Viola sutilmente o princípio "lógica de domínio em shared-domain" e bloqueia reuso server-side (ex: webhook de canal disparando triagem sem passar pelo Next).
- **Documentação em dia** (CLAUDE.md, 11 regras, 17 ADRs, tech-debt vivo). É o ativo de continuidade mais valioso do projeto — manter esse padrão ao entrar na Fase 1.
