// =============================================================================
// Sprint Fase 2-prep — Router-inbound subscriber.
//
// Subscriber novo (substitui o caminho direto Coordenador→message.received).
// Escuta `message.received`, lê o text do DB, cria task pro Roteador (Fase 0)
// classificar via fluxo normal de agent-tasks. Idempotente via
// `jobId = router-{messageId}`.
//
// Mocka shared-events + shared-domain pra capturar o handler e validar
// efeitos colaterais sem depender de Postgres/Redis.
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startRouterInboundSubscriber } from '../router-inbound.js';
import type {
  EventHandler,
  MessageReceivedPayload,
  Subscription,
} from '@office/shared-events';

const TENANT_ID = '11111111-1111-4000-8000-111111111111';
const ACCOUNT_ID = '22222222-2222-4000-8000-222222222222';
const CONV_ID = '33333333-3333-4000-8000-333333333333';
const MSG_ID = '44444444-4444-4000-8000-444444444444';
const AGENT_ID = '55555555-5555-4000-8000-555555555555';
const TASK_ID = '66666666-6666-4000-8000-666666666666';

let capturedHandler: EventHandler | null = null;
const stopMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@office/shared-events', async (orig) => {
  const original = await orig<typeof import('@office/shared-events')>();
  return {
    ...original,
    subscribeEvents: vi
      .fn()
      .mockImplementation((_pattern: string, handler: EventHandler): Subscription => {
        capturedHandler = handler;
        return { stop: stopMock };
      }),
    enqueueAgentTask: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@office/shared-domain', async (orig) => {
  const original = await orig<typeof import('@office/shared-domain')>();
  return {
    ...original,
    getAgentByKey: vi.fn(),
    getMessageById: vi.fn(),
    createTask: vi.fn(),
    recordTaskLifecycle: vi.fn().mockResolvedValue(undefined),
  };
});

import * as events from '@office/shared-events';
import * as domain from '@office/shared-domain';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fakeSupabase = {} as any;

const ROUTER_AGENT = {
  id: AGENT_ID,
  tenant_id: TENANT_ID,
  agent_key: 'router',
  role: 'router',
  department: 'platform',
  state: 'idle',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const MESSAGE_ROW = {
  id: MSG_ID,
  tenant_id: TENANT_ID,
  conversation_id: CONV_ID,
  content: 'Bom dia, podem confirmar?',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const TASK_ROW = { id: TASK_ID, tenant_id: TENANT_ID };

const buildPayload = (): MessageReceivedPayload => ({
  tenantId: TENANT_ID,
  accountId: ACCOUNT_ID,
  conversationId: CONV_ID,
  messageId: MSG_ID,
  channel: 'simulated_webhook',
});

const buildEnvelope = (
  type: 'message.received' | 'message.routed',
): events.EventEnvelope => ({
  type,
  payload: {},
  traceId: 'trace-test',
  timestamp: '2026-05-19T00:00:00.000Z',
});

describe('router-inbound subscriber', () => {
  beforeEach(() => {
    capturedHandler = null;
    vi.mocked(domain.getAgentByKey).mockReset();
    vi.mocked(domain.getMessageById).mockReset();
    vi.mocked(domain.createTask).mockReset();
    vi.mocked(domain.recordTaskLifecycle).mockClear();
    vi.mocked(events.enqueueAgentTask).mockClear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (events.subscribeEvents as any).mockClear();

    vi.mocked(domain.getAgentByKey).mockResolvedValue(ROUTER_AGENT);
    vi.mocked(domain.getMessageById).mockResolvedValue(MESSAGE_ROW);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(domain.createTask).mockResolvedValue(TASK_ROW as any);

    startRouterInboundSubscriber(fakeSupabase);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('subscribe é chamado com pattern tenant:*', () => {
    expect(events.subscribeEvents).toHaveBeenCalledWith(
      'tenant:*',
      expect.any(Function),
    );
  });

  it('enfileira Roteador com payload completo quando message.received chega', async () => {
    expect(capturedHandler).not.toBeNull();
    await capturedHandler!(
      `tenant:${TENANT_ID}`,
      'message.received',
      buildPayload(),
      buildEnvelope('message.received'),
    );

    expect(domain.getAgentByKey).toHaveBeenCalledWith(
      fakeSupabase,
      TENANT_ID,
      'router',
    );
    expect(domain.getMessageById).toHaveBeenCalledWith(fakeSupabase, MSG_ID);
    expect(domain.createTask).toHaveBeenCalledWith(
      fakeSupabase,
      expect.objectContaining({
        tenantId: TENANT_ID,
        accountId: ACCOUNT_ID,
        taskType: 'router.inbound_classify',
        assignedAgentId: AGENT_ID,
        payload: expect.objectContaining({
          text: MESSAGE_ROW.content,
          conversationId: CONV_ID,
          messageId: MSG_ID,
          accountId: ACCOUNT_ID,
          agentKey: 'router',
        }),
      }),
    );
    expect(events.enqueueAgentTask).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: TASK_ID,
        tenantId: TENANT_ID,
        agentKey: 'router',
      }),
      expect.objectContaining({ jobId: `router-${MSG_ID}` }),
    );
  });

  it('ignora eventos que não são message.received', async () => {
    await capturedHandler!(
      `tenant:${TENANT_ID}`,
      'message.routed',
      {},
      buildEnvelope('message.routed'),
    );
    expect(domain.getAgentByKey).not.toHaveBeenCalled();
  });

  it('quando router NÃO está seedado, log e ignora', async () => {
    vi.mocked(domain.getAgentByKey).mockResolvedValueOnce(null);
    await capturedHandler!(
      `tenant:${TENANT_ID}`,
      'message.received',
      buildPayload(),
      buildEnvelope('message.received'),
    );
    expect(domain.getMessageById).not.toHaveBeenCalled();
    expect(domain.createTask).not.toHaveBeenCalled();
  });

  it('quando message NÃO existe no DB (race/delete), descarta sem criar task', async () => {
    vi.mocked(domain.getMessageById).mockResolvedValueOnce(null);
    await capturedHandler!(
      `tenant:${TENANT_ID}`,
      'message.received',
      buildPayload(),
      buildEnvelope('message.received'),
    );
    expect(domain.createTask).not.toHaveBeenCalled();
  });

  it('quando tenant_id da mensagem no DB diverge do payload, descarta', async () => {
    vi.mocked(domain.getMessageById).mockResolvedValueOnce({
      ...MESSAGE_ROW,
      tenant_id: 'outro-tenant-id',
    });
    await capturedHandler!(
      `tenant:${TENANT_ID}`,
      'message.received',
      buildPayload(),
      buildEnvelope('message.received'),
    );
    expect(domain.createTask).not.toHaveBeenCalled();
  });
});
