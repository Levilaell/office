import { z } from 'zod';
import { DEFAULT_TIER_TO_MODEL, type AgentTier, type LlmModelId } from './constants.js';

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LLM_MODEL_TRIAGE: z.string().min(1).optional(),
  LLM_MODEL_DEFAULT: z.string().min(1).optional(),
  LLM_MODEL_CRITICAL: z.string().min(1).optional(),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;

export const parseBaseEnv = (raw: NodeJS.ProcessEnv = process.env): BaseEnv =>
  baseEnvSchema.parse(raw);

const TIER_ENV_KEY: Record<AgentTier, keyof BaseEnv> = {
  triage: 'LLM_MODEL_TRIAGE',
  default: 'LLM_MODEL_DEFAULT',
  critical: 'LLM_MODEL_CRITICAL',
};

export const resolveModelForTier = (
  tier: AgentTier,
  env: BaseEnv = parseBaseEnv(),
): LlmModelId => {
  const override = env[TIER_ENV_KEY[tier]];
  return override ? (override as LlmModelId) : DEFAULT_TIER_TO_MODEL[tier];
};
