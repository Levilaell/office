// =============================================================================
// Repositório de classifications de conversa
//
// `conversation_classifications` é INSERT-only — cada classificação do
// Coordenador vira uma row. `conversations.intent_current` é denormalização
// da última (rápido pra UI/handoff).
//
// Atomicidade: INSERT + UPDATE não rodam em transação cross-statement
// (supabase-js não expõe BEGIN). Ordem garante que falha intermediária
// preserva histórico: se o INSERT cai, nada muda; se o UPDATE cai, classifi-
// cação está auditada mas UI desatualizada até a próxima — re-classificação
// corrige. Reverso (UPDATE sem INSERT) é impossível.
// =============================================================================

import type {
  AuthenticatedClient,
  Database,
  Json,
  ServiceRoleClient,
} from '@office/shared-db';

export type ConversationClassificationRow =
  Database['public']['Tables']['conversation_classifications']['Row'];
export type ConversationClassificationInsert =
  Database['public']['Tables']['conversation_classifications']['Insert'];

type AnyClient = AuthenticatedClient | ServiceRoleClient;

export type ClassificationDecision =
  | 'respond_direct'
  | 'handoff_specialist'
  | 'escalate_human'
  | 'ignore';

export type RecordClassificationInput = {
  tenantId: string;
  conversationId: string;
  messageId: string | null;
  agentId: string;
  agentRunId: string | null;
  intent: string;
  confidence: number | null;
  reasoning: string | null;
  decision: ClassificationDecision;
  decisionMetadata?: Record<string, unknown>;
  promptVersion?: string | null;
  model?: string | null;
  costUsd?: number | null;
};

/**
 * Persiste uma classificação no histórico E atualiza
 * `conversations.intent_current` pra refletir a última. Ver comentário do
 * arquivo sobre ordem e atomicidade.
 */
export const recordClassification = async (
  supabase: AnyClient,
  input: RecordClassificationInput,
): Promise<ConversationClassificationRow> => {
  const insert: ConversationClassificationInsert = {
    tenant_id: input.tenantId,
    conversation_id: input.conversationId,
    message_id: input.messageId,
    agent_id: input.agentId,
    agent_run_id: input.agentRunId,
    intent: input.intent,
    confidence: input.confidence,
    reasoning: input.reasoning,
    decision: input.decision,
    decision_metadata: (input.decisionMetadata ?? {}) as Json,
    prompt_version: input.promptVersion ?? null,
    model: input.model ?? null,
    cost_usd: input.costUsd ?? null,
  };

  const inserted = await supabase
    .from('conversation_classifications')
    .insert(insert)
    .select()
    .single();
  if (inserted.error) throw inserted.error;

  const { error: upErr } = await supabase
    .from('conversations')
    .update({ intent_current: input.intent })
    .eq('id', input.conversationId);
  if (upErr) throw upErr;

  return inserted.data;
};

export const getLastClassification = async (
  supabase: AnyClient,
  conversationId: string,
): Promise<ConversationClassificationRow | null> => {
  const { data, error } = await supabase
    .from('conversation_classifications')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const listClassificationsForConversation = async (
  supabase: AnyClient,
  conversationId: string,
  limit = 20,
): Promise<ConversationClassificationRow[]> => {
  const { data, error } = await supabase
    .from('conversation_classifications')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
};
