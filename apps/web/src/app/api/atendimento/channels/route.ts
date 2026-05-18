import { NextResponse } from 'next/server';
import { getCurrentAuthContext } from '@/lib/auth';
import { getSupabaseForCurrentUser } from '@/lib/supabase';
import { toChannelSessionSnapshot } from '@/lib/realtime-mappers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const auth = await getCurrentAuthContext();
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // RLS filtra por tenant via JWT do Clerk.
  const supabase = await getSupabaseForCurrentUser();
  const { data, error } = await supabase
    .from('channel_sessions')
    .select('*')
    .order('channel', { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    channelSessions: (data ?? []).map(toChannelSessionSnapshot),
  });
}
