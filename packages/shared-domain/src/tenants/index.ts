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

export type CreateTenantResult = {
  tenant: Tenant;
  /** true se INSERT criou row; false se já existia (upsert no-op). Usado
   *  pelo onboarding pra marcar `display_settings.onboarding_completed`
   *  apenas em tenants novos — legados (undefined) continuam vendo o
   *  dashboard direto. */
  created: boolean;
};

export const createTenant = async (
  supabase: ServiceRoleClient,
  input: CreateTenantInput,
): Promise<CreateTenantResult> => {
  // Lookup-then-insert ao invés de upsert, porque queremos saber se foi
  // criação nova (decide se marcamos onboarding_completed=false). Race
  // entre dois callers raramente acontece — onboarding síncrono + webhook
  // Clerk são serializados pelo Clerk Org criação.
  const existing = await supabase
    .from('tenants')
    .select('*')
    .eq('clerk_org_id', input.clerkOrgId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    // Tenant existia. Atualiza apenas o nome (caso Clerk org tenha sido
    // renomeada) sem tocar display_settings.
    const { data, error } = await supabase
      .from('tenants')
      .update({ name: input.name })
      .eq('clerk_org_id', input.clerkOrgId)
      .select()
      .single();
    if (error) throw error;
    return { tenant: data, created: false };
  }

  const { data, error } = await supabase
    .from('tenants')
    .insert({ clerk_org_id: input.clerkOrgId, name: input.name })
    .select()
    .single();
  if (error) {
    // Race com outro caller — outra session criou enquanto fazíamos lookup.
    if (error.code === '23505') {
      const retry = await supabase
        .from('tenants')
        .select('*')
        .eq('clerk_org_id', input.clerkOrgId)
        .single();
      if (retry.error) throw retry.error;
      return { tenant: retry.data, created: false };
    }
    throw error;
  }
  return { tenant: data, created: true };
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
 * Sprint 1.6 — marca `display_settings.onboarding_completed=false` em um
 * tenant. Chamado UMA vez no `createTenant` real (não em upsert).
 *
 * Estratégia explícita: false ≠ undefined. Tenants legados pré-feature
 * ficam undefined; verificação `=== false` no layout do dashboard só
 * redireciona tenants novos. Backfill SQL não é necessário.
 */
export const markTenantOnboardingPending = async (
  supabase: ServiceRoleClient,
  tenantId: string,
): Promise<void> => {
  const current = await supabase
    .from('tenants')
    .select('display_settings')
    .eq('id', tenantId)
    .single();
  if (current.error) throw current.error;
  const merged = {
    ...((current.data.display_settings as Record<string, unknown> | null) ?? {}),
    onboarding_completed: false,
  };
  const { error } = await supabase
    .from('tenants')
    .update({ display_settings: merged })
    .eq('id', tenantId);
  if (error) throw error;
};

/**
 * Sprint 1.6 — patch incremental em `display_settings` aplicado pelo wizard
 * de onboarding. Aceita campos parciais e mergea com o existente. Marca
 * `onboarding_completed=true` sempre — fim do fluxo.
 */
export const completeTenantOnboarding = async (
  supabase: AnyClient,
  tenantId: string,
  patch: Record<string, unknown>,
): Promise<Tenant> => {
  const current = await supabase
    .from('tenants')
    .select('display_settings')
    .eq('id', tenantId)
    .single();
  if (current.error) throw current.error;
  const merged = {
    ...((current.data.display_settings as Record<string, unknown> | null) ?? {}),
    ...patch,
    onboarding_completed: true,
  };
  const { data, error } = await supabase
    .from('tenants')
    .update({ display_settings: merged })
    .eq('id', tenantId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

/**
 * Helper puro para verificar se um tenant precisa passar pelo wizard.
 * `=== false` estrito — undefined/true/missing key passam direto.
 */
export const tenantNeedsOnboarding = (
  displaySettings: unknown,
): boolean => {
  if (!displaySettings || typeof displaySettings !== 'object') return false;
  const v = (displaySettings as Record<string, unknown>).onboarding_completed;
  return v === false;
};

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
