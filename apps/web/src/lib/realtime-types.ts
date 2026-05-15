// Contrato compartilhado entre o realtime store (Sessão A) e o inbox de
// aprovações (Sessão B). Este arquivo é stub temporário neste branch — o
// merge com feat/realtime-store traz a versão definitiva da Sessão A.

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'modified'
  | 'cancelled';

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

export type AgentSnapshot = {
  id: string;
  name: string;
  department: string;
  role: string;
  state: string;
};
