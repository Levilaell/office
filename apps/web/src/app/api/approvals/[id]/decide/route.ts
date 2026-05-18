import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  appendAuditLog,
  ApprovalRaceConditionError,
  decideApproval,
  getApprovalById,
  getUserByClerkUserId,
  type Approval,
  type Json,
} from '@office/shared-domain';
import { publishEvent, type ApprovalResolvedPayload } from '@office/shared-events';
import { getCurrentAuthContext } from '@/lib/auth';
import { getSupabaseForCurrentUser } from '@/lib/supabase';
import type { ApprovalSnapshot } from '@/lib/realtime-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ParamsSchema = z.object({ id: z.string().uuid() });

const BodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    justification: z.string().optional(),
  }),
  z.object({
    action: z.literal('reject'),
    justification: z.string().min(1),
  }),
  z.object({
    action: z.literal('modify'),
    modifiedProposal: z.record(z.unknown()),
    justification: z.string().optional(),
  }),
  z.object({
    action: z.literal('request_info'),
    question: z.string().min(1),
  }),
]);

type Body = z.infer<typeof BodySchema>;

const STATUS_BY_ACTION: Record<
  Exclude<Body['action'], 'request_info'>,
  'approved' | 'rejected' | 'modified'
> = {
  approve: 'approved',
  reject: 'rejected',
  modify: 'modified',
};

const toSnapshot = (row: Approval): ApprovalSnapshot => ({
  id: row.id,
  taskId: row.task_id,
  agentId: row.agent_id,
  status: row.status as ApprovalSnapshot['status'],
  actionType: row.action_type,
  proposal: (row.proposal ?? {}) as Record<string, unknown>,
  context: (row.context ?? {}) as Record<string, unknown>,
  reviewerUserId: row.reviewer_user_id,
  decision: (row.decision ?? null) as Record<string, unknown> | null,
  decidedAt: row.decided_at,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
});

export async function POST(
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

  const approvalId = parsedParams.data.id;
  const body = parsedBody.data;
  const supabase = await getSupabaseForCurrentUser();

  // RLS filtra tenant_id automaticamente. Se devolver null, ou não existe
  // ou pertence a outro tenant — tratamos como 404 nos dois casos.
  const before = await getApprovalById(supabase, approvalId);
  if (!before) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  if (body.action === 'request_info') {
    // Não muda o approval: a ação fica pendente até o agente devolver
    // uma nova proposta. Só registra a pergunta no audit_log.
    await appendAuditLog(supabase, {
      trace_id: before.trace_id,
      tenant_id: before.tenant_id,
      account_id: null,
      actor: `user:${auth.userId}`,
      action: 'approval.info_requested',
      resource: `approval:${approvalId}`,
      before: before as unknown as Json,
      after: null,
      metadata: { question: body.question, userId: auth.userId } as Json,
    });
    return NextResponse.json({ approval: toSnapshot(before) });
  }

  if (before.status !== 'pending') {
    return NextResponse.json(
      { error: 'approval already decided', status: before.status },
      { status: 409 },
    );
  }

  // reviewer_user_id é UUID FK pra public.users — não aceita Clerk ID
  // direto. Resolve o user interno antes de gravar.
  const user = await getUserByClerkUserId(supabase, auth.userId);
  const reviewerUserId = user?.id ?? null;

  const status = STATUS_BY_ACTION[body.action];
  const decisionPayload =
    body.action === 'modify'
      ? {
          action: body.action,
          modifiedProposal: body.modifiedProposal,
          ...(body.justification && { justification: body.justification }),
        }
      : {
          action: body.action,
          ...(body.justification && { justification: body.justification }),
        };

  let updated: Approval;
  try {
    updated = await decideApproval(supabase, approvalId, {
      status,
      decision: decisionPayload as Json,
      reviewerUserId,
    });
  } catch (err) {
    if (err instanceof ApprovalRaceConditionError) {
      // Race detectada pelo UPDATE atômico — outro reviewer ganhou.
      // 409 sinaliza "conflito de estado" pro client. NÃO logamos em audit
      // como "decisão rejeitada" — é falha técnica de concorrência, não
      // decisão de negócio. O audit do vencedor cobre o histórico real.
      console.warn(
        `[approvals.decide] race: approval=${approvalId} trace=${before.trace_id} user=${auth.userId}`,
      );
      return NextResponse.json(
        { error: 'approval_already_resolved', approvalId },
        { status: 409 },
      );
    }
    throw err;
  }

  await appendAuditLog(supabase, {
    trace_id: before.trace_id,
    tenant_id: before.tenant_id,
    account_id: null,
    actor: `user:${auth.userId}`,
    action: 'approval.decided',
    resource: `approval:${approvalId}`,
    before: before as unknown as Json,
    after: updated as unknown as Json,
    metadata: { ...decisionPayload } as Json,
  });

  const event: ApprovalResolvedPayload = {
    approvalId: updated.id,
    tenantId: updated.tenant_id,
    status,
    reviewerUserId,
  };
  try {
    await publishEvent(
      'approval.resolved',
      `tenant:${updated.tenant_id}`,
      event,
      updated.trace_id,
    );
  } catch (err) {
    // Banco já está consistente. Se o pub/sub falhou, o socket vai
    // reconciliar no próximo refresh — não derruba a operação.
    const message = err instanceof Error ? err.message : String(err);
    console.error('[approvals.decide] publish failed', { approvalId, message });
  }

  return NextResponse.json({ approval: toSnapshot(updated) });
}
