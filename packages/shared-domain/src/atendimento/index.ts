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

// Sprint 1.4 — Especialista Comercial (qualificação de leads)
export {
  // repositório
  computeNextStatus,
  createLead,
  getLeadById,
  getLeadByConversationId,
  listLeadsByTenant,
  markLeadDropped,
  markLeadLost,
  markLeadQualified,
  markLeadScheduledPending,
  updateLeadQualificationData,
  type CreateLeadInput,
  type LeadInsert,
  type LeadRow,
  type LeadSource,
  type LeadStatus,
  type LeadUpdate,
  type ListLeadsFilters,
  type MarkLeadResult,
  type UpdateLeadQualificationResult,
  // slots
  CORE_SLOTS,
  SLOT_ORDER,
  SLOT_QUESTIONS,
  getMissingSlots,
  getNextSuggestedSlot,
  getRequiredSlots,
  isQualified,
  renderSlotQuestion,
  type CompanySizeEstimate,
  type CurrentRegime,
  type DecisionTimeline,
  type LeadSlots,
} from './leads/index';
