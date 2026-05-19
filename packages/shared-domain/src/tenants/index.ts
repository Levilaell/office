import type {
  AuthenticatedClient,
  Database,
  ServiceRoleClient,
} from '@office/shared-db';

export type Tenant = Database['public']['Tables']['tenants']['Row'];
export type TenantInsert = Database['public']['Tables']['tenants']['Insert'];
export type TenantUpdate = Database['public']['Tables']['tenants']['Update'];

type AnyClient = AuthenticatedClient | ServiceRoleClient;

export const getTenantByClerkOrgId = async (
  supabase: AnyClient,
  clerkOrgId: string,
): Promise<Tenant | null> => {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('clerk_org_id', clerkOrgId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const getCurrentTenant = async (supabase: AnyClient): Promise<Tenant | null> => {
  // Como o JWT do user já carrega o claim 'o.id' e a RLS de tenants filtra
  // por id = current_tenant_id(), basta um SELECT sem WHERE — o RLS retorna
  // no máximo 1 linha (o tenant ativo).
  const { data, error } = await supabase.from('tenants').select('*').maybeSingle();
  if (error) throw error;
  return data;
};

export type CreateTenantInput = {
  clerkOrgId: string;
  name: string;
};

export const createTenant = async (
  supabase: ServiceRoleClient,
  input: CreateTenantInput,
): Promise<Tenant> => {
  // Idempotente: se outro caller (webhook ou onboarding sync) já criou,
  // só atualiza o nome e retorna a linha existente.
  const { data, error } = await supabase
    .from('tenants')
    .upsert(
      { clerk_org_id: input.clerkOrgId, name: input.name },
      { onConflict: 'clerk_org_id' },
    )
    .select()
    .single();

  if (error) throw error;
  return data;
};

export type UpdateTenantInput = {
  clerkOrgId: string;
  name?: string;
  status?: Tenant['status'];
};

export const updateTenantByClerkOrgId = async (
  supabase: ServiceRoleClient,
  { clerkOrgId, ...patch }: UpdateTenantInput,
): Promise<Tenant | null> => {
  const { data, error } = await supabase
    .from('tenants')
    .update(patch)
    .eq('clerk_org_id', clerkOrgId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
};

export type LinkUserToTenantInput = {
  tenantId: string;
  userId: string;
  role: Database['public']['Tables']['tenant_users']['Row']['role'];
};

export const linkUserToTenant = async (
  supabase: ServiceRoleClient,
  { tenantId, userId, role }: LinkUserToTenantInput,
): Promise<void> => {
  const { error } = await supabase
    .from('tenant_users')
    .upsert(
      { tenant_id: tenantId, user_id: userId, role },
      { onConflict: 'tenant_id,user_id' },
    );

  if (error) throw error;
};

export const unlinkUserFromTenant = async (
  supabase: ServiceRoleClient,
  { tenantId, userId }: { tenantId: string; userId: string },
): Promise<void> => {
  const { error } = await supabase
    .from('tenant_users')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('user_id', userId);

  if (error) throw error;
};

export type TenantRole =
  Database['public']['Tables']['tenant_users']['Row']['role'];

/**
 * Lê o role do user no tenant ativo. RLS na tabela `tenant_users` filtra por
 * `tenant_id = current_tenant_id()` (ver migration 20260515073314_rls_policies),
 * então mesmo se o user fizer membership em N tenants, só vemos a linha do
 * tenant corrente do JWT. `.maybeSingle()` é seguro.
 *
 * Retorna null se user não tem membership no tenant ativo.
 *
 * Usado em endpoints que exigem permissão (mudar tier de autonomia,
 * configurações sensíveis): rejeita se role não está na whitelist.
 */
export const getCurrentTenantUserRole = async (
  supabase: AnyClient,
  userId: string,
): Promise<TenantRole | null> => {
  const { data, error } = await supabase
    .from('tenant_users')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.role as TenantRole | undefined) ?? null;
};
