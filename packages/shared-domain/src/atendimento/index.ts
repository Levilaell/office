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
