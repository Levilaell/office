export type TenantId = string & { readonly __brand: 'TenantId' };
export type AccountId = string & { readonly __brand: 'AccountId' };
export type UserId = string & { readonly __brand: 'UserId' };
export type AgentId = string & { readonly __brand: 'AgentId' };
export type TraceId = string & { readonly __brand: 'TraceId' };

export type AutonomyTier = 'manual' | 'suggestive' | 'semi_autonomous' | 'autonomous';

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
