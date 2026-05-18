import type {
  AuthenticatedClient,
  Database,
  Json,
  ServiceRoleClient,
} from '@office/shared-db';
import type { ApprovalStatus } from '@office/shared-types';

export type Approval = Database['public']['Tables']['approvals']['Row'];
export type ApprovalInsert = Database['public']['Tables']['approvals']['Insert'];

type AnyClient = AuthenticatedClient | ServiceRoleClient;

export type CreateApprovalInput = {
  tenantId: string;
  taskId: string;
  agentId: string;
  traceId: string;
  actionType: string;
  proposal: Json;
  context?: Json;
  expiresAt?: string | null;
};

export const createApproval = async (
  supabase: AnyClient,
  input: CreateApprovalInput,
): Promise<Approval> => {
  const insert: ApprovalInsert = {
    tenant_id: input.tenantId,
    task_id: input.taskId,
    agent_id: input.agentId,
    trace_id: input.traceId,
    action_type: input.actionType,
    proposal: input.proposal,
    ...(input.context !== undefined && { context: input.context }),
    expires_at: input.expiresAt ?? null,
  };
  const { data, error } = await supabase
    .from('approvals')
    .insert(insert)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getApprovalById = async (
  supabase: AnyClient,
  approvalId: string,
): Promise<Approval | null> => {
  const { data, error } = await supabase
    .from('approvals')
    .select('*')
    .eq('id', approvalId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export type GetPendingApprovalsFilters = {
  agentId?: string;
  taskId?: string;
  limit?: number;
};

export const getPendingApprovals = async (
  supabase: AnyClient,
  tenantId: string,
  filters: GetPendingApprovalsFilters = {},
): Promise<Approval[]> => {
  let query = supabase
    .from('approvals')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (filters.agentId) query = query.eq('agent_id', filters.agentId);
  if (filters.taskId) query = query.eq('task_id', filters.taskId);
  if (filters.limit) query = query.limit(filters.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
};

export type DecideApprovalInput = {
  status: Exclude<ApprovalStatus, 'pending'>;
  decision: Json;
  reviewerUserId: string | null;
};

/**
 * Lançada quando um decideApproval atinge zero rows — alguma outra requisição
 * já tirou a approval de `pending` entre o nosso SELECT e o UPDATE. Caller
 * traduz pra HTTP 409. Fecha TD-004.
 */
export class ApprovalRaceConditionError extends Error {
  override readonly name = 'ApprovalRaceConditionError';
  constructor(public readonly approvalId: string) {
    super(`approval ${approvalId} já foi decidida por outra requisição`);
  }
}

export const decideApproval = async (
  supabase: AnyClient,
  approvalId: string,
  { status, decision, reviewerUserId }: DecideApprovalInput,
): Promise<Approval> => {
  // Filtro `.eq('status', 'pending')` é a barreira atômica contra race:
  // dois reviewers clicando ao mesmo tempo entram aqui, mas só o primeiro
  // UPDATE encontra status=pending — o segundo retorna zero linhas e vira
  // ApprovalRaceConditionError pro caller. Sem isso, o segundo silently
  // sobrescreve a decisão do primeiro.
  const { data, error } = await supabase
    .from('approvals')
    .update({
      status,
      decision,
      reviewer_user_id: reviewerUserId,
      decided_at: new Date().toISOString(),
    })
    .eq('id', approvalId)
    .eq('status', 'pending')
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApprovalRaceConditionError(approvalId);
  return data;
};
