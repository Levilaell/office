import type { LlmCallOutput } from '@office/shared-llm';
import type {
  AuthenticatedClient,
  Json,
  ServiceRoleClient,
} from '@office/shared-db';

type AnyClient = AuthenticatedClient | ServiceRoleClient;

export interface LlmAuditContext {
  tenantId?: string | null;
  accountId?: string | null;
  actor: string;
  action: string;
  resource: string;
  promptVersion: string;
}

export const appendLlmAuditLog = async (
  supabase: AnyClient,
  output: LlmCallOutput,
  ctx: LlmAuditContext,
): Promise<void> => {
  const { error } = await supabase.from('audit_log').insert({
    trace_id: output.traceId,
    tenant_id: ctx.tenantId ?? null,
    account_id: ctx.accountId ?? null,
    actor: ctx.actor,
    action: ctx.action,
    resource: ctx.resource,
    prompt_version: ctx.promptVersion,
    model: output.modelId,
    cost_usd: output.costUsd,
    metadata: {
      usage: {
        input_tokens: output.usage.inputTokens,
        output_tokens: output.usage.outputTokens,
        cache_read_input_tokens: output.usage.cacheReadInputTokens,
        cache_creation_input_tokens: output.usage.cacheCreationInputTokens,
      },
      latency_ms: output.latencyMs,
      stop_reason: output.stopReason,
      span_id: output.spanId ?? null,
    } satisfies Json,
  });
  if (error) throw new Error(`appendLlmAuditLog failed: ${error.message}`);
};
