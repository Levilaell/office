import type {
  AuthenticatedClient,
  Database,
  ServiceRoleClient,
} from '@office/shared-db';
import type {
  AgentRole,
  AutonomyTier,
  Department,
} from '@office/shared-types';

type AnyClient = AuthenticatedClient | ServiceRoleClient;
type AgentInsert = Database['public']['Tables']['agents']['Insert'];

type DefaultAgentDefinition = {
  agentKey: string;
  role: AgentRole;
  department: Department;
  name: string;
  description: string;
  tier: 'triage' | 'default' | 'critical';
  autonomyTier: AutonomyTier;
  budget: { maxTokens: number; maxCostUsd: number; maxTurns: number };
  tools: string[];
};

const DEFAULT_AGENTS: DefaultAgentDefinition[] = [
  {
    agentKey: 'router',
    role: 'router',
    department: 'platform',
    name: 'Roteador',
    description:
      'Recebe mensagens externas e classifica em qual departamento devem ser atendidas.',
    tier: 'triage',
    autonomyTier: 'autonomo',
    budget: { maxTokens: 1500, maxCostUsd: 0.02, maxTurns: 1 },
    tools: [],
  },
];

/**
 * Cria (ou mantém) os agentes padrão de um tenant.
 *
 * Idempotente: upsert por (tenant_id, agent_key). Reentregas do webhook do
 * Clerk ou chamadas duplicadas pelo onboarding síncrono convergem ao mesmo
 * estado final sem erro.
 *
 * IMPORTANTE: campos sensíveis a configuração por tenant (autonomy_tier,
 * budget, tier) NÃO são sobrescritos em re-runs — o ON CONFLICT atualiza
 * apenas name/description/role/department/tools, preservando customizações
 * feitas pelo dono do escritório.
 */
export const seedDefaultAgentsForTenant = async (
  supabase: AnyClient,
  tenantId: string,
): Promise<void> => {
  const rows: AgentInsert[] = DEFAULT_AGENTS.map((def) => ({
    tenant_id: tenantId,
    agent_key: def.agentKey,
    role: def.role,
    department: def.department,
    name: def.name,
    description: def.description,
    tier: def.tier,
    autonomy_tier: def.autonomyTier,
    budget: def.budget,
    tools: def.tools,
  }));

  const { error } = await supabase
    .from('agents')
    .upsert(rows, {
      onConflict: 'tenant_id,agent_key',
      ignoreDuplicates: false,
    });
  if (error) throw error;
};
