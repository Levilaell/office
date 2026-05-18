export {
  ATENDIMENTO_INTENTS,
  ATENDIMENTO_INTENT_SLUGS,
  getIntentDefinition,
  isKnownIntent,
  type AtendimentoIntentDefinition,
  type AtendimentoIntentSlug,
  type IntentDecision,
} from './intents';

export {
  ATENDIMENTO_TEMPLATES,
  getTemplateById,
  renderTemplate,
  type AtendimentoTemplateId,
  type MessageTemplate,
  type TemplateVariables,
  type TemplateValidationResult,
  type RenderResult,
} from './templates/index';

export {
  resolveDisplaySettings,
  loadDisplaySettings,
  type DisplaySettings,
  type BusinessHours,
} from './display-settings';

export {
  createDraft,
  getDraftById,
  listPendingDrafts,
  approveDraft,
  markDraftAutoApproved,
  type MessageDraftRow,
  type MessageDraftInsert,
  type MessageDraftUpdate,
  type MessageDraftStatus,
  type MessageDraftContentType,
  type CreateDraftInput,
  type ListPendingDraftsFilters,
  type ApproveDraftResult,
} from './drafts';

export {
  getAccountSnapshot,
  getObligationsForAccount,
  getDocumentsForAccount,
  getRecentInteractionsForAccount,
  type GetAccountSnapshotResult,
  type GetObligationsOptions,
  type GetDocumentsOptions,
  type GetRecentInteractionsOptions,
  type ToolClient,
  type ToolContext,
  type AccountSnapshot,
  type EntitySnapshot,
  type ObligationSnapshot,
  type DocumentSnapshot,
  type InteractionSnapshot,
} from './tools/index';
