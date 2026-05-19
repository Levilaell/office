import type {
  AuthenticatedClient,
  Database,
  Json,
  ServiceRoleClient,
} from '@office/shared-db';
import type {
  AgentRole,
  AgentState,
  AutonomyTier,
  Department,
} from '@office/shared-types';

export type Agent = Database['public']['Tables']['agents']['Row'];
export type AgentInsert = Database['public']['Tables']['agents']['Insert'];
export type AgentUpdate = Database['public']['Tables']['agents']['Update'];

type AnyClient = AuthenticatedClient | ServiceRoleClient;

export type GetAgentsFilters = {
  department?: Department;
  role?: AgentRole;
  state?: AgentState;
};

export const getAgentById = async (
  supabase: AnyClient,
  agentId: string,
): Promise<Agent | null> => {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const getAgentsByTenant = async (
  supabase: AnyClient,
  tenantId: string,
  filters: GetAgentsFilters = {},
): Promise<Agent[]> => {
  let query = supabase.from('agents').select('*').eq('tenant_id', tenantId);
  if (filters.department) query = query.eq('department', filters.department);
  if (filters.role) query = query.eq('role', filters.role);
  if (filters.state) query = query.eq('state', filters.state);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export type CreateAgentInput = {
  tenantId: string;
  department: Department;
  role: AgentRole;
  agentKey: string;
  name: string;
  description?: string | null;
  tier: 'triage' | 'default' | 'critical';
  autonomyTier?: AutonomyTier;
  budget?: AgentInsert['budget'];
  tools?: AgentInsert['tools'];
};

export const createAgent = async (
  supabase: AnyClient,
  input: CreateAgentInput,
): Promise<Agent> => {
  const insert: AgentInsert = {
    tenant_id: input.tenantId,
    department: input.department,
    role: input.role,
    agent_key: input.agentKey,
    name: input.name,
    description: input.description ?? null,
    tier: input.tier,
    ...(input.autonomyTier !== undefined && { autonomy_tier: input.autonomyTier }),
    ...(input.budget !== undefined && { budget: input.budget }),
    ...(input.tools !== undefined && { tools: input.tools }),
  };
  const { data, error } = await supabase
    .from('agents')
    .insert(insert)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateAgentState = async (
  supabase: AnyClient,
  agentId: string,
  state: AgentState,
  metadata: Json = {},
): Promise<Agent | null> => {
  const { data, error } = await supabase
    .from('agents')
    .update({ state, state_metadata: metadata })
    .eq('id', agentId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
};

export type SupportedAutonomyTierUpdate = 'sugestivo' | 'semi_autonomo';

/**
 * Atualiza autonomy_tier de um agente (RLS valida tenant; caller já
 * deve ter validado permissão de role). Retorna a row antes E depois pra
 * caller gravar audit_log com before/after.
 *
 * Aceita apenas tiers suportados na Fase 1 (sugestivo/semi_autonomo).
 */
export const updateAgentAutonomyTier = async (
  supabase: AnyClient,
  agentId: string,
  tier: SupportedAutonomyTierUpdate,
): Promise<{ before: Agent; after: Agent } | null> => {
  const before = await getAgentById(supabase, agentId);
  if (!before) return null;
  if (before.autonomy_tier === tier) {
    // No-op — não faz UPDATE pra evitar audit/event ruidoso.
    return { before, after: before };
  }
  const { data, error } = await supabase
    .from('agents')
    .update({ autonomy_tier: tier })
    .eq('id', agentId)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { before, after: data };
};

export const getRouterForTenant = async (
  supabase: AnyClient,
  tenantId: string,
): Promise<Agent | null> => {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('role', 'router')
    .eq('department', 'platform')
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const getAgentByKey = async (
  supabase: AnyClient,
  tenantId: string,
  agentKey: string,
): Promise<Agent | null> => {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('agent_key', agentKey)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export { seedDefaultAgentsForTenant } from './seed';
