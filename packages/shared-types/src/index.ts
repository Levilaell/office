export type TenantId = string & { readonly __brand: 'TenantId' };
export type AccountId = string & { readonly __brand: 'AccountId' };
export type UserId = string & { readonly __brand: 'UserId' };
export type AgentId = string & { readonly __brand: 'AgentId' };
export type TraceId = string & { readonly __brand: 'TraceId' };

export interface AuditContext {
  traceId: TraceId;
  tenantId: TenantId;
  accountId?: AccountId;
  actor: { kind: 'user'; userId: UserId } | { kind: 'agent'; agentId: AgentId } | { kind: 'system' };
}

export const ROLES = [
  'owner_tenant',
  'manager',
  'operator',
  'end_client',
  'ai_supervisor',
] as const;

export type Role = (typeof ROLES)[number];

export const isRole = (value: unknown): value is Role =>
  typeof value === 'string' && (ROLES as readonly string[]).includes(value);

// -----------------------------------------------------------------------------
// Enums de agentes (Sprint 0.3b). Espelham os CHECKs das migrations
// agents/tasks/agent_runs/agent_messages/approvals.
// -----------------------------------------------------------------------------
export const DEPARTMENTS = [
  'atendimento',
  'societario',
  'pessoal',
  'contabil',
  'fiscal',
  'financeiro_interno',
  'platform',
] as const;
export type Department = (typeof DEPARTMENTS)[number];
export const isDepartment = (value: unknown): value is Department =>
  typeof value === 'string' && (DEPARTMENTS as readonly string[]).includes(value);

export const AGENT_ROLES = ['router', 'coordinator', 'specialist', 'supervisor'] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];
export const isAgentRole = (value: unknown): value is AgentRole =>
  typeof value === 'string' && (AGENT_ROLES as readonly string[]).includes(value);

export const AGENT_STATES = ['idle', 'working', 'awaiting_approval', 'error', 'paused'] as const;
export type AgentState = (typeof AGENT_STATES)[number];
export const isAgentState = (value: unknown): value is AgentState =>
  typeof value === 'string' && (AGENT_STATES as readonly string[]).includes(value);

export const AUTONOMY_TIERS = ['manual', 'sugestivo', 'semi_autonomo', 'autonomo'] as const;
export type AutonomyTier = (typeof AUTONOMY_TIERS)[number];
export const isAutonomyTier = (value: unknown): value is AutonomyTier =>
  typeof value === 'string' && (AUTONOMY_TIERS as readonly string[]).includes(value);

export const TASK_STATUSES = [
  'pending',
  'assigned',
  'in_progress',
  'awaiting_approval',
  'completed',
  'failed',
  'cancelled',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const isTaskStatus = (value: unknown): value is TaskStatus =>
  typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);

export const RUN_STATUSES = ['running', 'completed', 'failed', 'escalated', 'timeout'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];
export const isRunStatus = (value: unknown): value is RunStatus =>
  typeof value === 'string' && (RUN_STATUSES as readonly string[]).includes(value);

export const APPROVAL_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'modified',
  'cancelled',
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
export const isApprovalStatus = (value: unknown): value is ApprovalStatus =>
  typeof value === 'string' && (APPROVAL_STATUSES as readonly string[]).includes(value);

export * from './conversations';
