-- =============================================================================
-- Sprint 1.2 — Histórico de classificações + display_settings do tenant
--
-- 1. conversation_classifications — INSERT-only. Cada classificação do
--    Coordenador de Atendimento vira uma row. `conversations.intent_current`
--    continua como denormalização da última (rápido pra UI). Histórico
--    permite audit e eval contínuo sem perder dados quando o intent muda.
--
-- 2. tenants.display_settings — JSONB livre pra bot_name, signature,
--    business_hours, etc. Coordenador usa pra renderizar templates de
--    saída. Default {} significa fallback: bot_name = tenants.name,
--    sem business_hours (sempre responde).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- conversation_classifications
-- -----------------------------------------------------------------------------
CREATE TABLE public.conversation_classifications (
  id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID            NOT NULL REFERENCES public.tenants(id)        ON DELETE CASCADE,
  conversation_id     UUID            NOT NULL REFERENCES public.conversations(id)  ON DELETE CASCADE,
  message_id          UUID            REFERENCES public.messages(id)                ON DELETE SET NULL,
  agent_id            UUID            NOT NULL REFERENCES public.agents(id)         ON DELETE RESTRICT,
  agent_run_id        UUID            REFERENCES public.agent_runs(id)              ON DELETE SET NULL,
  intent              TEXT            NOT NULL,
  -- 0.000-1.000. NULL aceitável pra decisões determinísticas (pre-classify
  -- pulando LLM); CHECK só valida o range quando preenchido.
  confidence          NUMERIC(4,3)    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  reasoning           TEXT,
  decision            TEXT            NOT NULL
                                      CHECK (decision IN (
                                        'respond_direct',
                                        'handoff_specialist',
                                        'escalate_human',
                                        'ignore'
                                      )),
  -- JSONB livre: targetAgentKey, suggestedTemplate, reasonForEscalation, etc.
  -- Schema rígido vem quando campos estabilizarem.
  decision_metadata   JSONB           NOT NULL DEFAULT '{}'::jsonb,
  prompt_version      TEXT,
  model               TEXT,
  cost_usd            NUMERIC(12,6),
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_conv_classifications_tenant_created
  ON public.conversation_classifications(tenant_id, created_at DESC);

CREATE INDEX idx_conv_classifications_conversation
  ON public.conversation_classifications(conversation_id, created_at DESC);

CREATE INDEX idx_conv_classifications_intent
  ON public.conversation_classifications(tenant_id, intent);

-- INSERT-only (igual audit_log) — histórico imutável.
ALTER TABLE public.conversation_classifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conv_classifications_select_current_tenant" ON public.conversation_classifications
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "conv_classifications_insert_current_tenant" ON public.conversation_classifications
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

REVOKE UPDATE, DELETE ON public.conversation_classifications FROM authenticated;

-- -----------------------------------------------------------------------------
-- tenants.display_settings
--
-- Estrutura esperada (validada em código, não no schema):
--   {
--     "bot_name": "Equipe Levi Lael",
--     "signature": "Equipe Levi Lael Contábil",
--     "business_hours": {
--       "start": "08:00", "end": "18:00",
--       "timezone": "America/Sao_Paulo",
--       "days": [1,2,3,4,5]
--     }
--   }
-- -----------------------------------------------------------------------------
ALTER TABLE public.tenants
  ADD COLUMN display_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.tenants.display_settings IS
  'Settings de exibição usadas pelo Coordenador ao renderizar mensagens: bot_name, signature, business_hours. Default {} → fallback: bot_name = tenants.name, sem business_hours.';
