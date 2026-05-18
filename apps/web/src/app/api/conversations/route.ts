import { NextResponse, type NextRequest } from 'next/server';
import { isConversationStatus } from '@office/shared-types';
import { getCurrentAuthContext } from '@/lib/auth';
import { getSupabaseForCurrentUser } from '@/lib/supabase';
import { toConversationSnapshot } from '@/lib/realtime-mappers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LIMIT = 100;

export async function GET(req: NextRequest) {
  const auth = await getCurrentAuthContext();
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const statusParam = url.searchParams.get('status') ?? 'open';
  if (!isConversationStatus(statusParam)) {
    return NextResponse.json(
      { error: 'invalid status', allowed: ['open', 'waiting_client', 'resolved', 'archived'] },
      { status: 400 },
    );
  }

  // RLS filtra por tenant_id automaticamente via JWT do Clerk.
  const supabase = await getSupabaseForCurrentUser();
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('status', statusParam)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(LIMIT);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    conversations: (data ?? []).map(toConversationSnapshot),
  });
}
