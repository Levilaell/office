-- =============================================================================
-- Sprint 1.0 — Fundações do departamento de Atendimento
--
-- conversations: thread por (account, channel, channel_handle). Um cliente
-- final que escreve por email e WhatsApp tem 2 conversations. Merge unificado
-- vira possibilidade futura.
--
-- interactions: uma mensagem dentro de uma conversation. Tabela é NOVA aqui
-- (prompt de Sprint 1.0 assumia que existia mas não havia migration). Schema
-- já inclui conversation_id + direction + sender_type + sender_id desde
-- nascimento — sem DO blocks condicionais.
--
-- function set_updated_at() já existe (initial_schema.sql).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- conversations — thread por (account, channel, channel_handle)
-- -----------------------------------------------------------------------------
CREATE TABLE public.conversations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  account_id      UUID        NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  channel         TEXT        NOT NULL
                              CHECK (channel IN ('email', 'whatsapp', 'simulated_webhook', 'sms')),
  channel_handle  TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open', 'waiting_client', 'resolved', 'archived')),
  subject         TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count    INTEGER     NOT NULL DEFAULT 0,
  metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, account_id, channel, channel_handle)
);

CREATE INDEX idx_conversations_tenant_status
  ON public.conversations (tenant_id, status, last_message_at DESC);
CREATE INDEX idx_conversations_account
  ON public.conversations (account_id, last_message_at DESC);

CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_select_current_tenant" ON public.conversations
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "conversations_insert_current_tenant" ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "conversations_update_current_tenant" ON public.conversations
  FOR UPDATE
  TO authenticated
  USING      (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "conversations_delete_current_tenant" ON public.conversations
  FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- -----------------------------------------------------------------------------
-- interactions — uma mensagem dentro de uma conversation
-- -----------------------------------------------------------------------------
CREATE TABLE public.interactions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES public.tenants(id)        ON DELETE CASCADE,
  account_id       UUID        NOT NULL REFERENCES public.accounts(id)       ON DELETE CASCADE,
  conversation_id  UUID        NOT NULL REFERENCES public.conversations(id)  ON DELETE CASCADE,
  direction        TEXT        NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender_type      TEXT        NOT NULL
                               CHECK (sender_type IN ('end_client', 'agent', 'operator', 'system')),
  sender_id        TEXT,
  content          TEXT        NOT NULL,
  metadata         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_interactions_conversation
  ON public.interactions (conversation_id, created_at);
CREATE INDEX idx_interactions_tenant_created
  ON public.interactions (tenant_id, created_at DESC);

ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "interactions_select_current_tenant" ON public.interactions
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "interactions_insert_current_tenant" ON public.interactions
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "interactions_update_current_tenant" ON public.interactions
  FOR UPDATE
  TO authenticated
  USING      (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "interactions_delete_current_tenant" ON public.interactions
  FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());
