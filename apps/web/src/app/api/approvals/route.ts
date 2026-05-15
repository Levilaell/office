import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { APPROVAL_STATUSES } from '@office/shared-types';
import { getCurrentAuthContext } from '@/lib/auth';
import { getSupabaseForCurrentUser } from '@/lib/supabase';
import { toApprovalSnapshot } from '@/lib/realtime-mappers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const QuerySchema = z.object({
  status: z.enum(APPROVAL_STATUSES).default('pending'),
});

export async function GET(req: NextRequest) {
  const auth = await getCurrentAuthContext();
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = QuerySchema.safeParse({
    status: req.nextUrl.searchParams.get('status') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid query', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = await getSupabaseForCurrentUser();
  const { data, error } = await supabase
    .from('approvals')
    .select('*')
    .eq('status', parsed.data.status)
    .order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ approvals: (data ?? []).map(toApprovalSnapshot) });
}
