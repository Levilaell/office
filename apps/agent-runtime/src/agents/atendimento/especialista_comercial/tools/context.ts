// =============================================================================
// Carregamento de contexto pra rodar o Especialista Comercial.
//
// SEPARAÇÃO de responsabilidade: context é read-only. Carrega conversation,
// message, history, lead existente (ou null) e agent. Criação de lead em
// turno novo fica em `act.ts` — caller decide quando materializa.
// =============================================================================

import type { ServiceRoleClient } from '@office/shared-domain';
import {
  getAgentByKey,
  getConversationById,
  getLeadByConversationId,
  getMessageById,
  getRecentMessages,
  loadDisplaySettings,
  type Agent,
  type ConversationRow,
  type DisplaySettings,
  type LeadRow,
  type MessageRow,
} from '@office/shared-domain';

export type EspecialistaComercialContext = {
  conversation: ConversationRow;
  message: MessageRow;
  history: MessageRow[];
  /** Lead vinculado à conversation. Null no primeiro turno. */
  lead: LeadRow | null;
  agent: Agent;
  displaySettings: DisplaySettings;
};

export type LoadEspecialistaComercialContextInput = {
  tenantId: string;
  conversationId: string;
  messageId: string;
  historyLimit?: number;
};

export class EspecialistaComercialContextError extends Error {
  override readonly name = 'EspecialistaComercialContextError';
  constructor(
    message: string,
    public readonly code:
      | 'conversation_not_found'
      | 'message_not_found'
      | 'tenant_mismatch'
      | 'message_not_in_conversation'
      | 'agent_not_found',
  ) {
    super(message);
  }
}

export const loadEspecialistaComercialContext = async (
  supabase: ServiceRoleClient,
  input: LoadEspecialistaComercialContextInput,
): Promise<EspecialistaComercialContext> => {
  const conversation = await getConversationById(supabase, input.conversationId);
  if (!conversation) {
    throw new EspecialistaComercialContextError(
      `conversation ${input.conversationId} not found`,
      'conversation_not_found',
    );
  }
  if (conversation.tenant_id !== input.tenantId) {
    throw new EspecialistaComercialContextError(
      `conversation ${input.conversationId} tenant mismatch`,
      'tenant_mismatch',
    );
  }

  const message = await getMessageById(supabase, input.messageId);
  if (!message) {
    throw new EspecialistaComercialContextError(
      `message ${input.messageId} not found`,
      'message_not_found',
    );
  }
  if (message.conversation_id !== input.conversationId) {
    throw new EspecialistaComercialContextError(
      `message ${input.messageId} not in conversation ${input.conversationId}`,
      'message_not_in_conversation',
    );
  }

  const history = await getRecentMessages(
    supabase,
    input.conversationId,
    input.historyLimit ?? 5,
  );

  const agent = await getAgentByKey(
    supabase,
    input.tenantId,
    'atendimento.especialista_comercial',
  );
  if (!agent) {
    throw new EspecialistaComercialContextError(
      `tenant ${input.tenantId} does not have atendimento.especialista_comercial seeded`,
      'agent_not_found',
    );
  }

  const lead = await getLeadByConversationId(
    supabase,
    input.tenantId,
    input.conversationId,
  );

  const displaySettings = await loadDisplaySettings(supabase, input.tenantId);

  return { conversation, message, history, lead, agent, displaySettings };
};

const senderLabel = (msg: MessageRow): string => {
  switch (msg.sender_type) {
    case 'end_client':
      return 'cliente';
    case 'agent':
      return 'agente';
    case 'operator':
      return 'operador';
    case 'system':
      return 'sistema';
    default:
      return msg.sender_type;
  }
};

/**
 * Formata histórico pra contexto do prompt — exclui a mensagem atual (que
 * é apresentada separadamente no prompt). Linha-por-mensagem.
 */
export const renderConversationHistory = (input: {
  history: MessageRow[];
  currentMessageId: string;
}): string => {
  const filtered = input.history.filter((m) => m.id !== input.currentMessageId);
  if (filtered.length === 0) return '';
  return filtered.map((m) => `${senderLabel(m)}: ${m.content}`).join('\n');
};
