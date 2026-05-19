import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentAuthContext } from '@/lib/auth';
import { getSupabaseForCurrentUser } from '@/lib/supabase';
import { toDraftSnapshot } from '@/lib/realtime-mappers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DraftStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'edited',
  'expired',
  'auto_approved',
]);

const QuerySchema = z.object({
  status: DraftStatusSchema.default('pending'),
  conversationId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export async function GET(req: NextRequest) {
  const auth = await getCurrentAuthContext();
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = QuerySchema.safeParse({
    status: req.nextUrl.searchParams.get('status') ?? undefined,
    conversationId:
      req.nextUrl.searchParams.get('conversationId') ?? undefined,
    agentId: req.nextUrl.searchParams.get('agentId') ?? undefined,
    limit: req.nextUrl.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid query', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = await getSupabaseForCurrentUser();
  let query = supabase
    .from('message_drafts')
    .select('*')
    .eq('status', parsed.data.status);

  if (parsed.data.conversationId) {
    query = query.eq('conversation_id', parsed.data.conversationId);
  }
  if (parsed.data.agentId) {
    query = query.eq('agent_id', parsed.data.agentId);
  }

  const { data, error } = await query
    .order('expires_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(parsed.data.limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    drafts: (data ?? []).map(toDraftSnapshot),
  });
}
