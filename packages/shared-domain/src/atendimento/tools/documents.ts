// =============================================================================
// Tool: getDocumentsForAccount
//
// Retorna documentos do account com filtros opcionais. Especialista usa pra
// responder "recebi tua NF de outubro?", "preciso de tal doc?".
// =============================================================================

import { appendAuditLog } from '../../audit/index';
import type { ToolClient, ToolContext, DocumentSnapshot } from './types';

export type GetDocumentsOptions = {
  /** ISO date — default: hoje - 90 dias. */
  from?: string;
  /** ISO date — default: hoje. */
  to?: string;
  /** Default: nenhum filtro (todos status). */
  status?: string[];
  /** Filtro opcional por tipo (ex: 'nf_venda'). */
  type?: string;
  /** Filtro opcional por categoria (fiscal/contabil/etc). */
  category?: string;
  /** Default 20. */
  limit?: number;
};

const formatIsoDate = (d: Date): string => d.toISOString().slice(0, 10);

export const getDocumentsForAccount = async (
  supabase: ToolClient,
  ctx: ToolContext,
  options: GetDocumentsOptions = {},
): Promise<DocumentSnapshot[]> => {
  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 90);

  const from = options.from ?? formatIsoDate(fromDate);
  const to = options.to ?? formatIsoDate(today);
  const limit = options.limit ?? 20;

  // `reference_date` é null em alguns documentos (atemporais). Filtro de
  // intervalo precisa lidar com isso — usamos OR via duas queries seria
  // complexo; preferimos filtrar apenas docs COM reference_date no range.
  // Documentos sem reference_date aparecem só quando from/to não são
  // fornecidos explicitamente (caller passa { from: '1900-01-01' } se quer
  // tudo). Decisão pragmática Sprint 1.3.
  let query = supabase
    .from('documents')
    .select(
      'id, type, category, description, competencia, reference_date, status, received_at, processed_at, notes',
    )
    .eq('tenant_id', ctx.tenantId)
    .eq('account_id', ctx.accountId);
  if (options.status && options.status.length > 0) {
    query = query.in('status', options.status);
  }
  if (options.type) query = query.eq('type', options.type);
  if (options.category) query = query.eq('category', options.category);
  // Filtro de janela: only se caller explicitamente passou. Sem from/to,
  // listamos os 20 mais recentes por created_at sem filtrar período.
  if (options.from !== undefined || options.to !== undefined) {
    query = query.gte('reference_date', from).lte('reference_date', to);
  }
  const { data, error } = await query
    .order('reference_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const snapshots: DocumentSnapshot[] = (data ?? []).map((row) => ({
    id: row.id as string,
    type: row.type as string,
    category: row.category as string,
    description: (row.description as string | null) ?? null,
    competencia: (row.competencia as string | null) ?? null,
    referenceDate: (row.reference_date as string | null) ?? null,
    status: row.status as string,
    receivedAt: (row.received_at as string | null) ?? null,
    processedAt: (row.processed_at as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
  }));

  await appendAuditLog(supabase, {
    trace_id: ctx.traceId,
    tenant_id: ctx.tenantId,
    account_id: ctx.accountId,
    actor: ctx.actor,
    action: 'tool.read.documents',
    resource: `account:${ctx.accountId}`,
    metadata: {
      count: snapshots.length,
      ...(options.from !== undefined && { from }),
      ...(options.to !== undefined && { to }),
      ...(options.type !== undefined && { filter_type: options.type }),
      ...(options.category !== undefined && { filter_category: options.category }),
      ...(options.status !== undefined && { filter_status: options.status }),
    },
  });

  return snapshots;
};
