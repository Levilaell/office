-- =============================================================================
-- Sprint 1.0 alignment — add `conversations.intent_current`
--
-- ADR-016 prevê que o Coordenador de Atendimento (Sprint 1.2) escreve a
-- última classificação de intent na conversation, e que UI/handoffs leem
-- desse campo. Adicionar agora via migration aditiva mantém o schema
-- alinhado com o desenho documentado — Sprint 1.2 só vai consumir.
--
-- Sem índice por enquanto: queries futuras (filtrar inbox por intent,
-- agrupar por categoria, etc) vão definir o padrão de acesso. Adicionar
-- índice antes de saber é otimização prematura.
-- =============================================================================

ALTER TABLE public.conversations
  ADD COLUMN intent_current TEXT;

COMMENT ON COLUMN public.conversations.intent_current IS
  'Última classificação de intent feita pelo Coordenador. Slug hierárquico (ex: operacional.status_obrigacao, comercial.lead_novo). NULL = ainda não classificado ou não-aplicável (conversa interna, system).';
