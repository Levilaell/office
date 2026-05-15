-- =============================================================================
-- Sprint 0.2 — dedupe de eventos do Clerk via Svix ID
--
-- Tabela acessada SOMENTE via service_role (bypass RLS). Sem policies; o role
-- 'authenticated' continua bloqueado mesmo com RLS ativo e sem policy.
-- =============================================================================

CREATE TABLE public.webhook_events (
  svix_id       TEXT        PRIMARY KEY,
  event_type    TEXT        NOT NULL,
  payload       JSONB       NOT NULL,
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
-- Sem policy = nada visível pro authenticated. Service role bypassa RLS.
