// =============================================================================
// Worker subscriber do Especialista Operacional.
//
// Subscreve `agent.handoff_requested` em todos os tenants (canal pattern
// `tenant:*`). Filtra por `toAgentKey === 'atendimento.especialista_operacional'`.
//
// Pra cada handoff aplicável, cria task `atendimento.especialista_operacional`
// e enfileira em `agent-tasks` com `agentKey=atendimento.especialista_operacional`.
//
// Idempotência: `jobId = spec-op-{messageId}`. Distinto do prefix do
// Coordenador (`coord-{messageId}`) — mesma mensagem pode acionar Coord e
// Especialista sem colisão de dedup.
//
// Tenant validation: payload do Zod já validado, e canal carrega tenantId.
// Worker confia no canal pra leitura imediata do tenantId; handler downstream
// valida conversation.tenant_id ao montar contexto.
// =============================================================================

import {
  createTask,
  getAgentByKey,
  recordTaskLifecycle,
  type ServiceRoleClient,
} from '@office/shared-domain';
import {
  AgentHandoffRequestedPayload,
  enqueueAgentTask,
  subscribeEvents,
  type Subscription,
} from '@office/shared-events';

const log = (msg: string): void =>
  console.log(`[workers/atendimento-especialista-operacional] ${msg}`);

const SPECIALIST_AGENT_KEY = 'atendimento.especialista_operacional';

export const startEspecialistaOperacionalSubscriber = (
  supabase: ServiceRoleClient,
): Subscription =>
  subscribeEvents('tenant:*', async (channel, eventType, payload, envelope) => {
    if (eventType !== 'agent.handoff_requested') return;

    const parsed = AgentHandoffRequestedPayload.safeParse(payload);
    if (!parsed.success) {
      log(
        `${channel} agent.handoff_requested payload inválido: ${parsed.error.message}`,
      );
      return;
    }
    const handoff = parsed.data;
    if (handoff.toAgentKey !== SPECIALIST_AGENT_KEY) return;

    const tenantId = handoff.tenantId;
    const traceId = envelope.traceId;

    // Tenant tem o Especialista seedado? Se não, ignora (tenants antigos
    // sem o seed novo não devem quebrar processamento).
    const agent = await getAgentByKey(supabase, tenantId, SPECIALIST_AGENT_KEY);
    if (!agent) {
      log(
        `tenant ${tenantId} sem ${SPECIALIST_AGENT_KEY} seedado — pulando (rode pnpm seed:agents)`,
      );
      return;
    }

    const payloadJson = {
      conversationId: handoff.conversationId,
      messageId: handoff.messageId,
      intent: handoff.intent,
    };

    try {
      const task = await createTask(supabase, {
        tenantId,
        accountId: handoff.accountId,
        traceId,
        taskType: 'atendimento.especialista_operacional',
        priority: 5,
        payload: payloadJson,
        assignedAgentId: agent.id,
      });

      await recordTaskLifecycle(supabase, {
        tenantId,
        accountId: handoff.accountId,
        taskId: task.id,
        traceId,
        actor: 'system:agent_handoff_requested',
        action: 'task.created',
        metadata: {
          taskType: 'atendimento.especialista_operacional',
          agentKey: SPECIALIST_AGENT_KEY,
          messageId: handoff.messageId,
          intent: handoff.intent,
          fromAgentId: handoff.fromAgentId,
        },
      });
      await recordTaskLifecycle(supabase, {
        tenantId,
        accountId: handoff.accountId,
        taskId: task.id,
        traceId,
        actor: 'system:agent_handoff_requested',
        action: 'task.assigned',
        metadata: { agentId: agent.id, agentKey: SPECIALIST_AGENT_KEY },
      });

      await enqueueAgentTask(
        {
          taskId: task.id,
          tenantId,
          traceId,
          agentKey: SPECIALIST_AGENT_KEY,
        },
        {
          // Dedup por (messageId + agentKey) — prefix distinto do Coord.
          jobId: `spec-op-${handoff.messageId}`,
        },
      );

      log(
        `enfileirado especialista task=${task.id} message=${handoff.messageId} intent=${handoff.intent} trace=${traceId}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(
        `falha ao enfileirar especialista pra message=${handoff.messageId}: ${message}`,
      );
    }
  });
