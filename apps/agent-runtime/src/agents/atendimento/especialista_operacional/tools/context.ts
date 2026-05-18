// =============================================================================
// Carregamento de contexto pra rodar o Especialista Operacional.
//
// Reúne em uma chamada:
//   - conversation, message, history (mesma lógica do Coordenador)
//   - especialista agente (resolve agent_key → row)
//   - displaySettings (bot_name pra renderizar templates)
//   - accountSnapshot via tool (vai gravar audit_log do acesso)
//
// Se accountSnapshot retorna `not_found` ou `tenant_mismatch`, contexto
// ainda é carregado — caller decide escalar humano (decisão fechada
// ADR-014: Especialista sem account vinculada não responde).
// =============================================================================

import {
  getAgentByKey,
  getAccountSnapshot,
  getConversationById,
  getMessageById,
  getRecentMessages,
  loadDisplaySettings,
  type AccountSnapshot,
  type Agent,
  type ConversationRow,
  type DisplaySettings,
  type MessageRow,
  type ServiceRoleClient,
} from '@office/shared-domain';

export const ESPECIALISTA_OPERACIONAL_AGENT_KEY =
  'atendimento.especialista_operacional';

export type EspecialistaOperacionalContext = {
  conversation: ConversationRow;
  message: MessageRow;
  history: MessageRow[];
  specialistAgent: Agent;
  displaySettings: DisplaySettings;
  /** null se account não encontrado / mismatch — caller escala humano. */
  accountSnapshot: AccountSnapshot | null;
  accountUnavailableReason:
    | null
    | 'not_found'
    | 'tenant_mismatch'
    | 'conversation_without_account';
};

export type LoadEspecialistaContextInput = {
  tenantId: string;
  conversationId: string;
  messageId: string;
  traceId: string;
  /** Actor usado pra audit_log das tools (agent:<uuid>). */
  actor: string;
  historyLimit?: number;
};

export class EspecialistaContextError extends Error {
  override readonly name = 'EspecialistaContextError';
  constructor(
    message: string,
    public readonly code:
      | 'conversation_not_found'
      | 'message_not_found'
      | 'tenant_mismatch'
      | 'message_not_in_conversation'
      | 'specialist_agent_not_found',
  ) {
    super(message);
  }
}

export const loadEspecialistaContext = async (
  supabase: ServiceRoleClient,
  input: LoadEspecialistaContextInput,
): Promise<EspecialistaOperacionalContext> => {
  const conversation = await getConversationById(supabase, input.conversationId);
  if (!conversation) {
    throw new EspecialistaContextError(
      `conversation ${input.conversationId} not found`,
      'conversation_not_found',
    );
  }
  if (conversation.tenant_id !== input.tenantId) {
    throw new EspecialistaContextError(
      `conversation ${input.conversationId} tenant mismatch`,
      'tenant_mismatch',
    );
  }

  const message = await getMessageById(supabase, input.messageId);
  if (!message) {
    throw new EspecialistaContextError(
      `message ${input.messageId} not found`,
      'message_not_found',
    );
  }
  if (message.conversation_id !== input.conversationId) {
    throw new EspecialistaContextError(
      `message ${input.messageId} not in conversation ${input.conversationId}`,
      'message_not_in_conversation',
    );
  }

  const history = await getRecentMessages(
    supabase,
    input.conversationId,
    input.historyLimit ?? 5,
  );

  const specialistAgent = await getAgentByKey(
    supabase,
    input.tenantId,
    ESPECIALISTA_OPERACIONAL_AGENT_KEY,
  );
  if (!specialistAgent) {
    throw new EspecialistaContextError(
      `tenant ${input.tenantId} sem ${ESPECIALISTA_OPERACIONAL_AGENT_KEY} seedado`,
      'specialist_agent_not_found',
    );
  }

  const displaySettings = await loadDisplaySettings(supabase, input.tenantId);

  // accountSnapshot é central pro Especialista. Sem ele, escala humano.
  let accountSnapshot: AccountSnapshot | null = null;
  let accountUnavailableReason:
    | EspecialistaOperacionalContext['accountUnavailableReason']
    | undefined;
  // conversation.account_id é NOT NULL no schema, mas testamos por defesa
  // — futura refatoração que permita conversation sem account não vai
  // quebrar este código.
  if (!conversation.account_id) {
    accountUnavailableReason = 'conversation_without_account';
  } else {
    const snapshotResult = await getAccountSnapshot(supabase, {
      tenantId: input.tenantId,
      accountId: conversation.account_id,
      actor: input.actor,
      traceId: input.traceId,
    });
    if (snapshotResult.ok) {
      accountSnapshot = snapshotResult.snapshot;
      accountUnavailableReason = null;
    } else {
      accountUnavailableReason = snapshotResult.reason;
    }
  }

  return {
    conversation,
    message,
    history,
    specialistAgent,
    displaySettings,
    accountSnapshot,
    accountUnavailableReason: accountUnavailableReason ?? null,
  };
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

export const renderConversationHistory = (input: {
  history: MessageRow[];
  currentMessageId: string;
}): string => {
  const filtered = input.history.filter((m) => m.id !== input.currentMessageId);
  if (filtered.length === 0) return '';
  return filtered.map((m) => `${senderLabel(m)}: ${m.content}`).join('\n');
};
