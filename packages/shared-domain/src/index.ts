export interface HealthResult {
  ok: true;
}

export const health = (): HealthResult => ({ ok: true });

// Re-exports do shared-db pra cumprir ADR-002: apps importam apenas
// shared-domain, nunca shared-db diretamente.
export {
  createAuthenticatedClient,
  createServiceRoleClient,
  type AuthenticatedClient,
  type AuthenticatedClientConfig,
  type ServiceRoleClient,
  type ServiceRoleClientConfig,
  type Database,
  type Json,
} from '@office/shared-db';

export * from './tenants/index';
export * from './users/index';
export * from './audit/index';
export * from './llm/audit';
export * from './agents/index';
export * from './tasks/index';
export * from './runs/index';
export * from './approvals/index';
export * from './conversations/index';
