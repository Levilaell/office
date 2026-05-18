import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  appendInteraction,
  getTenantByClerkOrgId,
  upsertConversation,
} from '@office/shared-domain';
import { publishEvent } from '@office/shared-events';
import { getCurrentAuthContext } from '@/lib/auth';
import { getServiceRoleSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Webhook simulado. Em Sprint 1.3 entram canais reais (email/WhatsApp) sem
// auth, validados por signature HMAC. Aqui, autenticado via Clerk — operador
// dispara manualmente pra testar o fluxo end-to-end.
const BodySchema = z.object({
  accountId: z.string().uuid(),
  channelHandle: z.string().min(1).max(200),
  subject: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(5000),
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

  const traceId = crypto.randomUUID();

  try {
    const conversation = await upsertConversation(supabase, {
      tenantId: tenant.id,
      accountId: parsed.data.accountId,
      channel: 'simulated_webhook',
      channelHandle: parsed.data.channelHandle,
      ...(parsed.data.subject && { subject: parsed.data.subject }),
    });

    const interaction = await appendInteraction(supabase, {
      tenantId: tenant.id,
      conversationId: conversation.id,
      accountId: parsed.data.accountId,
      direction: 'inbound',
      senderType: 'end_client',
      senderId: null,
      content: parsed.data.content,
      traceId,
      metadata: {
        channel: 'simulated_webhook',
        channelHandle: parsed.data.channelHandle,
        simulated: true,
        triggered_by_user_id: auth.userId,
      },
    });

    await publishEvent(
      'interaction.received',
      `tenant:${tenant.id}`,
      {
        tenantId: tenant.id,
        accountId: parsed.data.accountId,
        conversationId: conversation.id,
        interactionId: interaction.id,
        channel: 'simulated_webhook' as const,
      },
      traceId,
    );

    return NextResponse.json(
      { conversationId: conversation.id, interactionId: interaction.id, traceId },
      { status: 202 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
