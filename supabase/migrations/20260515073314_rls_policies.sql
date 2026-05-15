-- =============================================================================
-- Sprint 0.2 — RLS policies
--
-- Toda tabela de domínio: RLS habilitado.
-- Filtro principal: tenant_id = public.current_tenant_id().
-- Role-check fica no código (repos em shared-domain) por enquanto;
-- policy só ancora isolamento entre tenants.
-- audit_log é INSERT-only: REVOKE UPDATE, DELETE no role authenticated.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- tenants — user vê só o tenant ativo (clerk_org_id bate com claim o.id)
-- -----------------------------------------------------------------------------
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants_select_own" ON public.tenants
  FOR SELECT
  TO authenticated
  USING (id = public.current_tenant_id());

-- Sem INSERT/UPDATE/DELETE pro authenticated (service_role lida via webhook + sync onboarding).

-- -----------------------------------------------------------------------------
-- users — vê só o próprio registro (clerk_user_id = JWT sub)
-- -----------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_self" ON public.users
  FOR SELECT
  TO authenticated
  USING (clerk_user_id = (auth.jwt() ->> 'sub'));

-- -----------------------------------------------------------------------------
-- tenant_users — vê só linhas do tenant ativo
-- -----------------------------------------------------------------------------
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_users_select_current_tenant" ON public.tenant_users
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- -----------------------------------------------------------------------------
-- accounts — CRUD restrito ao tenant ativo
-- -----------------------------------------------------------------------------
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounts_select_current_tenant" ON public.accounts
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "accounts_insert_current_tenant" ON public.accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "accounts_update_current_tenant" ON public.accounts
  FOR UPDATE
  TO authenticated
  USING      (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "accounts_delete_current_tenant" ON public.accounts
  FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- -----------------------------------------------------------------------------
-- entities — mesmo padrão de accounts
-- -----------------------------------------------------------------------------
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entities_select_current_tenant" ON public.entities
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "entities_insert_current_tenant" ON public.entities
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "entities_update_current_tenant" ON public.entities
  FOR UPDATE
  TO authenticated
  USING      (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "entities_delete_current_tenant" ON public.entities
  FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- -----------------------------------------------------------------------------
-- audit_log — SELECT do tenant; INSERT só com tenant_id válido; sem UPDATE/DELETE
-- -----------------------------------------------------------------------------
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select_current_tenant" ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "audit_log_insert_current_tenant" ON public.audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() OR tenant_id IS NULL);

REVOKE UPDATE, DELETE ON public.audit_log FROM authenticated;
