import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentAuthContext } from '@/lib/auth';
import { getSupabaseForCurrentUser } from '@/lib/supabase';
import { getTaskById } from '@office/shared-domain';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ParamsSchema = z.object({
  taskId: z.string().uuid(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ taskId: string }> },
) {
  const auth = await getCurrentAuthContext();
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const params = await context.params;
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid taskId' }, { status: 400 });
  }

  // RLS filtra por tenant_id = current_tenant_id() automaticamente — não
  // precisa adicionar where extra.
  const supabase = await getSupabaseForCurrentUser();
  const task = await getTaskById(supabase, parsed.data.taskId);
  if (!task) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: task.id,
    status: task.status,
    result: task.result,
    traceId: task.trace_id,
    createdAt: task.created_at,
    completedAt: task.completed_at,
  });
}
