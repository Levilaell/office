// =============================================================================
// Worker subscriber do Coordenador de Atendimento.
//
// Subscreve `message.received` em todos os tenants (canal pattern
// `tenant:*`). Pra cada mensagem, cria/atualiza uma task `coordenador_classify`
// e enfileira em `agent-tasks` com `agentKey=atendimento.coordenador`.
//
// Idempotência: `jobId = coord-{messageId}`. BullMQ deduplica — reentregas de
// pubsub (socket reconnect, múltiplas instâncias de agent-runtime) não geram
// classificação duplicada.
//
// Tenant validation: o evento já vem com tenantId; canal do pubsub também
// carrega no nome (`tenant:<id>`). Worker confia no payload Zod e no canal —
// não há fonte adicional a checar nesta camada (downstream o handler valida
// conversation.tenant_id ao montar contexto).
// =============================================================================

import {
  createTask,
  getAgentByKey,
  recordTaskLifecycle,
  type ServiceRoleClient,
} from '@office/shared-domain';
import {
  enqueueAgentTask,
  MessageReceivedPayload,
  subscribeEvents,
  type Subscription,
} from '@office/shared-events';

const log = (msg: string): void =>
  console.log(`[workers/atendimento-coordenador] ${msg}`);

const COORDINATOR_AGENT_KEY = 'atendimento.coordenador';

/**
 * Inicia o subscriber. Retorna a `Subscription` que o caller fecha no
 * shutdown.
 */
export const startCoordinatorSubscriber = (
  supabase: ServiceRoleClient,
): Subscription =>
  subscribeEvents('tenant:*', async (channel, eventType, payload, envelope) => {
    if (eventType !== 'message.received') return;

    const parsed = MessageReceivedPayload.safeParse(payload);
    if (!parsed.success) {
      log(
        `${channel} message.received payload inválido: ${parsed.error.message}`,
      );
      return;
    }

    // Coordenador só roda em mensagens externas de cliente final. Channel
    // `simulated_webhook`, `email`, `whatsapp` e `sms` são os abstractos
    // válidos hoje — todos viáveis.
    const messageReceived = parsed.data;
    const tenantId = messageReceived.tenantId;
    const traceId = envelope.traceId;

    // Verifica se o tenant tem o Coordenador seedado. Se não, ignora —
    // tenants antigos sem o seed novo não devem quebrar processamento.
    const agent = await getAgentByKey(supabase, tenantId, COORDINATOR_AGENT_KEY);
    if (!agent) {
      log(
        `tenant ${tenantId} sem ${COORDINATOR_AGENT_KEY} seedado — pulando (rode pnpm seed:agents)`,
      );
      return;
    }

    const payloadJson = {
      conversationId: messageReceived.conversationId,
      messageId: messageReceived.messageId,
    };

    try {
      const task = await createTask(supabase, {
        tenantId,
        accountId: messageReceived.accountId,
        traceId,
        taskType: 'atendimento.classify',
        priority: 5,
        payload: payloadJson,
        assignedAgentId: agent.id,
      });

      await recordTaskLifecycle(supabase, {
        tenantId,
        accountId: messageReceived.accountId,
        taskId: task.id,
        traceId,
        actor: `system:message_received`,
        action: 'task.created',
        metadata: {
          taskType: 'atendimento.classify',
          agentKey: COORDINATOR_AGENT_KEY,
          messageId: messageReceived.messageId,
        },
      });
      await recordTaskLifecycle(supabase, {
        tenantId,
        accountId: messageReceived.accountId,
        taskId: task.id,
        traceId,
        actor: `system:message_received`,
        action: 'task.assigned',
        metadata: { agentId: agent.id, agentKey: COORDINATOR_AGENT_KEY },
      });

      await enqueueAgentTask(
        {
          taskId: task.id,
          tenantId,
          traceId,
          agentKey: COORDINATOR_AGENT_KEY,
        },
        {
          // Dedup por mensagem. Reentregas viram no-op.
          jobId: `coord-${messageReceived.messageId}`,
        },
      );

      log(
        `enfileirado coordenador task=${task.id} message=${messageReceived.messageId} trace=${traceId}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(
        `falha ao enfileirar coordenador pra message=${messageReceived.messageId}: ${message}`,
      );
    }
  });
