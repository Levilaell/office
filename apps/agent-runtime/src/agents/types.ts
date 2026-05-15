import type { Json, ServiceRoleClient } from '@office/shared-domain';

/**
 * Contexto compartilhado por TODA execução de agente. Carrega identidade
 * (tenant, task, run, trace) + cliente Supabase service role + callback pra
 * registrar passos do raciocínio em agent_messages.
 *
 * Service role: o worker não tem JWT de user durante execução. Quem chama é
 * responsável por validar tenant_id contra o payload do job antes de criar o
 * contexto.
 */
export type AgentContext = {
  tenantId: string;
  accountId: string | null;
  taskId: string;
  runId: string;
  traceId: string;
  agentId: string;
  agentKey: string;
  supabase: ServiceRoleClient;
  /**
   * Adiciona uma row em agent_messages com turn_index auto-incrementado.
   * Falha em registrar = falha da operação — não silenciar.
   */
  recordMessage: (role: 'system' | 'user' | 'assistant' | 'tool', content: Json) => Promise<void>;
};

export type AgentHandler<TInput = unknown, TOutput = unknown> = (
  input: TInput,
  ctx: AgentContext,
) => Promise<TOutput>;
