-- =============================================================================
-- Sprint 1.3 — message_drafts (versão mínima)
--
-- Tabela separada de `approvals` (ADR-017): drafts são respostas em conversa
-- síncrona — alto volume, expiração curta, semântica diferente da aprovação
-- regulatória clássica.
--
-- Esta migration entrega o ESSENCIAL pro Especialista registrar resposta
-- proposta. Sprint 1.5 implementa:
--  - Worker de expiração (lendo `expires_at`).
--  - `edit_diff` populado quando humano editar.
--  - UI de inbox de aprovação real (tier sugestivo bloqueante).
--  - Transição `pending → approved` via UI.
--
-- Na Fase 1 (Sprint 1.3), Especialista grava com `status='auto_approved'`
-- e envia mensagem outbound direto via ChannelAdapter — decisão pragmática
-- documentada em docs/sprint-reviews/1.3-especialista-operacional.md. Sprint
-- 1.5 muda comportamento pra `pending` real.
-- =============================================================================

CREATE TABLE public.message_drafts (
  id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID            NOT NULL REFERENCES public.tenants(id)        ON DELETE CASCADE,
  conversation_id     UUID            NOT NULL REFERENCES public.conversations(id)  ON DELETE CASCADE,
  agent_id            UUID            NOT NULL REFERENCES public.agents(id)         ON DELETE RESTRICT,
  agent_run_id        UUID            REFERENCES public.agent_runs(id)              ON DELETE SET NULL,
  source_message_id   UUID            REFERENCES public.messages(id)                ON DELETE SET NULL,

  proposed_content    TEXT            NOT NULL,
  content_type        TEXT            NOT NULL DEFAULT 'text'
                                      CHECK (content_type IN ('text', 'system_event')),

  -- Reasoning do agente (visível pro operador na UI). Confidence opcional —
  -- agente pode ter mandado por decisão determinística (sem LLM).
  reasoning           TEXT,
  confidence          NUMERIC(4,3)
                                      CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),

  -- Status do draft. `pending` é o caminho aprovação humana (Sprint 1.5).
  -- `auto_approved` é o caminho atual em tier sugestivo da Fase 1 — registra
  -- pra rastreabilidade mas mensagem já foi enviada.
  status              TEXT            NOT NULL DEFAULT 'pending'
                                      CHECK (status IN
                                        ('pending', 'approved', 'rejected', 'edited', 'expired', 'auto_approved')),

  -- Resolução (preenchido em approve/reject/edit/expire/auto_approve).
  resolved_by         UUID            REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at         TIMESTAMPTZ,
  final_message_id    UUID            REFERENCES public.messages(id) ON DELETE SET NULL,

  -- Diff entre `proposed_content` e o que de fato foi enviado (Sprint 1.5).
  edit_diff           JSONB,

  -- Janela de validade. Sprint 1.3 não enforça — Sprint 1.5 cria worker.
  expires_at          TIMESTAMPTZ,

  created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_message_drafts_tenant_status_created
  ON public.message_drafts(tenant_id, status, created_at DESC);

CREATE INDEX idx_message_drafts_conversation
  ON public.message_drafts(conversation_id, created_at DESC);

-- Inbox de aprovação (Sprint 1.5) filtra por pending — índice parcial.
CREATE INDEX idx_message_drafts_pending
  ON public.message_drafts(tenant_id, created_at DESC)
  WHERE status = 'pending';

CREATE TRIGGER trg_message_drafts_updated_at
  BEFORE UPDATE ON public.message_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.message_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_drafts_select_current_tenant" ON public.message_drafts
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "message_drafts_insert_current_tenant" ON public.message_drafts
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "message_drafts_update_current_tenant" ON public.message_drafts
  FOR UPDATE
  TO authenticated
  USING      (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "message_drafts_delete_current_tenant" ON public.message_drafts
  FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());
