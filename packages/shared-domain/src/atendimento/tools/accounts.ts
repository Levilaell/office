// =============================================================================
// Tool: getAccountSnapshot
//
// Lê dados de identificação do account + suas entities (matriz/filial). É a
// primeira coisa que o Especialista Operacional carrega — define quem é o
// cliente que está perguntando.
// =============================================================================

import { appendAuditLog } from '../../audit/index';
import type { ToolClient, ToolContext, AccountSnapshot, EntitySnapshot } from './types';

export type GetAccountSnapshotResult =
  | { ok: true; snapshot: AccountSnapshot }
  | { ok: false; reason: 'not_found' | 'tenant_mismatch' };

export const getAccountSnapshot = async (
  supabase: ToolClient,
  ctx: ToolContext,
): Promise<GetAccountSnapshotResult> => {
  const { data: account, error: accErr } = await supabase
    .from('accounts')
    .select('id, tenant_id, cnpj, razao_social, nome_fantasia, regime_tributario, status')
    .eq('id', ctx.accountId)
    .maybeSingle();
  if (accErr) throw accErr;
  if (!account) return { ok: false, reason: 'not_found' };
  if (account.tenant_id !== ctx.tenantId) {
    return { ok: false, reason: 'tenant_mismatch' };
  }

  const { data: entities, error: entErr } = await supabase
    .from('entities')
    .select('id, type, inscricao_estadual, inscricao_municipal')
    .eq('account_id', ctx.accountId);
  if (entErr) throw entErr;

  const entitiesSnapshot: EntitySnapshot[] = (entities ?? []).map((e) => ({
    id: e.id as string,
    type: e.type as string,
    inscricaoEstadual: (e.inscricao_estadual as string | null) ?? null,
    inscricaoMunicipal: (e.inscricao_municipal as string | null) ?? null,
  }));

  await appendAuditLog(supabase, {
    trace_id: ctx.traceId,
    tenant_id: ctx.tenantId,
    account_id: ctx.accountId,
    actor: ctx.actor,
    action: 'tool.read.account_snapshot',
    resource: `account:${ctx.accountId}`,
    metadata: {
      entities_count: entitiesSnapshot.length,
    },
  });

  return {
    ok: true,
    snapshot: {
      id: account.id as string,
      tenantId: account.tenant_id as string,
      cnpj: account.cnpj as string,
      razaoSocial: account.razao_social as string,
      nomeFantasia: (account.nome_fantasia as string | null) ?? null,
      regimeTributario: (account.regime_tributario as string | null) ?? null,
      status: account.status as string,
      entities: entitiesSnapshot,
    },
  };
};
