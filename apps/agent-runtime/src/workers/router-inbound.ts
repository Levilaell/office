// =============================================================================
// Worker subscriber do Roteador no caminho de mensagens inbound.
//
// Sprint Fase 2-prep — supersedes ADR-019. Antes desta sprint, o Coordenador
// de Atendimento subscrevia `message.received` direto e classificava toda
// mensagem como Atendimento. Com o Roteador no caminho:
//
//   message.received  →  router-inbound enfileira task agentKey=router
//                        worker pega → runRouter classifica
//                        graph node `publish` emite `message.routed`
//                        Coordenadores filtram por destinationDepartment
//
// Path independente do legacy de TRIAGENS internas (Fase 0), que continua
// usando `enqueueTriagem` direto via API.
//
// Idempotência: `jobId = router-{messageId}`. BullMQ deduplica reentregas
// de pubsub (socket reconnect, múltiplas instâncias de agent-runtime).
//
// Falhas de schema/payload: log e ignora — não bloqueia o worker. Mensagem
// fica sem roteamento, vai ser visível no audit_log pela ausência de
// `message.routed` correspondente.
// =============================================================================

import {
  createTask,
  getAgentByKey,
  getMessageById,
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
  console.log(`[workers/router-inbound] ${msg}`);

const ROUTER_AGENT_KEY = 'router';

/**
 * Inicia o subscriber. Retorna a `Subscription` que o caller fecha no
 * shutdown.
 */
export const startRouterInboundSubscriber = (
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

    const messageReceived = parsed.data;
    const tenantId = messageReceived.tenantId;
    const traceId = envelope.traceId;

    // Verifica que o tenant tem Roteador seedado (Fase 0). Tenant antigo sem
    // seed deveria ter sido coberto por `pnpm seed:agents` — se chegou aqui
    // sem agente, o operador precisa rodar o seed. Não enfileira pra evitar
    // task perpétua sem dono.
    const router = await getAgentByKey(supabase, tenantId, ROUTER_AGENT_KEY);
    if (!router) {
      log(
        `tenant ${tenantId} sem ${ROUTER_AGENT_KEY} seedado — pulando (rode pnpm seed:agents)`,
      );
      return;
    }

    // Lê o conteúdo da mensagem do DB. `MessageReceivedPayload` carrega só
    // ids — texto vive em `messages.content`. Padrão da triagem é a task
    // carregar `text` no payload pra Roteador permanecer stateless (não
    // precisa de acesso a tabelas dentro do graph).
    const message = await getMessageById(supabase, messageReceived.messageId);
    if (!message) {
      log(
        `message ${messageReceived.messageId} não encontrada — descartando (race condition ou delete)`,
      );
      return;
    }
    if (message.tenant_id !== tenantId) {
      log(
        `tenant mismatch message=${messageReceived.messageId} payload=${tenantId} db=${message.tenant_id}`,
      );
      return;
    }

    try {
      const task = await createTask(supabase, {
        tenantId,
        accountId: messageReceived.accountId,
        traceId,
        taskType: 'router.inbound_classify',
        priority: 5,
        payload: {
          text: message.content,
          accountId: messageReceived.accountId,
          conversationId: messageReceived.conversationId,
          messageId: messageReceived.messageId,
          agentKey: ROUTER_AGENT_KEY,
        },
        assignedAgentId: router.id,
      });

      await recordTaskLifecycle(supabase, {
        tenantId,
        accountId: messageReceived.accountId,
        taskId: task.id,
        traceId,
        actor: 'system:message_received',
        action: 'task.created',
        metadata: {
          taskType: 'router.inbound_classify',
          agentKey: ROUTER_AGENT_KEY,
          messageId: messageReceived.messageId,
          conversationId: messageReceived.conversationId,
        },
      });
      await recordTaskLifecycle(supabase, {
        tenantId,
        accountId: messageReceived.accountId,
        taskId: task.id,
        traceId,
        actor: 'system:message_received',
        action: 'task.assigned',
        metadata: { agentId: router.id, agentKey: ROUTER_AGENT_KEY },
      });

      await enqueueAgentTask(
        {
          taskId: task.id,
          tenantId,
          traceId,
          agentKey: ROUTER_AGENT_KEY,
        },
        {
          // Dedup por mensagem. Reentregas viram no-op.
          jobId: `router-${messageReceived.messageId}`,
        },
      );

      log(
        `enfileirado roteamento task=${task.id} message=${messageReceived.messageId} trace=${traceId}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(
        `falha ao enfileirar roteamento pra message=${messageReceived.messageId}: ${message}`,
      );
    }
  });
