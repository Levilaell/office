import 'server-only';
import {
  getConversationById,
  listClassificationsForConversation,
  type AuthenticatedClient,
} from '@office/shared-domain';
import {
  toConversationClassificationSnapshot,
  toConversationSnapshot,
  toDraftSnapshot,
  toLeadSnapshot,
  toMessageSnapshot,
} from './realtime-mappers';
import type { ConversationDetailSnapshot } from './realtime-types';

// Sprint 1.6 — server-only helper compartilhado entre página SC e endpoint
// API que carrega o agregado pra detalhe de conversa. RLS aplica isolamento
// por tenant via JWT do cliente autenticado — selects diretos filtram só
// dentro do tenant ativo.
export const loadConversationDetail = async (
  supabase: AuthenticatedClient,
  conversationId: string,
): Promise<ConversationDetailSnapshot | null> => {
  const conversation = await getConversationById(supabase, conversationId);
  if (!conversation) return null;

  const [messagesRes, classifications, leadRes, draftsRes] = await Promise.all([
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }),
    listClassificationsForConversation(supabase, conversationId, 50),
    supabase
      .from('leads')
      .select('*')
      .eq('primary_conversation_id', conversationId)
      .maybeSingle(),
    supabase
      .from('message_drafts')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (messagesRes.error) throw messagesRes.error;
  if (draftsRes.error) throw draftsRes.error;
  if (leadRes.error) throw leadRes.error;

  return {
    conversation: toConversationSnapshot(conversation),
    messages: (messagesRes.data ?? []).map(toMessageSnapshot),
    classifications: classifications.map(toConversationClassificationSnapshot),
    lead: leadRes.data ? toLeadSnapshot(leadRes.data) : null,
    drafts: (draftsRes.data ?? []).map(toDraftSnapshot),
  };
};
