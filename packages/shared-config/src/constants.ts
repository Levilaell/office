export const PORTS = {
  web: 3000,
  agentRuntime: 3001,
  workers: 3002,
} as const;

export const DEFAULTS = {
  agentMaxTurns: 10,
  agentTimeoutMs: 5 * 60 * 1000,
  budgetUsdPerRun: 0.5,
  loopDetectionThreshold: 3,
} as const;

export const AUDIT_RETENTION_YEARS = 5;

export type AgentTier = 'triage' | 'default' | 'critical';

export type LlmModelId = string & { readonly __brand: 'LlmModelId' };

export const DEFAULT_TIER_TO_MODEL: Record<AgentTier, LlmModelId> = {
  triage: 'claude-haiku-4-5-20251001' as LlmModelId,
  default: 'claude-sonnet-4-6' as LlmModelId,
  critical: 'claude-opus-4-7' as LlmModelId,
};
