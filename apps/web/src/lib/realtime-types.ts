import type {
  AgentRole,
  AgentState,
  ApprovalStatus,
  AutonomyTier,
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

export type InitialSnapshot = {
  agents: AgentSnapshot[];
  tasks: TaskSnapshot[];
  approvals: ApprovalSnapshot[];
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
