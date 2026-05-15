'use client';

// Stub temporário do realtime store. O merge com feat/realtime-store
// (Sessão A) substitui este arquivo pela versão real, que conecta no
// socket e mantém o cache reativo. Aqui retornamos listas vazias /
// undefined pra o branch B compilar e a UI renderizar o empty state.

import type { AgentSnapshot, ApprovalSnapshot } from './realtime-types';

export function usePendingApprovals(): ApprovalSnapshot[] {
  return [];
}

export function useApproval(_id: string): ApprovalSnapshot | undefined {
  return undefined;
}

export function useAgent(_id: string): AgentSnapshot | undefined {
  return undefined;
}
