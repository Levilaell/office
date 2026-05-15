import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import type { AgentRun } from '@office/shared-domain';
import { isRunStatus } from '@office/shared-types';
import { getCurrentAuthContext } from '@/lib/auth';
import { getSupabaseForCurrentUser } from '@/lib/supabase';
import type { AgentRunSnapshot } from '@/lib/realtime-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ParamsSchema = z.object({ id: z.string().uuid() });

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
  status: z.enum(['all', 'completed', 'failed', 'running']).default('all'),
});

const toRunSnapshot = (row: AgentRun): AgentRunSnapshot => {
  if (!isRunStatus(row.status)) {
    throw new Error(`invalid status in agent_run ${row.id}: ${row.status}`);
  }
  const startedMs = new Date(row.started_at).getTime();
  const finishedMs = row.completed_at ? new Date(row.completed_at).getTime() : null;
  const durationMs =
    finishedMs !== null && Number.isFinite(startedMs) && Number.isFinite(finishedMs)
      ? finishedMs - startedMs
      : null;
  return {
    id: row.id,
    agentId: row.agent_id,
    taskId: row.task_id,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.completed_at,
    durationMs,
    turnsUsed: row.turns,
    tokensUsed: row.tokens_used,
    costUsd: Number(row.cost_usd),
    errorMessage: row.error_message,
    traceId: row.trace_id,
  };
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await getCurrentAuthContext();
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const params = await context.params;
  const parsedParams = ParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  const parsedQuery = QuerySchema.safeParse({
    limit: req.nextUrl.searchParams.get('limit') ?? undefined,
    cursor: req.nextUrl.searchParams.get('cursor') ?? undefined,
    status: req.nextUrl.searchParams.get('status') ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: 'invalid query', issues: parsedQuery.error.flatten() },
      { status: 400 },
    );
  }

  const { limit, cursor, status } = parsedQuery.data;
  const supabase = await getSupabaseForCurrentUser();

  let query = supabase
    .from('agent_runs')
    .select('*')
    .eq('agent_id', parsedParams.data.id)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  if (cursor) {
    // Keyset paginação: busca o started_at do cursor pra continuar.
    // Cursor não encontrado (não existe, ou RLS escondeu) → 400 explícito;
    // fallback silencioso pro início confunde o "carregar mais" no cliente.
    const { data: cursorRow, error: cursorError } = await supabase
      .from('agent_runs')
      .select('started_at')
      .eq('id', cursor)
      .maybeSingle();
    if (cursorError) {
      return NextResponse.json({ error: cursorError.message }, { status: 500 });
    }
    if (!cursorRow) {
      return NextResponse.json({ error: 'invalid cursor' }, { status: 400 });
    }
    query = query.lt('started_at', cursorRow.started_at);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const runs = rows.map(toRunSnapshot);
  const nextCursor = rows.length === limit ? (rows[rows.length - 1]?.id ?? null) : null;

  return NextResponse.json({ runs, nextCursor });
}
