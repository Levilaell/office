// =============================================================================
// Tool: getObligationsForAccount
//
// Retorna obrigações do account no período. Defaults úteis pro Especialista:
//   - próximos 60 dias (ou últimos 30 + próximos 60 pra cobrir "vencida há
//     pouco" e "vai vencer")
//   - status pending/overdue (paid não interessa pra resposta de status)
//   - ordenado por due_date ASC (mais próxima primeiro)
//
// Tool é read-only: nenhum side-effect no domínio, só audit_log.
// =============================================================================

import { appendAuditLog } from '../../audit/index';
import type { ToolClient, ToolContext, ObligationSnapshot } from './types';

export type GetObligationsOptions = {
  /** ISO date (YYYY-MM-DD). Default: hoje - 30 dias. */
  from?: string;
  /** ISO date (YYYY-MM-DD). Default: hoje + 60 dias. */
  to?: string;
  /** Lista de status. Default: ['pending', 'overdue']. */
  status?: string[];
  /** Filtro opcional por tipo (ex: 'das', 'inss'). */
  type?: string;
  /** Default 20. */
  limit?: number;
};

const formatIsoDate = (d: Date): string => d.toISOString().slice(0, 10);

const DEFAULT_STATUS = ['pending', 'overdue'] as const;

export const getObligationsForAccount = async (
  supabase: ToolClient,
  ctx: ToolContext,
  options: GetObligationsOptions = {},
): Promise<ObligationSnapshot[]> => {
  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 30);
  const toDate = new Date(today);
  toDate.setDate(toDate.getDate() + 60);

  const from = options.from ?? formatIsoDate(fromDate);
  const to = options.to ?? formatIsoDate(toDate);
  const statuses = options.status ?? [...DEFAULT_STATUS];
  const limit = options.limit ?? 20;

  let query = supabase
    .from('obligations')
    .select(
      'id, type, category, description, competencia, due_date, amount, amount_paid, status, payment_method, payment_link, notes',
    )
    .eq('tenant_id', ctx.tenantId)
    .eq('account_id', ctx.accountId)
    .gte('due_date', from)
    .lte('due_date', to)
    .in('status', statuses);
  if (options.type) {
    query = query.eq('type', options.type);
  }
  const { data, error } = await query
    .order('due_date', { ascending: true })
    .limit(limit);
  if (error) throw error;

  const snapshots: ObligationSnapshot[] = (data ?? []).map((row) => ({
    id: row.id as string,
    type: row.type as string,
    category: row.category as string,
    description: (row.description as string | null) ?? null,
    competencia: row.competencia as string,
    dueDate: row.due_date as string,
    amount: (row.amount as number | null) ?? null,
    amountPaid: (row.amount_paid as number | null) ?? null,
    status: row.status as string,
    paymentMethod: (row.payment_method as string | null) ?? null,
    paymentLink: (row.payment_link as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
  }));

  await appendAuditLog(supabase, {
    trace_id: ctx.traceId,
    tenant_id: ctx.tenantId,
    account_id: ctx.accountId,
    actor: ctx.actor,
    action: 'tool.read.obligations',
    resource: `account:${ctx.accountId}`,
    metadata: {
      count: snapshots.length,
      from,
      to,
      statuses,
      ...(options.type !== undefined && { filter_type: options.type }),
    },
  });

  return snapshots;
};
