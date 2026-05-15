-- =============================================================================
-- Sprint 0.3b — RLS pras tabelas de agentes
--
-- Padrão: tenant_id = public.current_tenant_id() pra todas operações.
-- Role-check (manager/operator/end_client) fica no código de domínio na 0.3c.
-- service_role bypassa RLS (padrão Supabase).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- agents
-- -----------------------------------------------------------------------------
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents_select_current_tenant" ON public.agents
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "agents_insert_current_tenant" ON public.agents
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "agents_update_current_tenant" ON public.agents
  FOR UPDATE
  TO authenticated
  USING      (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "agents_delete_current_tenant" ON public.agents
  FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- -----------------------------------------------------------------------------
-- tasks
-- -----------------------------------------------------------------------------
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select_current_tenant" ON public.tasks
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "tasks_insert_current_tenant" ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "tasks_update_current_tenant" ON public.tasks
  FOR UPDATE
  TO authenticated
  USING      (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "tasks_delete_current_tenant" ON public.tasks
  FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- -----------------------------------------------------------------------------
-- agent_runs
-- -----------------------------------------------------------------------------
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_runs_select_current_tenant" ON public.agent_runs
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "agent_runs_insert_current_tenant" ON public.agent_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "agent_runs_update_current_tenant" ON public.agent_runs
  FOR UPDATE
  TO authenticated
  USING      (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "agent_runs_delete_current_tenant" ON public.agent_runs
  FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- -----------------------------------------------------------------------------
-- agent_messages
-- -----------------------------------------------------------------------------
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_messages_select_current_tenant" ON public.agent_messages
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "agent_messages_insert_current_tenant" ON public.agent_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "agent_messages_update_current_tenant" ON public.agent_messages
  FOR UPDATE
  TO authenticated
  USING      (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "agent_messages_delete_current_tenant" ON public.agent_messages
  FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- -----------------------------------------------------------------------------
-- approvals
-- -----------------------------------------------------------------------------
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approvals_select_current_tenant" ON public.approvals
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "approvals_insert_current_tenant" ON public.approvals
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "approvals_update_current_tenant" ON public.approvals
  FOR UPDATE
  TO authenticated
  USING      (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "approvals_delete_current_tenant" ON public.approvals
  FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());
