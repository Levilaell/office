// =============================================================================
// Tools read-only do Especialista Operacional (Sprint 1.3)
//
// Cada tool:
//   1. Recebe `ToolClient` (RLS quando authenticated; service-role quando
//      worker — caller valida tenant explicitamente nesse caso).
//   2. Recebe `ToolContext` com tenantId/accountId/actor/traceId.
//   3. Lê dados canônicos, retorna struct serializável.
//   4. Grava audit_log com action `tool.read.<nome>` e resource `account:<id>`.
//
// Princípio: tools NÃO escrevem em domínio (read-only). Outbound de mensagem
// não conta como escrita de domínio — é saída de canal externo.
// =============================================================================

export { getAccountSnapshot, type GetAccountSnapshotResult } from './accounts';
export { getObligationsForAccount, type GetObligationsOptions } from './obligations';
export { getDocumentsForAccount, type GetDocumentsOptions } from './documents';
export {
  getRecentInteractionsForAccount,
  type GetRecentInteractionsOptions,
} from './interactions';
export type {
  ToolClient,
  ToolContext,
  AccountSnapshot,
  EntitySnapshot,
  ObligationSnapshot,
  DocumentSnapshot,
  InteractionSnapshot,
} from './types';
