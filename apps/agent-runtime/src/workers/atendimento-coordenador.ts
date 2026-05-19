// =============================================================================
// Worker subscriber do Coordenador de Atendimento.
//
// Sprint Fase 2-prep (supersedes ADR-019): subscreve `message.routed` filtrado
// por `destinationDepartment === 'atendimento'`. Antes desta sprint o
// Coordenador escutava `message.received` direto — válido quando Atendimento
// era o único departamento. Com o Roteador no caminho, mensagens classificadas
// pra outros departamentos não entram aqui.
//
// Mensagens routedas pra departamentos sem Coordenador implementado (todos
// exceto Atendimento na Fase 2-prep) ficam sem consumer — comportamento
// esperado e simétrico ao caso anterior ao Sprint 1.2.
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
  MessageRoutedPayload,
  subscribeEvents,
  type Subscription,
} from '@office/shared-events';

const log = (msg: string): void =>
  console.log(`[workers/atendimento-coordenador] ${msg}`);

const COORDINATOR_AGENT_KEY = 'atendimento.coordenador';
const TARGET_DEPARTMENT = 'atendimento';

/**
 * Inicia o subscriber. Retorna a `Subscription` que o caller fecha no
 * shutdown.
 */
export const startCoordinatorSubscriber = (
  supabase: ServiceRoleClient,
): Subscription => {
  log(`subscribed to message.routed on tenant:* (filter=${TARGET_DEPARTMENT})`);
  return subscribeEvents('tenant:*', async (channel, eventType, payload, envelope) => {
    if (eventType !== 'message.routed') return;

    const parsed = MessageRoutedPayload.safeParse(payload);
    if (!parsed.success) {
      log(
        `${channel} message.routed payload inválido: ${parsed.error.message}`,
      );
      return;
    }

    const routed = parsed.data;
    if (routed.destinationDepartment !== TARGET_DEPARTMENT) {
      // Mensagem pra outro departamento. Log informativo (não silencioso) —
      // sem isso, operador vê message.routed no audit_log e estranha que
      // "nada aconteceu", sem entender que o Coordenador filtrou (esperado).
      // Log permanente: Fase 2-prep só implementa Coordenador de Atendimento;
      // qualquer outro depto cai aqui até o sprint da Fase 2 ativá-lo.
      log(
        `ignorando dept=${routed.destinationDepartment} (Coordenador só processa ${TARGET_DEPARTMENT}) msg=${routed.messageId} trace=${envelope.traceId}`,
      );
      return;
    }

    const tenantId = routed.tenantId;
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
      conversationId: routed.conversationId,
      messageId: routed.messageId,
    };

    try {
      const task = await createTask(supabase, {
        tenantId,
        accountId: routed.accountId,
        traceId,
        taskType: 'atendimento.classify',
        priority: 5,
        payload: payloadJson,
        assignedAgentId: agent.id,
      });

      await recordTaskLifecycle(supabase, {
        tenantId,
        accountId: routed.accountId,
        taskId: task.id,
        traceId,
        actor: 'system:message_routed',
        action: 'task.created',
        metadata: {
          taskType: 'atendimento.classify',
          agentKey: COORDINATOR_AGENT_KEY,
          messageId: routed.messageId,
          destinationDepartment: routed.destinationDepartment,
        },
      });
      await recordTaskLifecycle(supabase, {
        tenantId,
        accountId: routed.accountId,
        taskId: task.id,
        traceId,
        actor: 'system:message_routed',
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
          jobId: `coord-${routed.messageId}`,
        },
      );

      log(
        `enfileirado coordenador task=${task.id} message=${routed.messageId} trace=${traceId}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(
        `falha ao enfileirar coordenador pra message=${routed.messageId}: ${message}`,
      );
    }
  });
};
