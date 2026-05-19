import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isDemoModeEnabled } from '@office/shared-config';
import {
  getTenantByClerkOrgId,
  ingestNormalizedMessages,
} from '@office/shared-domain';
import { getChannelAdapter } from '@office/shared-domain/channels/registry';
import { getCurrentAuthContext } from '@/lib/auth';
import { getServiceRoleSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  scenario: z.enum(['operacional', 'comercial', 'escalacao']),
});

// Sprint 1.6 — cenários pré-definidos pra demo comercial.
// Conteúdo em PT-BR informal, plausível pra cliente de escritório contábil.
const SCENARIO_CONTENT: Record<
  z.infer<typeof BodySchema>['scenario'],
  { content: string; subject: string }
> = {
  operacional: {
    subject: 'Quando vence meu DAS?',
    content: 'Oi! Lembra de mim, da Padaria Demo. Quando vence meu DAS desse mês?',
  },
  comercial: {
    subject: 'Quero conhecer os serviços',
    content:
      'Oi, achei vocês no Google. Tenho uma empresa de e-commerce começando e queria saber sobre os serviços de vocês. Vale a pena trocar de contador?',
  },
  escalacao: {
    subject: 'Intimação da Receita',
    content:
      'Gente, recebi uma intimação da Receita hoje cedo. Não sei o que fazer. Pode me ajudar?',
  },
};

export async function POST(req: NextRequest) {
  if (!isDemoModeEnabled()) {
    // Não vaza existência da rota em prod sem flag.
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const auth = await getCurrentAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { scenario } = parsed.data;
  const supabase = getServiceRoleSupabase();
  const tenant = await getTenantByClerkOrgId(supabase, auth.orgId);
  if (!tenant) {
    return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });
  }

  // Pega o primeiro account do tenant (em tenant demo seedado existe um
  // "Padaria Demo"). Operacional/escalação batem nesse account; comercial
  // (lead novo) também — Especialista Comercial não exige account
  // pré-existente, lead é criado pelo fluxo.
  const accountRes = await supabase
    .from('accounts')
    .select('id')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (accountRes.error) {
    return NextResponse.json({ error: accountRes.error.message }, { status: 500 });
  }
  if (!accountRes.data) {
    return NextResponse.json(
      {
        error: 'no_account',
        reason:
          'Tenant demo sem account seedado. Rode `pnpm seed:demo-tenant` ou `pnpm seed:atendimento-test-data` antes.',
      },
      { status: 412 },
    );
  }
  const accountId = accountRes.data.id;

  const traceId = crypto.randomUUID();
  const { subject, content } = SCENARIO_CONTENT[scenario];

  try {
    const adapter = await getChannelAdapter('simulated_webhook');
    const normalized = adapter.normalizeInbound({
      channelHandle: `demo+${scenario}@demo.local`,
      subject,
      content,
    });
    const enriched = normalized.map((msg) => ({
      ...msg,
      rawPayload: {
        ...(msg.rawPayload ?? {}),
        demo_scenario: scenario,
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
      return NextResponse.json({ error: 'no_messages_ingested' }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      scenario,
      messageId: first.message.id,
      conversationId: first.conversation.id,
      traceId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'ingest_failed', reason: message }, {
      status: 500,
    });
  }
}
