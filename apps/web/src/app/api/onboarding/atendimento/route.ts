import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  appendAuditLog,
  completeTenantOnboarding,
  getCurrentTenant,
  getCurrentTenantUserRole,
  getUserByClerkUserId,
  updateAgentAutonomyTier,
  type Json,
} from '@office/shared-domain';
import { getCurrentAuthContext } from '@/lib/auth';
import { getSupabaseForCurrentUser } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

// Mesma whitelist do PATCH /api/configuracoes/agentes/[id] (Sprint 1.5).
// Wizard pode ser disparado por qualquer admin/manager do tenant durante o
// onboarding, mas NUNCA por basic_member — toca tier de autonomia que muda
// comportamento sistêmico.
const ALLOWED_ROLES = new Set(['owner_tenant', 'manager']);

const BodySchema = z.object({
  bot_name: z.string().trim().min(1).max(80),
  signature: z.string().trim().min(1).max(120),
  business_hours: z
    .object({
      start: z.string().regex(HHMM_REGEX, 'HH:MM (24h)'),
      end: z.string().regex(HHMM_REGEX, 'HH:MM (24h)'),
      timezone: z.string().min(1).max(60),
      days: z.array(z.number().int().min(1).max(7)).min(1).max(7),
    })
    .refine(
      (v) => v.end > v.start,
      { message: 'end > start', path: ['end'] },
    )
    .nullable(),
  agent_tiers: z
    .array(
      z.object({
        agent_id: z.string().uuid(),
        autonomy_tier: z.enum(['sugestivo', 'semi_autonomo']),
      }),
    )
    .max(20),
  /** "Pular" envia este flag — wizard usa defaults mas marca completado. */
  skipped: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
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

  const supabase = await getSupabaseForCurrentUser();
  const tenant = await getCurrentTenant(supabase);
  if (!tenant) {
    return NextResponse.json({ error: 'tenant not found' }, { status: 404 });
  }

  const user = await getUserByClerkUserId(supabase, auth.userId);
  if (!user) {
    return NextResponse.json({ error: 'user not provisioned' }, { status: 403 });
  }

  // Symmetric com PATCH /api/configuracoes/agentes/[id]: tier de autonomia
  // muda comportamento sistêmico; só admin/manager. Wizard normalmente roda
  // pelo owner_tenant (criador da org no Clerk) então passa direto na maioria
  // dos casos — protege contra basic_member adicionado durante onboarding
  // pendente abusando do endpoint.
  const role = await getCurrentTenantUserRole(supabase, user.id);
  if (!role || !ALLOWED_ROLES.has(role)) {
    return NextResponse.json(
      { error: 'permission_denied', reason: 'somente owner/manager' },
      { status: 403 },
    );
  }

  const { bot_name, signature, business_hours, agent_tiers, skipped } = parsed.data;

  // Aplicar tiers individuais (cada agente é um UPDATE separado — RLS
  // limita ao tenant ativo). Falhas individuais não bloqueiam o resto;
  // capturadas e retornadas no payload.
  const tierResults: Array<{ agentId: string; ok: boolean; error?: string }> = [];
  for (const t of agent_tiers) {
    try {
      await updateAgentAutonomyTier(supabase, t.agent_id, t.autonomy_tier);
      tierResults.push({ agentId: t.agent_id, ok: true });
    } catch (err) {
      tierResults.push({
        agentId: t.agent_id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const updated = await completeTenantOnboarding(supabase, tenant.id, {
    bot_name,
    signature,
    business_hours,
  });

  await appendAuditLog(supabase, {
    trace_id: crypto.randomUUID(),
    tenant_id: tenant.id,
    actor: `user:${user.id}`,
    action: 'tenant.onboarding_completed',
    resource: `tenant:${tenant.id}`,
    metadata: {
      bot_name,
      signature,
      business_hours,
      tier_changes: agent_tiers.length,
      skipped: Boolean(skipped),
      tier_failures: tierResults.filter((r) => !r.ok),
    } as Json,
  });

  return NextResponse.json({
    ok: true,
    tenant: { id: updated.id, display_settings: updated.display_settings },
    tierResults,
  });
}
