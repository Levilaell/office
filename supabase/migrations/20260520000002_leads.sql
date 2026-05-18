-- =============================================================================
-- Sprint 1.4 — leads (qualificação progressiva pelo Especialista Comercial)
--
-- Lead = pessoa/empresa interessada que AINDA NÃO é cliente do escritório.
-- Conversion → cria account real e seta converted_to_account_id.
--
-- Decisões registradas:
--
-- 1. SEM coluna account_id no lead. Lead inherita via primary_conversation_id
--    quando o contexto precisa (conversation.account_id existe — herdado do
--    default_account_id do canal). Adicionar account_id em leads duplicaria
--    estado e abriria divergência com a conversation. converted_to_account_id
--    é o campo semanticamente correto pra registrar a transição lead→account.
--
-- 2. primary_contact_id como UUID nullable SEM FK. A tabela `contacts` não
--    existe em main (Fase 1.5+/2). Forward-compat: quando contacts existir,
--    migration aditiva adiciona FK. Sem REFERENCES = sem erro de migration.
--    TD-021 registra.
--
-- 3. qualification_data JSONB livre. Slot rígido em coluna travaria evolução
--    enquanto definição de slots está nascendo. Estrutura documentada em
--    packages/shared-domain/src/atendimento/leads/slots.ts; futura migração
--    pode promover slots estáveis a colunas dedicadas.
-- =============================================================================

CREATE TABLE public.leads (
  id                          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID            NOT NULL REFERENCES public.tenants(id)         ON DELETE CASCADE,
  -- Sem FK por enquanto: contacts não existe. UUID puro pra ser substituído por
  -- migration aditiva (ALTER TABLE leads ADD CONSTRAINT ... FOREIGN KEY ...).
  primary_contact_id          UUID,
  primary_conversation_id     UUID            REFERENCES public.conversations(id)            ON DELETE SET NULL,
  source                      TEXT            NOT NULL CHECK (source IN (
                                                'whatsapp_evolution',
                                                'whatsapp_cloud',
                                                'email_imap',
                                                'simulated_webhook',
                                                'manual',
                                                'unknown'
                                              )),
  source_metadata             JSONB           NOT NULL DEFAULT '{}'::jsonb,
  status                      TEXT            NOT NULL DEFAULT 'new' CHECK (status IN (
                                                'new',
                                                'qualifying',
                                                'qualified',
                                                'scheduled_pending',
                                                'converted',
                                                'lost',
                                                'dropped'
                                              )),
  qualification_data          JSONB           NOT NULL DEFAULT '{}'::jsonb,
  estimated_value_monthly     NUMERIC(12,2),
  notes                       TEXT,
  assigned_to_user_id         UUID            REFERENCES public.users(id)                    ON DELETE SET NULL,
  converted_to_account_id     UUID            REFERENCES public.accounts(id)                 ON DELETE SET NULL,
  qualified_at                TIMESTAMPTZ,
  scheduled_call_at           TIMESTAMPTZ,
  converted_at                TIMESTAMPTZ,
  lost_reason                 TEXT,
  created_at                  TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_tenant_status_created
  ON public.leads(tenant_id, status, created_at DESC);

-- Partial pra inbox de qualificação ativa — query mais comum no inbox do operador.
CREATE INDEX idx_leads_tenant_qualifying
  ON public.leads(tenant_id, status)
  WHERE status IN ('new', 'qualifying');

CREATE INDEX idx_leads_primary_conversation
  ON public.leads(primary_conversation_id)
  WHERE primary_conversation_id IS NOT NULL;

CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_select_current_tenant" ON public.leads
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "leads_insert_current_tenant" ON public.leads
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "leads_update_current_tenant" ON public.leads
  FOR UPDATE
  TO authenticated
  USING      (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "leads_delete_current_tenant" ON public.leads
  FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

COMMENT ON TABLE public.leads IS
  'Pessoa/empresa interessada antes de virar account. Qualificação progressiva por slot-filling. Conversion via converted_to_account_id.';

COMMENT ON COLUMN public.leads.qualification_data IS
  'JSONB livre com slots: contact_name, has_existing_company, company_size_estimate, current_regime, main_pain, decision_timeline, etc. Estrutura validada em código (packages/shared-domain/src/atendimento/leads/slots.ts).';

COMMENT ON COLUMN public.leads.primary_contact_id IS
  'Forward-compat: tabela contacts não existe ainda. Migration aditiva adiciona FK quando contacts surgir.';
