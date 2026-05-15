import type {
  AuthenticatedClient,
  Database,
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
