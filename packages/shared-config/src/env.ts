import { z } from 'zod';
import { DEFAULT_TIER_TO_MODEL, type AgentTier, type LlmModelId } from './constants.js';

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LLM_MODEL_TRIAGE: z.string().min(1).optional(),
  LLM_MODEL_DEFAULT: z.string().min(1).optional(),
  LLM_MODEL_CRITICAL: z.string().min(1).optional(),
  ENABLE_DEMO_MODE: z.string().optional(),
});

/**
 * Sprint 1.6 — gate único pro modo demo. Habilitado quando:
 *  - dev (NODE_ENV !== 'production') por default; OU
 *  - prod com `ENABLE_DEMO_MODE=true` explicitamente.
 *
 * Toda rota e endpoint de demo passa por esse helper. Em prod sem flag,
 * retorna false → rotas de demo respondem 404 (não vazam existência).
 */
export const isDemoModeEnabled = (
  raw: NodeJS.ProcessEnv = process.env,
): boolean => {
  if (raw.ENABLE_DEMO_MODE === 'true') return true;
  if (raw.NODE_ENV !== 'production') return true;
  return false;
};

export type BaseEnv = z.infer<typeof baseEnvSchema>;

export const parseBaseEnv = (raw: NodeJS.ProcessEnv = process.env): BaseEnv =>
  baseEnvSchema.parse(raw);

const redisEnvSchema = baseEnvSchema.extend({
  REDIS_URL: z.string().min(1),
});

export type RedisEnv = z.infer<typeof redisEnvSchema>;

export const parseRedisEnv = (raw: NodeJS.ProcessEnv = process.env): RedisEnv =>
  redisEnvSchema.parse(raw);

const supabaseEnvSchema = baseEnvSchema.extend({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CLERK_DOMAIN: z.string().min(1),
  CLERK_WEBHOOK_SECRET: z.string().min(1),
});

export type SupabaseEnv = z.infer<typeof supabaseEnvSchema>;

export const parseSupabaseEnv = (raw: NodeJS.ProcessEnv = process.env): SupabaseEnv =>
  supabaseEnvSchema.parse(raw);

const webEnvSchema = supabaseEnvSchema.extend({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().min(1).default('/sign-in'),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().min(1).default('/sign-up'),
  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: z.string().min(1).default('/dashboard'),
  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: z.string().min(1).default('/onboarding'),
  NEXT_PUBLIC_AGENT_RUNTIME_URL: z.string().url().default('http://localhost:3001'),
  INTERNAL_SERVICE_TOKEN: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1).optional(),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export const parseWebEnv = (raw: NodeJS.ProcessEnv = process.env): WebEnv =>
  webEnvSchema.parse(raw);

const llmEnvSchema = baseEnvSchema.extend({
  ANTHROPIC_API_KEY: z.string().min(1),
  LANGFUSE_PUBLIC_KEY: z.string().min(1),
  LANGFUSE_SECRET_KEY: z.string().min(1),
  LANGFUSE_HOST: z.string().url().default('https://cloud.langfuse.com'),
  LLM_DEFAULT_BUDGET_MAX_TOKENS: z.coerce.number().int().positive().default(4000),
  LLM_DEFAULT_BUDGET_MAX_COST_USD: z.coerce.number().positive().default(0.1),
});

export type LlmEnv = z.infer<typeof llmEnvSchema>;

export const parseLlmEnv = (raw: NodeJS.ProcessEnv = process.env): LlmEnv =>
  llmEnvSchema.parse(raw);

const agentRuntimeEnvSchema = llmEnvSchema.extend({
  REDIS_URL: z.string().min(1),
  BULLMQ_CONCURRENCY: z.coerce.number().int().positive().default(5),
  INTERNAL_SERVICE_TOKEN: z.string().min(1),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  CLERK_DOMAIN: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type AgentRuntimeEnv = z.infer<typeof agentRuntimeEnvSchema>;

export const parseAgentRuntimeEnv = (
  raw: NodeJS.ProcessEnv = process.env,
): AgentRuntimeEnv => agentRuntimeEnvSchema.parse(raw);

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
