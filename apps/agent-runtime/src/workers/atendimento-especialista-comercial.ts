// =============================================================================
// Worker subscriber do Especialista Comercial.
//
// Subscreve `agent.handoff_requested` em todos os tenants. Filtra por
// `toAgentKey === 'atendimento.especialista_comercial'` — Coordenador
// (Sprint 1.2) publica handoff com essa key pra intents `comercial.lead_novo`
// e `comercial.lead_retorno`.
//
// Idempotência: `jobId = escom-{messageId}` — espelha padrão do Coordenador
// (`coord-{messageId}`). Cada mensagem inbound gera UM job; reentregas de
// pubsub (socket reconnect, múltiplas instâncias) viram no-op.
// =============================================================================

import {
  createTask,
  getAgentByKey,
  recordTaskLifecycle,
  type ServiceRoleClient,
} from '@office/shared-domain';
import {
  enqueueAgentTask,
  AgentHandoffRequestedPayload,
  subscribeEvents,
  type Subscription,
} from '@office/shared-events';

const log = (msg: string): void =>
  console.log(`[workers/atendimento-especialista-comercial] ${msg}`);

const ESPECIALISTA_AGENT_KEY = 'atendimento.especialista_comercial';

export const startEspecialistaComercialSubscriber = (
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
    if (handoff.toAgentKey !== ESPECIALISTA_AGENT_KEY) {
      // Outros handoffs (operacional, etc) — ignora.
      return;
    }

    const tenantId = handoff.tenantId;
    const traceId = envelope.traceId;

    const agent = await getAgentByKey(supabase, tenantId, ESPECIALISTA_AGENT_KEY);
    if (!agent) {
      log(
        `tenant ${tenantId} sem ${ESPECIALISTA_AGENT_KEY} seedado — pulando (rode pnpm seed:agents)`,
      );
      return;
    }

    const payloadJson = {
      conversationId: handoff.conversationId,
      messageId: handoff.messageId,
    };

    try {
      const task = await createTask(supabase, {
        tenantId,
        accountId: handoff.accountId,
        traceId,
        taskType: 'atendimento.qualify_lead',
        priority: 5,
        payload: payloadJson,
        assignedAgentId: agent.id,
      });

      await recordTaskLifecycle(supabase, {
        tenantId,
        accountId: handoff.accountId,
        taskId: task.id,
        traceId,
        actor: `system:agent_handoff`,
        action: 'task.created',
        metadata: {
          taskType: 'atendimento.qualify_lead',
          agentKey: ESPECIALISTA_AGENT_KEY,
          messageId: handoff.messageId,
          fromAgentId: handoff.fromAgentId,
        },
      });
      await recordTaskLifecycle(supabase, {
        tenantId,
        accountId: handoff.accountId,
        taskId: task.id,
        traceId,
        actor: `system:agent_handoff`,
        action: 'task.assigned',
        metadata: { agentId: agent.id, agentKey: ESPECIALISTA_AGENT_KEY },
      });

      await enqueueAgentTask(
        {
          taskId: task.id,
          tenantId,
          traceId,
          agentKey: ESPECIALISTA_AGENT_KEY,
        },
        {
          jobId: `escom-${handoff.messageId}`,
        },
      );

      log(
        `enfileirado especialista_comercial task=${task.id} message=${handoff.messageId} trace=${traceId}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(
        `falha ao enfileirar especialista_comercial pra message=${handoff.messageId}: ${message}`,
      );
    }
  });
