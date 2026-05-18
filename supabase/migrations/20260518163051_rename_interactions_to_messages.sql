-- =============================================================================
-- Sprint 1.0 alignment — rename `interactions` → `messages`
--
-- Os ADRs 014-017 (consolidados após a migration original
-- 20260515103000_atendimento_foundations.sql) usam o termo "messages" como
-- conceito canônico — `messages` numa `conversation`, `message_drafts` em
-- chat sugestivo. Manter `interactions` introduziria divergência nominal
-- entre código e ADRs. Mais barato renomear agora (nenhum agente lê ainda)
-- do que viver com a dívida.
--
-- Migração aditiva: ALTER TABLE ... RENAME. Postgres NÃO renomeia
-- automaticamente PK/FK/CHECK constraints nem índices explícitos depois do
-- rename — só atualiza referências em policies. Renomeamos tudo
-- manualmente pra evitar nomes "interactions_*" fantasmas grudados em
-- tabela chamada messages.
-- =============================================================================

ALTER TABLE public.interactions RENAME TO messages;

-- Constraints auto-nomeadas pelo Postgres (`<table>_<column>_fkey`,
-- `<table>_pkey`, `<table>_<column>_check`). RENAME TABLE não atualiza.
ALTER TABLE public.messages RENAME CONSTRAINT interactions_pkey                 TO messages_pkey;
ALTER TABLE public.messages RENAME CONSTRAINT interactions_tenant_id_fkey      TO messages_tenant_id_fkey;
ALTER TABLE public.messages RENAME CONSTRAINT interactions_account_id_fkey     TO messages_account_id_fkey;
ALTER TABLE public.messages RENAME CONSTRAINT interactions_conversation_id_fkey TO messages_conversation_id_fkey;
ALTER TABLE public.messages RENAME CONSTRAINT interactions_direction_check     TO messages_direction_check;
ALTER TABLE public.messages RENAME CONSTRAINT interactions_sender_type_check   TO messages_sender_type_check;

-- Índices explícitos (nomes criados via CREATE INDEX ... na migration original).
ALTER INDEX public.idx_interactions_conversation   RENAME TO idx_messages_conversation;
ALTER INDEX public.idx_interactions_tenant_created RENAME TO idx_messages_tenant_created;

-- Policies RLS: o RENAME TABLE preserva o owner_relation_id da policy,
-- então elas continuam funcionando com o nome antigo apontando pra messages.
-- Mesmo assim renomeamos pra não confundir grep/audit futuros.
ALTER POLICY "interactions_select_current_tenant" ON public.messages RENAME TO "messages_select_current_tenant";
ALTER POLICY "interactions_insert_current_tenant" ON public.messages RENAME TO "messages_insert_current_tenant";
ALTER POLICY "interactions_update_current_tenant" ON public.messages RENAME TO "messages_update_current_tenant";
ALTER POLICY "interactions_delete_current_tenant" ON public.messages RENAME TO "messages_delete_current_tenant";
