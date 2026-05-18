import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentAuthContext } from '@/lib/auth';
import { getSupabaseForCurrentUser } from '@/lib/supabase';
import { toLeadSnapshot } from '@/lib/realtime-mappers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LIMIT = 200;

const ALLOWED_STATUSES = [
  'new',
  'qualifying',
  'qualified',
  'scheduled_pending',
  'converted',
  'lost',
  'dropped',
] as const;

const isAllowedStatus = (s: string): s is (typeof ALLOWED_STATUSES)[number] =>
  (ALLOWED_STATUSES as ReadonlyArray<string>).includes(s);

export async function GET(req: NextRequest) {
  const auth = await getCurrentAuthContext();
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const statusParam = url.searchParams.get('status');

  // RLS filtra por tenant via JWT do Clerk.
  const supabase = await getSupabaseForCurrentUser();
  let query = supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(LIMIT);

  if (statusParam) {
    // Multi-status via vírgula: ?status=new,qualifying
    const statuses = statusParam.split(',').map((s) => s.trim()).filter(Boolean);
    const invalid = statuses.filter((s) => !isAllowedStatus(s));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: 'invalid status', invalid, allowed: ALLOWED_STATUSES },
        { status: 400 },
      );
    }
    if (statuses.length === 1) {
      query = query.eq('status', statuses[0]!);
    } else {
      query = query.in('status', statuses);
    }
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    leads: (data ?? []).map(toLeadSnapshot),
  });
}
