// =============================================================================
// Carregamento de contexto pra rodar o Coordenador.
//
// Concentra os reads do DB pra evitar que o graph espalhe queries entre nós.
// Tudo em uma chamada (com batch quando possível) facilita rastrear o custo
// real de uma execução do agente.
// =============================================================================

import type { ServiceRoleClient } from '@office/shared-domain';
import {
  getAgentByKey,
  getConversationById,
  getMessageById,
  getRecentMessages,
  loadDisplaySettings,
  type Agent,
  type ConversationRow,
  type DisplaySettings,
  type MessageRow,
} from '@office/shared-domain';

export type CoordenadorContext = {
  conversation: ConversationRow;
  message: MessageRow;
  history: MessageRow[];
  coordinatorAgent: Agent;
  displaySettings: DisplaySettings;
};

export type LoadCoordenadorContextInput = {
  tenantId: string;
  conversationId: string;
  messageId: string;
  historyLimit?: number;
};

export class CoordenadorContextError extends Error {
  override readonly name = 'CoordenadorContextError';
  constructor(
    message: string,
    public readonly code:
      | 'conversation_not_found'
      | 'message_not_found'
      | 'tenant_mismatch'
      | 'message_not_in_conversation'
      | 'coordinator_agent_not_found',
  ) {
    super(message);
  }
}

export const loadCoordenadorContext = async (
  supabase: ServiceRoleClient,
  input: LoadCoordenadorContextInput,
): Promise<CoordenadorContext> => {
  const conversation = await getConversationById(supabase, input.conversationId);
  if (!conversation) {
    throw new CoordenadorContextError(
      `conversation ${input.conversationId} not found`,
      'conversation_not_found',
    );
  }
  if (conversation.tenant_id !== input.tenantId) {
    throw new CoordenadorContextError(
      `conversation ${input.conversationId} tenant mismatch`,
      'tenant_mismatch',
    );
  }

  const message = await getMessageById(supabase, input.messageId);
  if (!message) {
    throw new CoordenadorContextError(
      `message ${input.messageId} not found`,
      'message_not_found',
    );
  }
  if (message.conversation_id !== input.conversationId) {
    throw new CoordenadorContextError(
      `message ${input.messageId} not in conversation ${input.conversationId}`,
      'message_not_in_conversation',
    );
  }

  const history = await getRecentMessages(
    supabase,
    input.conversationId,
    input.historyLimit ?? 5,
  );

  const coordinatorAgent = await getAgentByKey(
    supabase,
    input.tenantId,
    'atendimento.coordenador',
  );
  if (!coordinatorAgent) {
    throw new CoordenadorContextError(
      `tenant ${input.tenantId} does not have atendimento.coordenador seeded`,
      'coordinator_agent_not_found',
    );
  }

  const displaySettings = await loadDisplaySettings(supabase, input.tenantId);

  return { conversation, message, history, coordinatorAgent, displaySettings };
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
 * Formata o histórico pro prompt em formato linha-por-mensagem:
 *   cliente: Bom dia
 *   agente: Oi! Aqui é a Equipe X
 *   cliente: Vocês fazem ECD?
 *
 * Mensagem atual (a que está sendo classificada) NÃO entra aqui — o prompt
 * a apresenta separadamente.
 */
export const renderConversationHistory = (input: {
  history: MessageRow[];
  currentMessageId: string;
}): string => {
  const filtered = input.history.filter((m) => m.id !== input.currentMessageId);
  if (filtered.length === 0) return '';
  return filtered.map((m) => `${senderLabel(m)}: ${m.content}`).join('\n');
};
