import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentAuthContext } from '@/lib/auth';
import { getTenantByClerkOrgId } from '@office/shared-domain';
import { enqueueTriagem } from '@/lib/triagem';
import { getServiceRoleSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  text: z.string().min(1).max(4000),
  accountId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await getCurrentAuthContext();
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid body', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = getServiceRoleSupabase();
  const tenant = await getTenantByClerkOrgId(supabase, auth.orgId);
  if (!tenant) {
    return NextResponse.json({ error: 'tenant not found' }, { status: 404 });
  }

  try {
    const result = await enqueueTriagem({
      tenantId: tenant.id,
      userId: auth.userId,
      text: parsed.data.text,
      ...(parsed.data.accountId && { accountId: parsed.data.accountId }),
    });
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
