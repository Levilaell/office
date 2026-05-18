import type {
  AgentRole,
  AgentState,
  ApprovalStatus,
  AutonomyTier,
  ChannelSessionStatus,
  ChannelType,
  ConversationChannel,
  ConversationStatus,
  Department,
  TaskStatus,
} from '@office/shared-types';

export type AgentTier = 'triage' | 'default' | 'critical';

export type AgentSnapshot = {
  id: string;
  agentKey: string;
  name: string;
  description: string | null;
  department: Department;
  role: AgentRole;
  state: AgentState;
  stateMetadata: Record<string, unknown>;
  tier: AgentTier;
  autonomyTier: AutonomyTier;
};

export type TaskSnapshot = {
  id: string;
  status: TaskStatus;
  taskType: string;
  assignedAgentId: string | null;
  accountId: string | null;
  traceId: string;
  result: unknown;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type ApprovalSnapshot = {
  id: string;
  taskId: string;
  agentId: string;
  status: ApprovalStatus;
  actionType: string;
  proposal: Record<string, unknown>;
  context: Record<string, unknown>;
  reviewerUserId: string | null;
  decision: Record<string, unknown> | null;
  decidedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type ConversationLastDecision =
  | 'respond_direct'
  | 'handoff_specialist'
  | 'escalate_human'
  | 'ignore';

export type ConversationSnapshot = {
  id: string;
  accountId: string;
  channel: ConversationChannel;
  channelHandle: string;
  status: ConversationStatus;
  subject: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  /** Slug hierárquico da última classificação do Coordenador. Null antes da
   *  primeira classificação ou pra conversas que não passam pelo coord. */
  intentCurrent: string | null;
  /** Última decisão do Coordenador. Persistido derivado da última
   *  classificação; UI usa pra badge/cor sem refetch. */
  lastDecision: ConversationLastDecision | null;
  /** Marcador derivado da metadata.assigned_to_human. UI mostra alerta
   *  quando humano precisa atuar. */
  assignedToHuman: boolean;
};

export type ChannelSessionSnapshot = {
  id: string;
  channel: ChannelType;
  status: ChannelSessionStatus;
  identifier: string | null;
  displayName: string | null;
  lastHealthCheck: string | null;
  lastMessageAt: string | null;
  errorDetails: Record<string, unknown> | null;
};

export type LeadStatus =
  | 'new'
  | 'qualifying'
  | 'qualified'
  | 'scheduled_pending'
  | 'converted'
  | 'lost'
  | 'dropped';

export type LeadSnapshot = {
  id: string;
  primaryConversationId: string | null;
  source: string;
  status: LeadStatus;
  /** Slots brutos (chaves do snake_case do banco). UI lê defensivamente
   *  os campos que reconhece — slots novos não quebram render. */
  qualificationData: Record<string, unknown>;
  estimatedValueMonthly: number | null;
  notes: string | null;
  qualifiedAt: string | null;
  scheduledCallAt: string | null;
  convertedAt: string | null;
  lostReason: string | null;
  assignedToUserId: string | null;
  convertedToAccountId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InitialSnapshot = {
  agents: AgentSnapshot[];
  tasks: TaskSnapshot[];
  approvals: ApprovalSnapshot[];
  conversations: ConversationSnapshot[];
  channelSessions: ChannelSessionSnapshot[];
  leads: LeadSnapshot[];
};

export type AgentRunSnapshot = {
  id: string;
  agentId: string;
  taskId: string | null;
  status: 'running' | 'completed' | 'failed' | 'timeout' | 'escalated';
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  turnsUsed: number;
  tokensUsed: number;
  costUsd: number;
  errorMessage: string | null;
  traceId: string;
};

export type AgentMetricsSnapshot = {
  totalRuns: number;
  completed: number;
  failed: number;
  timedOut: number;
  successRate: number;
  avgDurationMs: number | null;
  totalTokens: number;
  totalCostUsd: number;
  avgCostUsd: number;
};

export type AgentMetricsWindow = '24h' | '7d' | '30d';
