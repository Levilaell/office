import { z } from 'zod';

// -----------------------------------------------------------------------------
// Eventos (Redis pub/sub)
//
// Nomenclatura: tipo.escopo.acao (ex: task.assigned, agent.state_changed).
// Sufixos dinâmicos (department, agent_id) viajam no canal, NÃO no event type.
// Canal padrão `tenant:{id}` é onde a UI escuta (todos eventos do tenant).
// -----------------------------------------------------------------------------

export const EVENT_TYPES = [
  'task.created.global',
  'task.assigned',
  'task.status_changed',
  'task.completed',
  'task.failed',
  'subtask.completed',
  'handoff.requested',
  'agent.state_changed',
  'approval.created',
  'approval.resolved',
  'message.received',
  'channel_session.status_changed',
  // Sprint 1.2 — Coordenador de Atendimento.
  // `agent.handoff_requested` é separado de `handoff.requested` porque o
  // payload é diferente: handoff aqui aponta pra agentKey (não agentId) e
  // carrega conversationId/messageId — o consumidor (Especialista, Sprint
  // 1.3) precisa resolver o agentId em tempo de despacho e ler a mensagem
  // pra contexto.
  'agent.handoff_requested',
  'conversation.intent_changed',
  'agent.escalated_human',
  // Sprint 1.3 — Especialista Operacional. Publica ao final do processamento
  // (respond ou escalate ou clarification). UI escuta pra atualizar lista
  // de conversations sem refetch.
  'specialist.responded',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const isEventType = (value: unknown): value is EventType =>
  typeof value === 'string' && (EVENT_TYPES as readonly string[]).includes(value);

// Payloads --------------------------------------------------------------------

export const TaskCreatedPayload = z.object({
  taskId: z.string().uuid(),
  tenantId: z.string().uuid(),
  traceId: z.string().min(1),
  taskType: z.string().min(1),
  priority: z.number().int().min(1).max(10),
});
export type TaskCreatedPayload = z.infer<typeof TaskCreatedPayload>;

export const TaskAssignedPayload = z.object({
  taskId: z.string().uuid(),
  tenantId: z.string().uuid(),
  agentId: z.string().uuid(),
  department: z.string().min(1),
  traceId: z.string().min(1),
});
export type TaskAssignedPayload = z.infer<typeof TaskAssignedPayload>;

export const TaskStatusChangedPayload = z.object({
  taskId: z.string().uuid(),
  tenantId: z.string().uuid(),
  traceId: z.string().min(1),
  previousStatus: z.string().min(1),
  status: z.string().min(1),
});
export type TaskStatusChangedPayload = z.infer<typeof TaskStatusChangedPayload>;

export const TaskCompletedPayload = z.object({
  taskId: z.string().uuid(),
  tenantId: z.string().uuid(),
  traceId: z.string().min(1),
  department: z.string().min(1).optional(),
  result: z.unknown().optional(),
});
export type TaskCompletedPayload = z.infer<typeof TaskCompletedPayload>;

export const TaskFailedPayload = z.object({
  taskId: z.string().uuid(),
  tenantId: z.string().uuid(),
  traceId: z.string().min(1),
  department: z.string().min(1).optional(),
  error: z.string().min(1),
});
export type TaskFailedPayload = z.infer<typeof TaskFailedPayload>;

export const SubtaskCompletedPayload = z.object({
  parentTaskId: z.string().uuid(),
  taskId: z.string().uuid(),
  tenantId: z.string().uuid(),
  traceId: z.string().min(1),
});
export type SubtaskCompletedPayload = z.infer<typeof SubtaskCompletedPayload>;

export const HandoffRequestedPayload = z.object({
  fromAgentId: z.string().uuid(),
  toAgentId: z.string().uuid().nullable(),
  tenantId: z.string().uuid(),
  taskId: z.string().uuid(),
  traceId: z.string().min(1),
  reason: z.string().min(1),
  payload: z.unknown().optional(),
});
export type HandoffRequestedPayload = z.infer<typeof HandoffRequestedPayload>;

export const AgentStateChangedPayload = z.object({
  agentId: z.string().uuid(),
  tenantId: z.string().uuid(),
  previousState: z.string().min(1),
  state: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});
export type AgentStateChangedPayload = z.infer<typeof AgentStateChangedPayload>;

export const ApprovalCreatedPayload = z.object({
  approvalId: z.string().uuid(),
  tenantId: z.string().uuid(),
  taskId: z.string().uuid(),
  agentId: z.string().uuid(),
  traceId: z.string().min(1),
  actionType: z.string().min(1),
});
export type ApprovalCreatedPayload = z.infer<typeof ApprovalCreatedPayload>;

export const ApprovalResolvedPayload = z.object({
  approvalId: z.string().uuid(),
  tenantId: z.string().uuid(),
  status: z.enum(['approved', 'rejected', 'modified', 'cancelled']),
  reviewerUserId: z.string().uuid().nullable(),
});
export type ApprovalResolvedPayload = z.infer<typeof ApprovalResolvedPayload>;

export const MessageReceivedPayload = z.object({
  tenantId: z.string().uuid(),
  accountId: z.string().uuid(),
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
  channel: z.enum(['email', 'whatsapp', 'simulated_webhook', 'sms']),
});
export type MessageReceivedPayload = z.infer<typeof MessageReceivedPayload>;

export const ChannelSessionStatusChangedPayload = z.object({
  sessionId: z.string().uuid(),
  tenantId: z.string().uuid(),
  // ChannelType específico (adapter) — UI traduz pra abstrato quando precisa.
  channel: z.enum([
    'simulated_webhook',
    'email_imap',
    'whatsapp_evolution',
    'whatsapp_cloud',
  ]),
  previousStatus: z.string().min(1),
  status: z.string().min(1),
});
export type ChannelSessionStatusChangedPayload = z.infer<
  typeof ChannelSessionStatusChangedPayload
>;

// Sprint 1.2 — Eventos do Coordenador de Atendimento ------------------------

/**
 * Coordenador decide encaminhar pra especialista do departamento. Sprint
 * 1.2 só PUBLICA — quem consome é o Especialista (Sprint 1.3+).
 *
 * `toAgentKey` (não `toAgentId`): no momento do handoff, o Coordenador sabe
 * a função (`atendimento.especialista_operacional`), não o UUID do agente
 * naquele tenant. O consumidor resolve via `getAgentByKey`.
 */
export const AgentHandoffRequestedPayload = z.object({
  fromAgentId: z.string().uuid(),
  toAgentKey: z.string().min(1),
  tenantId: z.string().uuid(),
  accountId: z.string().uuid().nullable(),
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
  traceId: z.string().min(1),
  intent: z.string().min(1),
  reasoning: z.string().min(1),
  // Payload livre pro especialista — slot data, contexto, qualquer coisa
  // que o Coordenador queira repassar sem inventar campos novos.
  context: z.record(z.unknown()).default({}),
});
export type AgentHandoffRequestedPayload = z.infer<typeof AgentHandoffRequestedPayload>;

/**
 * Conversation teve intent classificado/atualizado. UI escuta pra atualizar
 * badge sem refetch.
 */
export const ConversationIntentChangedPayload = z.object({
  tenantId: z.string().uuid(),
  conversationId: z.string().uuid(),
  intent: z.string().min(1),
  decision: z.enum([
    'respond_direct',
    'handoff_specialist',
    'escalate_human',
    'ignore',
  ]),
  classificationId: z.string().uuid(),
  confidence: z.number().min(0).max(1).nullable(),
});
export type ConversationIntentChangedPayload = z.infer<
  typeof ConversationIntentChangedPayload
>;

/**
 * Coordenador (ou outro agente no futuro) escalou pra humano. UI escuta pra
 * mostrar badge "aguardando humano" e notificar operador.
 */
export const AgentEscalatedHumanPayload = z.object({
  tenantId: z.string().uuid(),
  agentId: z.string().uuid(),
  conversationId: z.string().uuid(),
  messageId: z.string().uuid().nullable(),
  reason: z.string().min(1),
  intent: z.string().min(1),
  traceId: z.string().min(1),
});
export type AgentEscalatedHumanPayload = z.infer<typeof AgentEscalatedHumanPayload>;

// Sprint 1.3 — Especialista Operacional ------------------------------------

/**
 * Especialista terminou de processar um handoff. Publica sempre, qualquer
 * que tenha sido a `action` (respond/escalate/clarification). UI escuta
 * pra atualizar lista de conversations + inbox de drafts sem refetch.
 *
 * `messageId` é o id da mensagem outbound criada (null em escalate_human
 * caso não tenha mandado T05). `draftId` é o registro em `message_drafts`
 * (sempre criado pra rastreabilidade, mesmo em tier sugestivo da Fase 1
 * onde a mensagem já foi enviada — status='auto_approved').
 */
export const SpecialistRespondedPayload = z.object({
  tenantId: z.string().uuid(),
  conversationId: z.string().uuid(),
  messageId: z.string().uuid().nullable(),
  draftId: z.string().uuid().nullable(),
  agentId: z.string().uuid(),
  agentKey: z.string().min(1),
  traceId: z.string().min(1),
  intent: z.string().min(1),
  action: z.enum(['respond', 'escalate_human', 'request_clarification']),
  // Ids de obligations/documents consultados — útil pra auditoria de UI
  // ("essa resposta foi baseada em obrigação X").
  dataUsed: z.array(z.string()).default([]),
});
export type SpecialistRespondedPayload = z.infer<typeof SpecialistRespondedPayload>;

// Envelope --------------------------------------------------------------------

export const EventEnvelope = z.object({
  type: z.enum(EVENT_TYPES),
  payload: z.unknown(),
  traceId: z.string().min(1),
  timestamp: z.string().min(1),
});
export type EventEnvelope = z.infer<typeof EventEnvelope>;

// -----------------------------------------------------------------------------
// Filas (BullMQ)
//
// Uma fila por TIPO de trabalho, não por departamento (ADR-?). Department vai
// no payload — o handler/roteador decide pra qual agente despachar.
// -----------------------------------------------------------------------------

export const JOB_QUEUES = ['agent-tasks'] as const;
export type JobQueue = (typeof JOB_QUEUES)[number];

export const AgentTaskJobPayload = z.object({
  taskId: z.string().uuid(),
  tenantId: z.string().uuid(),
  traceId: z.string().min(1),
  agentKey: z.string().min(1),
});
export type AgentTaskJobPayload = z.infer<typeof AgentTaskJobPayload>;
