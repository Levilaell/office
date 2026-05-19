// =============================================================================
// Sprint Fase 2-prep — Coordenador subscriber filtra por destinationDepartment.
//
// Antes desta sprint (ADR-019, superseded) o Coordenador escutava
// `message.received` direto. Após o refactor, escuta `message.routed` e
// processa só quando `destinationDepartment === 'atendimento'`.
//
// Este teste mocka `@office/shared-events` pra capturar o handler que o
// subscriber registrou; em seguida invoca o handler manualmente com payloads
// distintos e verifica os efeitos colaterais (createTask, enqueueAgentTask).
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startCoordinatorSubscriber } from '../atendimento-coordenador.js';
import type {
  EventHandler,
  MessageRoutedPayload,
  Subscription,
} from '@office/shared-events';

const TENANT_ID = '11111111-1111-4000-8000-111111111111';
const ACCOUNT_ID = '22222222-2222-4000-8000-222222222222';
const CONV_ID = '33333333-3333-4000-8000-333333333333';
const MSG_ID = '44444444-4444-4000-8000-444444444444';
const AGENT_ID = '55555555-5555-4000-8000-555555555555';
const TASK_ID = '66666666-6666-4000-8000-666666666666';
const ROUTER_ID = '77777777-7777-4000-8000-777777777777';

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
    createTask: vi.fn(),
    recordTaskLifecycle: vi.fn().mockResolvedValue(undefined),
  };
});

// Importa após mocks pra resolver imports já mockados.
import * as events from '@office/shared-events';
import * as domain from '@office/shared-domain';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fakeSupabase = {} as any;

const COORDINATOR_AGENT = {
  id: AGENT_ID,
  tenant_id: TENANT_ID,
  agent_key: 'atendimento.coordenador',
  role: 'coordinator',
  department: 'atendimento',
  state: 'idle',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const TASK_ROW = { id: TASK_ID, tenant_id: TENANT_ID };

const buildPayload = (
  destinationDepartment: MessageRoutedPayload['destinationDepartment'],
): MessageRoutedPayload => ({
  tenantId: TENANT_ID,
  accountId: ACCOUNT_ID,
  conversationId: CONV_ID,
  messageId: MSG_ID,
  destinationDepartment,
  confidence: 0.9,
  reasoning: 'teste',
  classifiedBy: ROUTER_ID,
});

const buildEnvelope = (
  type: 'message.routed' | 'message.received',
): events.EventEnvelope => ({
  type,
  payload: {},
  traceId: 'trace-test',
  timestamp: '2026-05-19T00:00:00.000Z',
});

describe('atendimento-coordenador subscriber — filtro por destinationDepartment', () => {
  beforeEach(() => {
    capturedHandler = null;
    vi.mocked(domain.getAgentByKey).mockReset();
    vi.mocked(domain.createTask).mockReset();
    vi.mocked(domain.recordTaskLifecycle).mockClear();
    vi.mocked(events.enqueueAgentTask).mockClear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (events.subscribeEvents as any).mockClear();

    vi.mocked(domain.getAgentByKey).mockResolvedValue(COORDINATOR_AGENT);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(domain.createTask).mockResolvedValue(TASK_ROW as any);

    startCoordinatorSubscriber(fakeSupabase);
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

  it('cria task quando destinationDepartment === "atendimento"', async () => {
    expect(capturedHandler).not.toBeNull();
    await capturedHandler!(
      `tenant:${TENANT_ID}`,
      'message.routed',
      buildPayload('atendimento'),
      buildEnvelope('message.routed'),
    );

    expect(domain.getAgentByKey).toHaveBeenCalledWith(
      fakeSupabase,
      TENANT_ID,
      'atendimento.coordenador',
    );
    expect(domain.createTask).toHaveBeenCalledTimes(1);
    expect(domain.createTask).toHaveBeenCalledWith(
      fakeSupabase,
      expect.objectContaining({
        tenantId: TENANT_ID,
        accountId: ACCOUNT_ID,
        taskType: 'atendimento.classify',
        assignedAgentId: AGENT_ID,
      }),
    );
    expect(events.enqueueAgentTask).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: TASK_ID,
        tenantId: TENANT_ID,
        agentKey: 'atendimento.coordenador',
      }),
      expect.objectContaining({ jobId: `coord-${MSG_ID}` }),
    );
  });

  it('NÃO cria task quando destinationDepartment !== "atendimento" (filtro respeitado)', async () => {
    const otherDepartments: MessageRoutedPayload['destinationDepartment'][] = [
      'societario',
      'pessoal',
      'contabil',
      'fiscal',
      'financeiro_interno',
      'platform',
    ];
    for (const dep of otherDepartments) {
      await capturedHandler!(
        `tenant:${TENANT_ID}`,
        'message.routed',
        buildPayload(dep),
        buildEnvelope('message.routed'),
      );
    }
    expect(domain.getAgentByKey).not.toHaveBeenCalled();
    expect(domain.createTask).not.toHaveBeenCalled();
    expect(events.enqueueAgentTask).not.toHaveBeenCalled();
  });

  it('ignora eventos que não são message.routed (ex: message.received residual)', async () => {
    await capturedHandler!(
      `tenant:${TENANT_ID}`,
      'message.received',
      { tenantId: TENANT_ID, conversationId: CONV_ID, messageId: MSG_ID },
      buildEnvelope('message.received'),
    );
    expect(domain.getAgentByKey).not.toHaveBeenCalled();
    expect(domain.createTask).not.toHaveBeenCalled();
  });

  it('quando coordenador NÃO está seedado no tenant, log e ignora sem criar task', async () => {
    vi.mocked(domain.getAgentByKey).mockResolvedValueOnce(null);

    await capturedHandler!(
      `tenant:${TENANT_ID}`,
      'message.routed',
      buildPayload('atendimento'),
      buildEnvelope('message.routed'),
    );

    expect(domain.getAgentByKey).toHaveBeenCalledOnce();
    expect(domain.createTask).not.toHaveBeenCalled();
    expect(events.enqueueAgentTask).not.toHaveBeenCalled();
  });
});
