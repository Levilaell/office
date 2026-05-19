import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { getCurrentAuthContext } from '@/lib/auth';
import { loadConversationDetail } from '@/lib/conversation-detail';
import { getSupabaseForCurrentUser } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ParamsSchema = z.object({ id: z.string().uuid() });

// Sprint 1.6 — endpoint dedicado pra refetch da página de detalhe de
// conversa. Client component chama em `message.received` filtered por
// conversationId. RLS aplica isolamento por tenant via JWT.
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await getCurrentAuthContext();
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const params = await context.params;
  const parsedParams = ParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  const supabase = await getSupabaseForCurrentUser();
  const detail = await loadConversationDetail(supabase, parsedParams.data.id);
  if (!detail) {
    return NextResponse.json({ error: 'conversation not found' }, { status: 404 });
  }
  return NextResponse.json(detail);
}
