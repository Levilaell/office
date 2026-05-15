import type Anthropic from '@anthropic-ai/sdk';
import type { AgentTier, LlmModelId } from '@office/shared-config';

export type LlmMessage = Anthropic.MessageParam;

export interface LlmCallBudget {
  maxTokens?: number;
  maxCostUsd?: number;
}

export interface LlmCallMetadata {
  traceId?: string;
  tenantId?: string;
  accountId?: string;
  agentId?: string;
  promptVersion?: string;
}

export interface LlmCallInput {
  tier: AgentTier;
  messages: LlmMessage[];
  system?: string;
  maxTokens?: number;
  temperature?: number;
  budget?: LlmCallBudget;
  metadata?: LlmCallMetadata;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

export type LlmStopReason = NonNullable<Anthropic.Message['stop_reason']>;

export interface LlmCallOutput {
  text: string;
  modelId: LlmModelId;
  usage: LlmUsage;
  costUsd: number;
  latencyMs: number;
  stopReason: LlmStopReason | null;
  traceId: string;
  spanId?: string;
}
