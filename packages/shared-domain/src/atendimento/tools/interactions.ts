// =============================================================================
// Tool: getRecentInteractionsForAccount
//
// Retorna histórico recente de mensagens entre o account e o escritório
// (qualquer conversation, qualquer canal). Especialista usa pra ter contexto
// largo — "esse cliente já reclamou de DAS no mês passado" ou pra detectar
// repetição.
//
// Difere de `getRecentMessages` (conversations) — esta tool agrega múltiplas
// conversations do mesmo account.
// =============================================================================

import { appendAuditLog } from '../../audit/index';
import type { ToolClient, ToolContext, InteractionSnapshot } from './types';

export type GetRecentInteractionsOptions = {
  /** Default 10. */
  limit?: number;
};

export const getRecentInteractionsForAccount = async (
  supabase: ToolClient,
  ctx: ToolContext,
  options: GetRecentInteractionsOptions = {},
): Promise<InteractionSnapshot[]> => {
  const limit = options.limit ?? 10;

  // Não fazemos join — messages tem account_id direto. Trazemos conversations
  // separadamente quando precisarmos do `channel` em batch. Solução simples:
  // ler messages, depois resolver channel via lookup das conversations únicas.
  const { data: messages, error: msgErr } = await supabase
    .from('messages')
    .select('id, conversation_id, direction, sender_type, content, created_at')
    .eq('tenant_id', ctx.tenantId)
    .eq('account_id', ctx.accountId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (msgErr) throw msgErr;

  const rows = messages ?? [];
  // Mapa conv_id → channel, carregado em uma única query (in).
  const conversationIds = Array.from(
    new Set(rows.map((r) => r.conversation_id as string)),
  );
  let channelByConv: Record<string, string> = {};
  if (conversationIds.length > 0) {
    const { data: convs, error: convErr } = await supabase
      .from('conversations')
      .select('id, channel')
      .in('id', conversationIds);
    if (convErr) throw convErr;
    channelByConv = Object.fromEntries(
      (convs ?? []).map((c) => [c.id as string, c.channel as string]),
    );
  }

  const snapshots: InteractionSnapshot[] = rows.map((r) => ({
    id: r.id as string,
    conversationId: r.conversation_id as string,
    channel: channelByConv[r.conversation_id as string] ?? 'unknown',
    direction: r.direction as string,
    senderType: r.sender_type as string,
    content: r.content as string,
    createdAt: r.created_at as string,
  }));

  await appendAuditLog(supabase, {
    trace_id: ctx.traceId,
    tenant_id: ctx.tenantId,
    account_id: ctx.accountId,
    actor: ctx.actor,
    action: 'tool.read.recent_interactions',
    resource: `account:${ctx.accountId}`,
    metadata: {
      count: snapshots.length,
      limit,
      conversations_count: conversationIds.length,
    },
  });

  return snapshots;
};
