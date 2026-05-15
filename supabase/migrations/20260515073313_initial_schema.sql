-- =============================================================================
-- Sprint 0.2 — schema core multi-tenant
--
-- tenants → accounts → entities é a hierarquia de dados.
-- tenants ↔ users via tenant_users (membership + role).
-- audit_log é INSERT-only (revoke de UPDATE/DELETE em rls_policies.sql).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Updated_at trigger helper
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- tenants — um por escritório contábil (1:1 com Clerk Organization)
-- -----------------------------------------------------------------------------
CREATE TABLE public.tenants (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_org_id  TEXT        NOT NULL UNIQUE,
  name          TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'suspended', 'archived')),
  tier          TEXT        NOT NULL DEFAULT 'solo'
                            CHECK (tier IN ('solo', 'small', 'medium')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tenants_clerk_org_id ON public.tenants(clerk_org_id);

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- users — espelho local do Clerk user
-- -----------------------------------------------------------------------------
CREATE TABLE public.users (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id  TEXT        NOT NULL UNIQUE,
  email          TEXT        NOT NULL,
  full_name      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_clerk_user_id ON public.users(clerk_user_id);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- tenant_users — membership de user em tenant com role
-- -----------------------------------------------------------------------------
CREATE TABLE public.tenant_users (
  tenant_id  UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.users(id)   ON DELETE CASCADE,
  role       TEXT        NOT NULL
              CHECK (role IN ('owner_tenant', 'manager', 'operator', 'end_client', 'ai_supervisor')),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);
CREATE INDEX idx_tenant_users_user_id ON public.tenant_users(user_id);

-- -----------------------------------------------------------------------------
-- accounts — empresa cliente do escritório
-- -----------------------------------------------------------------------------
CREATE TABLE public.accounts (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  cnpj               TEXT        NOT NULL,
  razao_social       TEXT        NOT NULL,
  nome_fantasia      TEXT,
  regime_tributario  TEXT        CHECK (regime_tributario IN
                                  ('simples_nacional', 'lucro_presumido', 'lucro_real', 'mei')),
  status             TEXT        NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('active', 'inactive', 'archived')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, cnpj)
);
CREATE INDEX idx_accounts_tenant_id ON public.accounts(tenant_id);

CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- entities — matriz/filial dentro de uma account
-- -----------------------------------------------------------------------------
CREATE TABLE public.entities (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID        NOT NULL REFERENCES public.tenants(id)  ON DELETE RESTRICT,
  account_id           UUID        NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  type                 TEXT        NOT NULL CHECK (type IN ('matriz', 'filial')),
  inscricao_estadual   TEXT,
  inscricao_municipal  TEXT,
  address              JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_entities_account_id ON public.entities(account_id);
CREATE INDEX idx_entities_tenant_id  ON public.entities(tenant_id);

CREATE TRIGGER trg_entities_updated_at
  BEFORE UPDATE ON public.entities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- audit_log — INSERT-only; ver rls_policies.sql para revogação de UPDATE/DELETE
-- -----------------------------------------------------------------------------
CREATE TABLE public.audit_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id        TEXT        NOT NULL,
  tenant_id       UUID        REFERENCES public.tenants(id)  ON DELETE SET NULL,
  account_id      UUID        REFERENCES public.accounts(id) ON DELETE SET NULL,
  actor           TEXT        NOT NULL,
  action          TEXT        NOT NULL,
  resource        TEXT        NOT NULL,
  before          JSONB,
  after           JSONB,
  prompt_version  TEXT,
  model           TEXT,
  cost_usd        NUMERIC(12, 6),
  metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_tenant_created ON public.audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_audit_log_trace_id       ON public.audit_log(trace_id);

-- -----------------------------------------------------------------------------
-- current_tenant_id() — resolve clerk_org_id (claim o.id) pro UUID interno
-- SECURITY DEFINER + STABLE pra cache por query.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.tenants
  WHERE clerk_org_id = (auth.jwt() -> 'o' ->> 'id')
  LIMIT 1
$$;
