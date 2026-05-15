-- =============================================================================
-- Sprint 0.3b — schema dos agentes
--
-- agents: definições por tenant (router/coordinator/specialist/supervisor).
-- tasks: unidade de trabalho (pode ter parent pra subtasks).
-- agent_runs: execução de um agente sobre uma task (custo, turnos, status).
-- agent_messages: passos do raciocínio do run (system/user/assistant/tool).
-- approvals: HITL — proposta + decisão humana.
--
-- function set_updated_at() já existe (initial_schema.sql).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- agents
-- -----------------------------------------------------------------------------
CREATE TABLE public.agents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  department      TEXT        NOT NULL
                              CHECK (department IN
                                ('atendimento','societario','pessoal','contabil','fiscal','financeiro_interno','platform')),
  role            TEXT        NOT NULL
                              CHECK (role IN ('router','coordinator','specialist','supervisor')),
  agent_key       TEXT        NOT NULL,
  name            TEXT        NOT NULL,
  description     TEXT,
  tier            TEXT        NOT NULL CHECK (tier IN ('triage','default','critical')),
  autonomy_tier   TEXT        NOT NULL DEFAULT 'sugestivo'
                              CHECK (autonomy_tier IN ('manual','sugestivo','semi_autonomo','autonomo')),
  budget          JSONB       NOT NULL DEFAULT '{"maxTokens":4000,"maxCostUsd":0.10,"maxTurns":10}'::jsonb,
  tools           JSONB       NOT NULL DEFAULT '[]'::jsonb,
  state           TEXT        NOT NULL DEFAULT 'idle'
                              CHECK (state IN ('idle','working','awaiting_approval','error','paused')),
  state_metadata  JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, agent_key)
);
CREATE INDEX idx_agents_tenant_dept ON public.agents(tenant_id, department);
CREATE INDEX idx_agents_state       ON public.agents(tenant_id, state) WHERE state != 'idle';

CREATE TRIGGER trg_agents_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- tasks
-- -----------------------------------------------------------------------------
CREATE TABLE public.tasks (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  account_id         UUID        REFERENCES public.accounts(id) ON DELETE SET NULL,
  trace_id           TEXT        NOT NULL,
  task_type          TEXT        NOT NULL,
  status             TEXT        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN
                                   ('pending','assigned','in_progress','awaiting_approval','completed','failed','cancelled')),
  priority           INTEGER     NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  payload            JSONB       NOT NULL DEFAULT '{}'::jsonb,
  result             JSONB,
  assigned_agent_id  UUID        REFERENCES public.agents(id) ON DELETE SET NULL,
  parent_task_id     UUID        REFERENCES public.tasks(id) ON DELETE CASCADE,
  due_at             TIMESTAMPTZ,
  started_at         TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_tenant_status   ON public.tasks(tenant_id, status, created_at DESC);
CREATE INDEX idx_tasks_assigned_agent  ON public.tasks(assigned_agent_id) WHERE assigned_agent_id IS NOT NULL;
CREATE INDEX idx_tasks_trace_id        ON public.tasks(trace_id);
CREATE INDEX idx_tasks_parent          ON public.tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- agent_runs
-- -----------------------------------------------------------------------------
CREATE TABLE public.agent_runs (
  id             UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID            NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agent_id       UUID            NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  task_id        UUID            NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  trace_id       TEXT            NOT NULL,
  status         TEXT            NOT NULL DEFAULT 'running'
                                 CHECK (status IN ('running','completed','failed','escalated','timeout')),
  turns          INTEGER         NOT NULL DEFAULT 0,
  tokens_used    INTEGER         NOT NULL DEFAULT 0,
  cost_usd       NUMERIC(12,6)   NOT NULL DEFAULT 0,
  error_message  TEXT,
  started_at     TIMESTAMPTZ     NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ
);
CREATE INDEX idx_agent_runs_task   ON public.agent_runs(task_id, started_at DESC);
CREATE INDEX idx_agent_runs_agent  ON public.agent_runs(agent_id, started_at DESC);
CREATE INDEX idx_agent_runs_trace  ON public.agent_runs(trace_id);

-- -----------------------------------------------------------------------------
-- agent_messages
-- -----------------------------------------------------------------------------
CREATE TABLE public.agent_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  run_id       UUID        NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  role         TEXT        NOT NULL CHECK (role IN ('system','user','assistant','tool')),
  content      JSONB       NOT NULL,
  turn_index   INTEGER     NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_messages_run ON public.agent_messages(run_id, turn_index);

-- -----------------------------------------------------------------------------
-- approvals — HITL
-- -----------------------------------------------------------------------------
CREATE TABLE public.approvals (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  task_id            UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  agent_id           UUID        NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  trace_id           TEXT        NOT NULL,
  action_type        TEXT        NOT NULL,
  proposal           JSONB       NOT NULL,
  context            JSONB       NOT NULL DEFAULT '{}'::jsonb,
  status             TEXT        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','approved','rejected','modified','cancelled')),
  reviewer_user_id   UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  decision           JSONB,
  decided_at         TIMESTAMPTZ,
  expires_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_approvals_tenant_status ON public.approvals(tenant_id, status, created_at DESC);
CREATE INDEX idx_approvals_pending       ON public.approvals(tenant_id, created_at DESC) WHERE status = 'pending';
CREATE INDEX idx_approvals_task          ON public.approvals(task_id);
