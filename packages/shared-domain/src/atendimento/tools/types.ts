// =============================================================================
// Tipos comuns das tools do Especialista Operacional
//
// Tools são funções read-only que consultam dados canônicos (accounts,
// obligations, documents, messages) e registram audit_log do acesso pra
// rastreabilidade.
// =============================================================================

import type { AuthenticatedClient, ServiceRoleClient } from '@office/shared-db';

export type ToolClient = AuthenticatedClient | ServiceRoleClient;

/**
 * Contexto passado pra cada tool — usado pra gravar audit_log do acesso.
 *
 * `actor` segue convenção do projeto: `agent:<uuid>` ou `user:<uuid>`.
 * `tenantId` é o tenant que originou a consulta (sempre validado contra
 * o tenant_id do recurso lido — service role bypassa RLS).
 */
export type ToolContext = {
  tenantId: string;
  accountId: string;
  actor: string;
  traceId: string;
};

export type AccountSnapshot = {
  id: string;
  tenantId: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  regimeTributario: string | null;
  status: string;
  entities: EntitySnapshot[];
};

export type EntitySnapshot = {
  id: string;
  type: string;
  inscricaoEstadual: string | null;
  inscricaoMunicipal: string | null;
};

export type ObligationSnapshot = {
  id: string;
  type: string;
  category: string;
  description: string | null;
  competencia: string;
  dueDate: string;
  amount: number | null;
  amountPaid: number | null;
  status: string;
  paymentMethod: string | null;
  paymentLink: string | null;
  notes: string | null;
};

export type DocumentSnapshot = {
  id: string;
  type: string;
  category: string;
  description: string | null;
  competencia: string | null;
  referenceDate: string | null;
  status: string;
  receivedAt: string | null;
  processedAt: string | null;
  notes: string | null;
};

export type InteractionSnapshot = {
  id: string;
  conversationId: string;
  channel: string;
  direction: string;
  senderType: string;
  content: string;
  createdAt: string;
};
