import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  getTenantByClerkOrgId,
  ingestNormalizedMessages,
} from '@office/shared-domain';
// Server-only subpath: registry static-imports adapters; reexportar pelo index
// puxaria imapflow pro client bundle do Next.
import { getChannelAdapter } from '@office/shared-domain/channels/registry';
import { getCurrentAuthContext } from '@/lib/auth';
import { getServiceRoleSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Webhook simulado. Em Sprint 1.3 entram canais reais (Evolution, etc) sem
// auth, validados por signature HMAC. Aqui, autenticado via Clerk — operador
// dispara manualmente pra testar o fluxo end-to-end.
//
// O caminho passa pelo ChannelAdapter agora (Sprint 1.1):
//   route → SimulatedWebhookAdapter.normalizeInbound → ingestNormalizedMessages
// que escreve conversations + messages, audita e publica `message.received`.
const BodySchema = z.object({
  accountId: z.string().uuid(),
  channelHandle: z.string().min(1).max(200),
  subject: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(10_000),
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
  const { accountId, ...adapterPayload } = parsed.data;

  try {
    const adapter = await getChannelAdapter('simulated_webhook');
    const normalized = adapter.normalizeInbound(adapterPayload);

    // Enriquece metadata com triggered_by — auditável pra rastrear quem
    // disparou o webhook simulado.
    const enriched = normalized.map((msg) => ({
      ...msg,
      rawPayload: {
        ...(msg.rawPayload ?? {}),
        simulated: true,
        triggered_by_user_id: auth.userId,
      },
    }));

    const results = await ingestNormalizedMessages(supabase, {
      tenantId: tenant.id,
      accountId,
      channel: 'simulated_webhook',
      sessionId: null,
      messages: enriched,
      traceId,
    });

    const first = results[0];
    if (!first) {
      return NextResponse.json(
        { error: 'no messages ingested' },
        { status: 500 },
      );
    }
    return NextResponse.json(
      {
        conversationId: first.conversation.id,
        messageId: first.message.id,
        traceId,
      },
      { status: 202 },
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
