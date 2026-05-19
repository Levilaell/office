-- =============================================================================
-- Sprint 1.5 — message_drafts.decision_metadata
--
-- Coluna nova pra registrar metadados estruturados de decisão do operador:
--   - approve: vazio ou { justification?: string }
--   - edit:    salvamos o diff aqui ({ original, edited, char_distance })
--              em vez de poluir edit_diff (que vira semanticamente "diff" só)
--   - reject:  { reason?: string }
--   - expired: { expired_at, expiration_minutes }
--   - auto_approved (Sprint 1.3 legacy): metadata do agente
--
-- ADR-017 + Sprint 1.5: operador edita = draft.status='edited' com diff em
-- edit_diff (campo já existente) E justification opcional em decision_metadata.
-- Mantemos edit_diff pra retrocompat (Sprint 1.3 grava metadata sintética lá).
-- =============================================================================

ALTER TABLE public.message_drafts
  ADD COLUMN decision_metadata JSONB;

COMMENT ON COLUMN public.message_drafts.decision_metadata IS
  'Metadados estruturados da decisão do operador. Forma depende do status: edit→{original,edited,char_distance,justification?}, reject→{reason?}, expired→{expired_at,expiration_minutes}, auto_approved→agente metadata.';
