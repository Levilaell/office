import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  appendAuditLog,
  getCurrentTenantUserRole,
  getUserByClerkUserId,
  updateAgentAutonomyTier,
  type Json,
} from '@office/shared-domain';
import { getCurrentAuthContext } from '@/lib/auth';
import { getSupabaseForCurrentUser } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ParamsSchema = z.object({ id: z.string().uuid() });

const BodySchema = z.object({
  autonomy_tier: z.enum(['sugestivo', 'semi_autonomo']),
});

const ALLOWED_ROLES = new Set(['owner_tenant', 'manager']);

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await getCurrentAuthContext();
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const params = await context.params;
  const parsedParams = ParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  const raw = await req.json().catch(() => null);
  const parsedBody = BodySchema.safeParse(raw);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'invalid body', issues: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const agentId = parsedParams.data.id;
  const { autonomy_tier: tier } = parsedBody.data;
  const supabase = await getSupabaseForCurrentUser();

  // Resolve user interno (UUID FK pra users) — necessário pra checar role
  // em tenant_users e gravar audit_log.metadata.changed_by.
  const user = await getUserByClerkUserId(supabase, auth.userId);
  if (!user) {
    return NextResponse.json({ error: 'user not provisioned' }, { status: 403 });
  }

  const role = await getCurrentTenantUserRole(supabase, user.id);
  if (!role || !ALLOWED_ROLES.has(role)) {
    return NextResponse.json(
      {
        error: 'permission_denied',
        reason: 'apenas owner_tenant ou manager podem alterar tier de agente',
      },
      { status: 403 },
    );
  }

  // RLS já restringe ao tenant ativo. Se agent não existir ou outro tenant,
  // updateAgentAutonomyTier retorna null.
  const result = await updateAgentAutonomyTier(supabase, agentId, tier);
  if (!result) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const { before, after } = result;

  // Audit (somente se de fato mudou).
  if (before.autonomy_tier !== after.autonomy_tier) {
    await appendAuditLog(supabase, {
      trace_id: `agent.autonomy_tier_changed:${agentId}`,
      tenant_id: before.tenant_id,
      account_id: null,
      actor: `user:${auth.userId}`,
      action: 'agent.autonomy_tier_changed',
      resource: `agent:${agentId}`,
      before: before as unknown as Json,
      after: after as unknown as Json,
      metadata: {
        changed_by: user.id,
        clerk_user_id: auth.userId,
        previous_tier: before.autonomy_tier,
        new_tier: after.autonomy_tier,
      } as Json,
    });
  }

  return NextResponse.json({
    agent: {
      id: after.id,
      agentKey: after.agent_key,
      name: after.name,
      department: after.department,
      role: after.role,
      autonomyTier: after.autonomy_tier,
    },
    changed: before.autonomy_tier !== after.autonomy_tier,
  });
}
