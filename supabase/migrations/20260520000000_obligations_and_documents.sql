-- =============================================================================
-- Sprint 1.3 — Especialista Operacional: dados canônicos read-only
--
-- 1. obligations — obrigações fiscais/trabalhistas/societárias do account.
--    Estrutura intencionalmente "mínima viável" — Fase 1 não calcula
--    impostos nem integra com sistema contábil legacy (ADR-014). Especialista
--    apenas LÊ. Refatoração futura quando integração legacy entrar é aditiva
--    (campos novos, sem renomear/remover).
--
-- 2. documents — documentos do cliente (NFe, comprovantes, contratos, etc).
--    `storage_path` opcional — Fase 1 pode registrar "cliente disse que
--    enviou X" sem o binário. Integração com Supabase Storage é Fase 2+.
--
-- Decisões registradas em docs/sprint-reviews/1.3-especialista-operacional.md.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- obligations
-- -----------------------------------------------------------------------------
CREATE TABLE public.obligations (
  id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID            NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  account_id          UUID            NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  entity_id           UUID            REFERENCES public.entities(id)          ON DELETE SET NULL,

  -- Identificação. `type` é TEXT livre — variedade de obrigações brasileiras
  -- (federal/estadual/municipal/trabalhista) torna enum frágil. `category`
  -- tem CHECK pra ter agrupamento mínimo.
  type                TEXT            NOT NULL,
  category            TEXT            NOT NULL
                                      CHECK (category IN
                                        ('federal', 'estadual', 'municipal', 'trabalhista', 'societaria')),
  description         TEXT,

  -- Período fiscal
  competencia         TEXT            NOT NULL,             -- 'YYYY-MM' (ex: '2026-10')
  reference_period    DATERANGE,                            -- pra obrigações trimestrais/anuais

  -- Financeiro
  amount              NUMERIC(14,2),                        -- null aceito (ainda não calculado)
  amount_paid         NUMERIC(14,2),                        -- pode diferir (juros/desconto)

  -- Prazos e status
  due_date            DATE            NOT NULL,
  paid_at             TIMESTAMPTZ,
  status              TEXT            NOT NULL DEFAULT 'pending'
                                      CHECK (status IN
                                        ('pending', 'paid', 'overdue', 'cancelled', 'in_dispute')),

  -- Pagamento
  payment_method      TEXT,                                 -- 'boleto', 'pix', 'darf_eletronico', etc
  payment_link        TEXT,
  payment_code        TEXT,                                 -- código de barras / chave pix

  -- Livre
  notes               TEXT,
  metadata            JSONB           NOT NULL DEFAULT '{}'::jsonb,

  created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_obligations_account_due
  ON public.obligations(account_id, due_date);

CREATE INDEX idx_obligations_tenant_status_due
  ON public.obligations(tenant_id, status, due_date)
  WHERE status IN ('pending', 'overdue');

CREATE INDEX idx_obligations_competencia
  ON public.obligations(tenant_id, competencia);

CREATE TRIGGER trg_obligations_updated_at
  BEFORE UPDATE ON public.obligations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.obligations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "obligations_select_current_tenant" ON public.obligations
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "obligations_insert_current_tenant" ON public.obligations
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "obligations_update_current_tenant" ON public.obligations
  FOR UPDATE
  TO authenticated
  USING      (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "obligations_delete_current_tenant" ON public.obligations
  FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- -----------------------------------------------------------------------------
-- documents
-- -----------------------------------------------------------------------------
CREATE TABLE public.documents (
  id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID            NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  account_id          UUID            NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  entity_id           UUID            REFERENCES public.entities(id)          ON DELETE SET NULL,

  -- Identificação. Mesmo critério de `obligations.type` — TEXT livre, CHECK
  -- só em `category`.
  type                TEXT            NOT NULL,
  category            TEXT            NOT NULL
                                      CHECK (category IN
                                        ('fiscal', 'contabil', 'societario', 'trabalhista', 'financeiro', 'outro')),
  description         TEXT,

  -- Período fiscal (opcional — alguns documentos são atemporais)
  competencia         TEXT,                                 -- 'YYYY-MM'
  reference_date      DATE,

  -- Status
  status              TEXT            NOT NULL DEFAULT 'pending'
                                      CHECK (status IN
                                        ('pending', 'received', 'processed', 'rejected', 'archived')),
  received_at         TIMESTAMPTZ,
  processed_at        TIMESTAMPTZ,

  -- Armazenamento (opcional na Fase 1)
  storage_path        TEXT,
  file_name           TEXT,
  file_size           BIGINT,
  mime_type           TEXT,

  -- Origem (rastreabilidade — qual mensagem trouxe o documento)
  source              TEXT,                                 -- 'whatsapp', 'email', 'manual_upload', etc
  source_message_id   UUID            REFERENCES public.messages(id) ON DELETE SET NULL,

  -- Livre
  notes               TEXT,
  metadata            JSONB           NOT NULL DEFAULT '{}'::jsonb,

  created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_account_reference
  ON public.documents(account_id, reference_date DESC NULLS LAST);

CREATE INDEX idx_documents_tenant_status
  ON public.documents(tenant_id, status, created_at DESC);

CREATE INDEX idx_documents_competencia
  ON public.documents(tenant_id, competencia)
  WHERE competencia IS NOT NULL;

CREATE INDEX idx_documents_pending
  ON public.documents(tenant_id, status)
  WHERE status = 'pending';

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select_current_tenant" ON public.documents
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "documents_insert_current_tenant" ON public.documents
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "documents_update_current_tenant" ON public.documents
  FOR UPDATE
  TO authenticated
  USING      (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "documents_delete_current_tenant" ON public.documents
  FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());
