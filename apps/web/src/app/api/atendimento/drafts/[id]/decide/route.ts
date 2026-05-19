import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  appendAuditLog,
  approveDraftWithMessage,
  computeEditDiff,
  editDraft,
  getDraftById,
  getUserByClerkUserId,
  rejectDraft,
  sendAgentMessage,
  type Json,
  type MessageDraftRow,
} from '@office/shared-domain';
import {
  publishEvent,
  type DraftApprovedPayload,
  type DraftEditedPayload,
  type DraftRejectedPayload,
} from '@office/shared-events';
import { getCurrentAuthContext } from '@/lib/auth';
import { getServiceRoleSupabase, getSupabaseForCurrentUser } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ParamsSchema = z.object({ id: z.string().uuid() });

const BodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    justification: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal('edit'),
    edited_content: z.string().min(1).max(2000),
    justification: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal('reject'),
    reason: z.string().min(1).max(500).optional(),
  }),
]);

type Body = z.infer<typeof BodySchema>;

const traceIdFor = (draftId: string): string => `draft.decide:${draftId}`;

const draftSnapshot = (row: MessageDraftRow) => ({
  id: row.id,
  status: row.status,
  proposedContent: row.proposed_content,
  reasoning: row.reasoning,
  confidence: row.confidence,
  conversationId: row.conversation_id,
  agentId: row.agent_id,
  resolvedBy: row.resolved_by,
  resolvedAt: row.resolved_at,
  finalMessageId: row.final_message_id,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
  editDiff: row.edit_diff,
  decisionMetadata: row.decision_metadata,
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

  const draftId = parsedParams.data.id;
  const body: Body = parsedBody.data;
  const supabase = await getSupabaseForCurrentUser();

  // RLS filtra tenant_id. null aqui significa "outro tenant" ou "não existe" —
  // ambos viram 404 (não revelamos qual).
  const before = await getDraftById(supabase, draftId);
  if (!before) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  if (before.status !== 'pending') {
    return NextResponse.json(
      { error: 'draft_already_resolved', status: before.status },
      { status: 409 },
    );
  }

  // reviewer_user_id é UUID FK pra public.users — não aceita Clerk ID
  // direto. Resolve o user interno antes de gravar.
  const user = await getUserByClerkUserId(supabase, auth.userId);
  const reviewerUserId = user?.id ?? null;

  const traceId = traceIdFor(draftId);

  // -------------------------------------------------------------------------
  // REJECT — sem envio. Só transita status + audit + evento.
  // -------------------------------------------------------------------------
  if (body.action === 'reject') {
    const result = await rejectDraft(supabase, draftId, {
      resolvedByUserId: reviewerUserId ?? before.agent_id,
      ...(body.reason !== undefined && { reason: body.reason }),
    });
    if (!result.ok) {
      // Race: outro caller (operador concorrente OU worker de expiração)
      // mudou status no meio. Não logamos como decisão de negócio — é
      // conflito técnico (igual approvals).
      if (result.reason === 'not_pending') {
        return NextResponse.json(
          { error: 'draft_already_resolved', draftId },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    await appendAuditLog(supabase, {
      trace_id: traceId,
      tenant_id: before.tenant_id,
      account_id: null,
      actor: `user:${auth.userId}`,
      action: 'draft.rejected',
      resource: `message_draft:${draftId}`,
      before: before as unknown as Json,
      after: result.draft as unknown as Json,
      metadata: {
        userId: auth.userId,
        ...(body.reason !== undefined && { reason: body.reason }),
      } as Json,
    });

    const payload: DraftRejectedPayload = {
      tenantId: before.tenant_id,
      draftId,
      conversationId: before.conversation_id,
      resolvedBy: reviewerUserId,
      ...(body.reason !== undefined && { reason: body.reason }),
      traceId,
    };
    try {
      await publishEvent(
        'draft.rejected',
        `tenant:${before.tenant_id}`,
        payload,
        traceId,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[drafts.decide] publish draft.rejected falhou', {
        draftId,
        message,
      });
    }
    return NextResponse.json({ draft: draftSnapshot(result.draft) });
  }

  // -------------------------------------------------------------------------
  // APPROVE / EDIT — envia mensagem outbound primeiro, depois transita.
  //
  // Send usa service role (sendAgentMessage exige write em messages e
  // resolve channel_session). Se send falhar, NÃO transitamos o draft —
  // operador pode tentar de novo. Resposta 502 sinaliza "canal indisponível".
  // -------------------------------------------------------------------------
  const service = getServiceRoleSupabase();

  // Carrega conversation pelo service role pra ter account_id sem RLS friction.
  // Já validamos via draft (RLS) que a conversation pertence ao tenant.
  const { data: conv } = await service
    .from('conversations')
    .select('id, tenant_id, account_id, channel, channel_handle, subject')
    .eq('id', before.conversation_id)
    .maybeSingle();

  if (!conv || conv.tenant_id !== before.tenant_id) {
    return NextResponse.json(
      { error: 'conversation_inconsistent' },
      { status: 500 },
    );
  }

  const contentToSend =
    body.action === 'edit' ? body.edited_content : before.proposed_content;

  const sendResult = await sendAgentMessage(service, {
    tenantId: before.tenant_id,
    conversationId: before.conversation_id,
    accountId: conv.account_id,
    agentId: before.agent_id,
    content: contentToSend,
    traceId,
    ...(conv.subject !== null && { subject: `Re: ${conv.subject}` }),
  });

  if (!sendResult.ok) {
    // Send falhou. NÃO transitamos draft — fica pending pra operador retentar.
    await appendAuditLog(service, {
      trace_id: traceId,
      tenant_id: before.tenant_id,
      account_id: null,
      actor: `user:${auth.userId}`,
      action: 'draft.decide_failed',
      resource: `message_draft:${draftId}`,
      before: before as unknown as Json,
      after: null,
      metadata: {
        userId: auth.userId,
        intended_action: body.action,
        reason: sendResult.reason,
      } as Json,
    });
    return NextResponse.json(
      {
        error: 'channel_send_failed',
        reason: sendResult.reason,
        traceId,
        draftId,
      },
      { status: 502 },
    );
  }

  // Envio OK — transita draft.
  if (body.action === 'edit') {
    const editResult = await editDraft(supabase, draftId, {
      resolvedByUserId: reviewerUserId ?? before.agent_id,
      editedContent: body.edited_content,
      finalMessageId: sendResult.messageId,
      ...(body.justification !== undefined && { justification: body.justification }),
    });
    if (!editResult.ok) {
      // Race extrema — envio OK mas draft mudou status entre 2 callers.
      // Mensagem já foi enviada ao cliente; expomos 409 com traceId pra
      // operador investigar manualmente (audit_log preserva o histórico).
      return NextResponse.json(
        {
          error: 'draft_already_resolved_after_send',
          draftId,
          sentMessageId: sendResult.messageId,
          traceId,
        },
        { status: 409 },
      );
    }

    const diff = computeEditDiff(before.proposed_content, body.edited_content);
    await appendAuditLog(supabase, {
      trace_id: traceId,
      tenant_id: before.tenant_id,
      account_id: conv.account_id,
      actor: `user:${auth.userId}`,
      action: 'draft.edited',
      resource: `message_draft:${draftId}`,
      before: before as unknown as Json,
      after: editResult.draft as unknown as Json,
      metadata: {
        userId: auth.userId,
        final_message_id: sendResult.messageId,
        edit_diff: diff,
        ...(body.justification !== undefined && { justification: body.justification }),
      } as Json,
    });

    const payload: DraftEditedPayload = {
      tenantId: before.tenant_id,
      draftId,
      conversationId: before.conversation_id,
      finalMessageId: sendResult.messageId,
      resolvedBy: reviewerUserId,
      traceId,
      editDiff: diff,
    };
    try {
      await publishEvent(
        'draft.edited',
        `tenant:${before.tenant_id}`,
        payload,
        traceId,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[drafts.decide] publish draft.edited falhou', {
        draftId,
        message,
      });
    }
    return NextResponse.json({ draft: draftSnapshot(editResult.draft) });
  }

  // APPROVE
  const approveResult = await approveDraftWithMessage(supabase, draftId, {
    resolvedByUserId: reviewerUserId ?? before.agent_id,
    finalMessageId: sendResult.messageId,
    ...(body.justification !== undefined && { justification: body.justification }),
  });
  if (!approveResult.ok) {
    return NextResponse.json(
      {
        error: 'draft_already_resolved_after_send',
        draftId,
        sentMessageId: sendResult.messageId,
        traceId,
      },
      { status: 409 },
    );
  }

  await appendAuditLog(supabase, {
    trace_id: traceId,
    tenant_id: before.tenant_id,
    account_id: conv.account_id,
    actor: `user:${auth.userId}`,
    action: 'draft.approved',
    resource: `message_draft:${draftId}`,
    before: before as unknown as Json,
    after: approveResult.draft as unknown as Json,
    metadata: {
      userId: auth.userId,
      final_message_id: sendResult.messageId,
      ...(body.justification !== undefined && { justification: body.justification }),
    } as Json,
  });

  const payload: DraftApprovedPayload = {
    tenantId: before.tenant_id,
    draftId,
    conversationId: before.conversation_id,
    finalMessageId: sendResult.messageId,
    resolvedBy: reviewerUserId,
    traceId,
  };
  try {
    await publishEvent(
      'draft.approved',
      `tenant:${before.tenant_id}`,
      payload,
      traceId,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[drafts.decide] publish draft.approved falhou', {
      draftId,
      message,
    });
  }
  return NextResponse.json({ draft: draftSnapshot(approveResult.draft) });
}
