-- =============================================================================
-- Sprint 1.1 — Sessões de canal externo
--
-- 1 sessão por (tenant, canal). Um tenant pode ter no máximo um IMAP inbox,
-- uma instância Evolution, etc. Multi-inbox por canal vira refactor futuro
-- (UI atual nem expõe).
--
-- `channel` identifica o adapter (`email_imap`, `whatsapp_evolution`, ...).
-- Mapping pra ConversationChannel abstrato vive em código (channels/types.ts).
--
-- `secrets_ref` é referência opaca a um Vault/secrets manager futuro. Na
-- Fase 1, vale como `env:<NOME_DA_VAR>` — o worker resolve via process.env
-- aplicando WHITELIST de prefixos (`SEED_*`, `CHANNEL_*`) pra impedir que
-- linha de DB sob ataque dereferencie variável arbitrária. Migrar pra Vault
-- real é Fase 2+.
--
-- NUNCA armazenar credenciais em plaintext nesta tabela.
-- =============================================================================

CREATE TABLE public.channel_sessions (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel              TEXT        NOT NULL
                                   CHECK (channel IN (
                                     'simulated_webhook',
                                     'email_imap',
                                     'whatsapp_evolution',
                                     'whatsapp_cloud'
                                   )),
  status               TEXT        NOT NULL DEFAULT 'disconnected'
                                   CHECK (status IN (
                                     'connected',
                                     'disconnected',
                                     'qr_pending',
                                     'banned',
                                     'error'
                                   )),
  -- número WhatsApp, endereço de e-mail principal, etc. NULL quando ainda
  -- não conectou (qr_pending, etc).
  identifier           TEXT,
  display_name         TEXT,
  -- JSON com config não-secreta (host IMAP, porta, default_account_id pra
  -- e-mail, etc). NUNCA secret aqui — sempre via secrets_ref.
  connection_metadata  JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- Ponteiro opaco pro secrets manager. Veja comentário no topo do arquivo.
  secrets_ref          TEXT,
  last_health_check    TIMESTAMPTZ,
  last_message_at      TIMESTAMPTZ,
  error_details        JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1 sessão por canal por tenant nesta Fase. Quando precisar suportar
-- múltiplas inboxes por canal, virar (tenant_id, channel, identifier).
CREATE UNIQUE INDEX idx_channel_sessions_tenant_channel
  ON public.channel_sessions(tenant_id, channel);

-- Index seletivo: queries de monitoria só leem sessões com problema. Sessões
-- conectadas (>90% em produção esperada) ficam fora do index — DML mais
-- barato e queries de saúde direcionadas.
CREATE INDEX idx_channel_sessions_status
  ON public.channel_sessions(status)
  WHERE status != 'connected';

CREATE TRIGGER trg_channel_sessions_updated_at
  BEFORE UPDATE ON public.channel_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.channel_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channel_sessions_select_current_tenant" ON public.channel_sessions
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "channel_sessions_insert_current_tenant" ON public.channel_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "channel_sessions_update_current_tenant" ON public.channel_sessions
  FOR UPDATE
  TO authenticated
  USING      (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "channel_sessions_delete_current_tenant" ON public.channel_sessions
  FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());
