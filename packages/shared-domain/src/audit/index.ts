import type {
  AuthenticatedClient,
  Database,
  Json,
  ServiceRoleClient,
} from '@office/shared-db';

export type AuditLogRow = Database['public']['Tables']['audit_log']['Row'];
export type AuditLogInsert = Database['public']['Tables']['audit_log']['Insert'];

type AnyClient = AuthenticatedClient | ServiceRoleClient;

export type AuditEntryInput = Omit<AuditLogInsert, 'id' | 'created_at'>;

export const appendAuditLog = async (
  supabase: AnyClient,
  entry: AuditEntryInput,
): Promise<void> => {
  const { error } = await supabase.from('audit_log').insert(entry);
  if (error) throw error;
};

export type TaskLifecycleAction =
  | 'task.created'
  | 'task.assigned'
  | 'task.completed'
  | 'task.failed';

export type RecordTaskLifecycleInput = {
  tenantId: string;
  accountId?: string | null;
  taskId: string;
  traceId: string;
  actor: string;
  action: TaskLifecycleAction;
  metadata?: Json;
};

/**
 * Atalho pra registrar mudança de ciclo de vida de uma task no audit_log.
 * Centraliza o shape padrão (resource = `task:<UUID>`) e evita variação por
 * caller. Falha de insert propaga — auditoria não pode ser silenciada.
 */
export const recordTaskLifecycle = async (
  supabase: AnyClient,
  input: RecordTaskLifecycleInput,
): Promise<void> => {
  await appendAuditLog(supabase, {
    trace_id: input.traceId,
    tenant_id: input.tenantId,
    account_id: input.accountId ?? null,
    actor: input.actor,
    action: input.action,
    resource: `task:${input.taskId}`,
    metadata: input.metadata ?? {},
  });
};
