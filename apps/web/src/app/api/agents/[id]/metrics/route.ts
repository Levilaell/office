import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentAuthContext } from '@/lib/auth';
import { getSupabaseForCurrentUser } from '@/lib/supabase';
import type { AgentMetricsSnapshot, AgentMetricsWindow } from '@/lib/realtime-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ParamsSchema = z.object({ id: z.string().uuid() });
const QuerySchema = z.object({
  window: z.enum(['24h', '7d', '30d']).default('7d'),
});

const WINDOW_MS: Record<AgentMetricsWindow, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

const EMPTY: AgentMetricsSnapshot = {
  totalRuns: 0,
  completed: 0,
  failed: 0,
  timedOut: 0,
  successRate: 0,
  avgDurationMs: null,
  totalTokens: 0,
  totalCostUsd: 0,
  avgCostUsd: 0,
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
    window: req.nextUrl.searchParams.get('window') ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: 'invalid query', issues: parsedQuery.error.flatten() },
      { status: 400 },
    );
  }

  const { window } = parsedQuery.data;
  const since = new Date(Date.now() - WINDOW_MS[window]).toISOString();

  const supabase = await getSupabaseForCurrentUser();
  const { data, error } = await supabase
    .from('agent_runs')
    .select('status, started_at, completed_at, tokens_used, cost_usd')
    .eq('agent_id', parsedParams.data.id)
    .gte('started_at', since);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ window, metrics: EMPTY });
  }

  let completed = 0;
  let failed = 0;
  let timedOut = 0;
  let totalTokens = 0;
  let totalCostUsd = 0;
  let durationSum = 0;
  let durationCount = 0;

  for (const row of rows) {
    if (row.status === 'completed') completed += 1;
    else if (row.status === 'failed') failed += 1;
    else if (row.status === 'timeout') timedOut += 1;

    totalTokens += row.tokens_used ?? 0;
    totalCostUsd += Number(row.cost_usd ?? 0);

    if (row.status === 'completed' && row.completed_at) {
      const startMs = new Date(row.started_at).getTime();
      const endMs = new Date(row.completed_at).getTime();
      if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs) {
        durationSum += endMs - startMs;
        durationCount += 1;
      }
    }
  }

  const totalRuns = rows.length;
  const metrics: AgentMetricsSnapshot = {
    totalRuns,
    completed,
    failed,
    timedOut,
    successRate: totalRuns > 0 ? completed / totalRuns : 0,
    avgDurationMs: durationCount > 0 ? durationSum / durationCount : null,
    totalTokens,
    totalCostUsd,
    avgCostUsd: totalRuns > 0 ? totalCostUsd / totalRuns : 0,
  };

  return NextResponse.json({ window, metrics });
}
