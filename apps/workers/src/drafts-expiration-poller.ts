// =============================================================================
// Drafts Expiration Poller — Sprint 1.5
//
// A cada N segundos varre `message_drafts` com `status='pending'` e
// `expires_at < now()`. Pra cada draft:
//   1. UPDATE atômico via expireDraft (guard `status='pending'`)
//   2. Publica `draft.expired` no canal tenant:<id>
//   3. Grava audit_log `draft.expired`
//   4. Atualiza conversation.metadata.last_draft_expired_at (informativo)
//
// Cliente final NÃO recebe nada. ADR-017 sugere expiração silenciosa pra
// evitar cascata de "vou verificar e volto" automáticas; operador vê na UI
// que draft expirou.
//
// Standalone Node ESM, service role (sem RLS).
// =============================================================================

import {
  appendAuditLog,
  expireDraft,
  getDraftExpirationMinutes,
  listExpiredPendingDrafts,
  patchConversationMetadata,
  type Json,
  type MessageDraftRow,
  type ServiceRoleClient,
} from '@office/shared-domain';
import { publishEvent, type DraftExpiredPayload } from '@office/shared-events';

const log = (msg: string): void => console.log(`[drafts-expiration] ${msg}`);

export type DraftsExpirationConfig = {
  supabase: ServiceRoleClient;
  intervalMs: number;
  /** Limite de drafts processados por tick. Evita lentidão se acumular. */
  batchLimit?: number;
};

export type ExpirationResult = {
  draftId: string;
  status: 'expired' | 'race_skipped' | 'error';
  error?: string;
};

// Cache leve de expirationMinutes por tenant pra não bater toda hora no banco.
// TTL curto (60s): mudança de config aparece na próxima poll.
const TENANT_CONFIG_TTL_MS = 60_000;

class TenantConfigCache {
  private cache = new Map<string, { value: number; expiresAt: number }>();

  async get(
    supabase: ServiceRoleClient,
    tenantId: string,
  ): Promise<number> {
    const cached = this.cache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const value = await getDraftExpirationMinutes(supabase, tenantId);
    this.cache.set(tenantId, {
      value,
      expiresAt: Date.now() + TENANT_CONFIG_TTL_MS,
    });
    return value;
  }

  clear(): void {
    this.cache.clear();
  }
}

const processOneDraft = async (
  supabase: ServiceRoleClient,
  draft: MessageDraftRow,
  tenantConfig: TenantConfigCache,
): Promise<ExpirationResult> => {
  const traceId = `drafts-expiration:${draft.id}`;

  let expirationMinutes = 15;
  try {
    expirationMinutes = await tenantConfig.get(supabase, draft.tenant_id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`config lookup falhou tenant=${draft.tenant_id} err=${message}; usando default 15`);
  }

  const result = await expireDraft(supabase, draft.id, { expirationMinutes });
  if (!result.ok) {
    // Race com decisão humana — outro caller já mudou status. Skip silencioso.
    return { draftId: draft.id, status: 'race_skipped' };
  }

  // Publica evento. Falha aqui NÃO desfaz expiração — banco já é fonte da
  // verdade; UI vai reconciliar no próximo refresh.
  try {
    const payload: DraftExpiredPayload = {
      tenantId: draft.tenant_id,
      draftId: draft.id,
      conversationId: draft.conversation_id,
      agentId: draft.agent_id,
      expirationMinutes,
      traceId,
    };
    await publishEvent(
      'draft.expired',
      `tenant:${draft.tenant_id}`,
      payload,
      traceId,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`publish draft.expired falhou draft=${draft.id} err=${message}`);
  }

  // Atualiza metadata da conversation (informativo pra UI mostrar contexto).
  try {
    await patchConversationMetadata(supabase, {
      conversationId: draft.conversation_id,
      metadataPatch: {
        last_draft_expired_at: new Date().toISOString(),
        last_draft_expired_id: draft.id,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`patch conversation falhou conv=${draft.conversation_id} err=${message}`);
  }

  // Audit log.
  try {
    await appendAuditLog(supabase, {
      trace_id: traceId,
      tenant_id: draft.tenant_id,
      account_id: null,
      actor: 'system:drafts-expiration-poller',
      action: 'draft.expired',
      resource: `message_draft:${draft.id}`,
      before: draft as unknown as Json,
      after: result.draft as unknown as Json,
      metadata: {
        agent_id: draft.agent_id,
        conversation_id: draft.conversation_id,
        original_proposal: draft.proposed_content,
        expiration_minutes: expirationMinutes,
      } as Json,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`audit_log falhou draft=${draft.id} err=${message}`);
  }

  return { draftId: draft.id, status: 'expired' };
};

export const pollExpiredDrafts = async (
  supabase: ServiceRoleClient,
  config?: { batchLimit?: number; tenantConfig?: TenantConfigCache },
): Promise<ExpirationResult[]> => {
  const batchLimit = config?.batchLimit ?? 100;
  const tenantConfig = config?.tenantConfig ?? new TenantConfigCache();

  const expired = await listExpiredPendingDrafts(supabase, batchLimit);
  if (expired.length === 0) return [];

  log(`processing ${expired.length} expired draft(s)`);

  const results: ExpirationResult[] = [];
  for (const draft of expired) {
    try {
      const result = await processOneDraft(supabase, draft, tenantConfig);
      results.push(result);
      log(`draft=${draft.id} → ${result.status}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(`draft=${draft.id} unhandled error: ${message}`);
      results.push({ draftId: draft.id, status: 'error', error: message });
    }
  }
  return results;
};

// -----------------------------------------------------------------------------
// startExpirationLoop — agenda polls recorrentes. Mesma estratégia do IMAP
// poller: sem overlap entre ticks (next só dispara após o anterior).
// -----------------------------------------------------------------------------
export type ExpirationLoopHandle = {
  stop: () => Promise<void>;
};

export const startExpirationLoop = (
  config: DraftsExpirationConfig,
): ExpirationLoopHandle => {
  const tenantConfig = new TenantConfigCache();
  let stopped = false;
  let inFlight: Promise<unknown> | null = null;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    inFlight = pollExpiredDrafts(config.supabase, {
      ...(config.batchLimit !== undefined && { batchLimit: config.batchLimit }),
      tenantConfig,
    }).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      log(`tick failed: ${message}`);
    });
    await inFlight;
    inFlight = null;
    if (stopped) return;
    timeoutHandle = setTimeout(() => void tick(), config.intervalMs);
  };

  let timeoutHandle: NodeJS.Timeout = setTimeout(() => void tick(), 0);

  return {
    stop: async (): Promise<void> => {
      stopped = true;
      clearTimeout(timeoutHandle);
      tenantConfig.clear();
      if (inFlight) await inFlight.catch(() => undefined);
    },
  };
};
