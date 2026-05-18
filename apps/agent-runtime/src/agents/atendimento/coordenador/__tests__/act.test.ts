// =============================================================================
// Teste de act — efeitos colaterais do Coordenador.
//
// Foca no comportamento de I/O — mensagem outbound enviada, eventos
// publicados, classification registrada, audit_log preenchido. Usa fake
// supabase + mock publishEvent via vi.mock.
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeSupabase } from './fake-supabase.js';
import { act } from '../act.js';
import { decide } from '../decide.js';

vi.mock('@office/shared-events', async (orig) => {
  const original = await orig<typeof import('@office/shared-events')>();
  return {
    ...original,
    publishEvent: vi.fn().mockResolvedValue(undefined),
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asClient = (fake: FakeSupabase): any => fake;

const TENANT = '11111111-1111-4000-8000-111111111111';
const ACCOUNT = '22222222-2222-4000-8000-222222222222';
const CONV = '33333333-3333-4000-8000-333333333333';
const MSG = '44444444-4000-4000-8000-444444444444';
const AGENT = '55555555-5555-4000-8000-555555555555';
const RUN = '66666666-6666-4000-8000-666666666666';

const seedFake = (): FakeSupabase => {
  const fake = new FakeSupabase();
  fake.tables.tenants = [
    {
      id: TENANT,
      name: 'Levi Lael Contábil',
      clerk_org_id: 'org_x',
      display_settings: {},
      status: 'active',
      tier: 'basic',
      created_at: '2026-05-18T00:00:00.000Z',
      updated_at: '2026-05-18T00:00:00.000Z',
    },
  ];
  fake.tables.conversations = [
    {
      id: CONV,
      tenant_id: TENANT,
      account_id: ACCOUNT,
      channel: 'simulated_webhook',
      channel_handle: 'cliente@example.com',
      status: 'open',
      subject: null,
      intent_current: null,
      last_message_at: null,
      unread_count: 1,
      metadata: {},
      created_at: '2026-05-19T00:00:00.000Z',
      updated_at: '2026-05-19T00:00:00.000Z',
    },
  ];
  fake.tables.messages = [
    {
      id: MSG,
      tenant_id: TENANT,
      account_id: ACCOUNT,
      conversation_id: CONV,
      direction: 'inbound',
      sender_type: 'end_client',
      sender_id: null,
      content: 'Bom dia!',
      metadata: { adapter_channel: 'simulated_webhook' },
      created_at: '2026-05-19T10:00:00.000Z',
    },
  ];
  fake.tables.agents = [
    {
      id: AGENT,
      tenant_id: TENANT,
      agent_key: 'atendimento.coordenador',
      role: 'coordinator',
      department: 'atendimento',
      name: 'Coordenador',
      description: null,
      tier: 'default',
      autonomy_tier: 'sugestivo',
      budget: {},
      tools: [],
      state: 'idle',
      state_metadata: {},
      created_at: '2026-05-19T00:00:00.000Z',
      updated_at: '2026-05-19T00:00:00.000Z',
    },
  ];
  fake.tables.conversation_classifications = [];
  fake.tables.audit_log = [];
  return fake;
};

const buildContext = (fake: FakeSupabase) => ({
  conversation: fake.tables.conversations[0] as never,
  message: fake.tables.messages[0] as never,
  history: [],
  coordinatorAgent: (fake.tables.agents ?? [])[0] as never,
  displaySettings: {
    bot_name: 'Levi Lael Contábil',
    signature: 'Equipe Levi Lael',
    business_hours: null,
  },
});

describe('act', () => {
  let fake: FakeSupabase;
  let publishEventMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    fake = seedFake();
    const events = await import('@office/shared-events');
    publishEventMock = events.publishEvent as unknown as ReturnType<typeof vi.fn>;
    publishEventMock.mockClear();
  });

  afterEach(() => {
    publishEventMock?.mockReset();
  });

  it('respond_direct: envia mensagem outbound + registra classification + publica intent_changed', async () => {
    const decision = decide({ intent: 'social.saudacao', confidence: null });
    const out = await act(asClient(fake), {
      context: buildContext(fake),
      decision,
      classification: null,
      classificationError: null,
      preClassifyHandled: true,
      runId: RUN,
      traceId: 'trace-1',
      llmMetrics: null,
    });

    expect(out.decision).toBe('respond_direct');
    expect(out.outboundMessageId).not.toBeNull();
    expect(fake.tables.conversation_classifications).toHaveLength(1);
    const outbound = fake.tables.messages.find(
      (m) => m.direction === 'outbound',
    );
    expect(outbound?.sender_type).toBe('agent');
    expect(outbound?.sender_id).toBe(AGENT);
    expect(typeof outbound?.content).toBe('string');
    expect((outbound?.content as string)).toContain('Levi Lael');

    // Eventos publicados.
    const types = publishEventMock.mock.calls.map((c) => c[0]);
    expect(types).toContain('conversation.intent_changed');
    expect(types).not.toContain('agent.handoff_requested');
    expect(types).not.toContain('agent.escalated_human');
  });

  it('handoff_specialist: publica agent.handoff_requested sem outbound', async () => {
    const decision = decide({ intent: 'operacional.status_obrigacao', confidence: 0.85 });
    const out = await act(asClient(fake), {
      context: buildContext(fake),
      decision,
      classification: {
        intent: 'operacional.status_obrigacao',
        confidence: 0.85,
        reasoning: 'pergunta sobre prazo',
      },
      classificationError: null,
      preClassifyHandled: false,
      runId: RUN,
      traceId: 'trace-2',
      llmMetrics: {
        promptVersion: 'atendimento.coordenador.classify@1.0.0',
        model: 'claude-sonnet-4-6',
        costUsd: 0.003,
      },
    });

    expect(out.decision).toBe('handoff_specialist');
    expect(out.handoffPublished).toBe(true);
    expect(out.outboundMessageId).toBeNull();

    const types = publishEventMock.mock.calls.map((c) => c[0]);
    expect(types).toContain('agent.handoff_requested');
    expect(types).toContain('conversation.intent_changed');
  });

  it('escalate_human: publica escalated_human + marca metadata + manda T05', async () => {
    const decision = decide({ intent: 'urgente', confidence: 0.95 });
    const out = await act(asClient(fake), {
      context: buildContext(fake),
      decision,
      classification: {
        intent: 'urgente',
        confidence: 0.95,
        reasoning: 'palavra urgente + receita',
      },
      classificationError: null,
      preClassifyHandled: false,
      runId: RUN,
      traceId: 'trace-3',
      llmMetrics: {
        promptVersion: 'atendimento.coordenador.classify@1.0.0',
        model: 'claude-sonnet-4-6',
        costUsd: 0.004,
      },
    });

    expect(out.decision).toBe('escalate_human');
    expect(out.escalationPublished).toBe(true);

    const conv = fake.tables.conversations.find((c) => c.id === CONV);
    expect(conv?.metadata).toMatchObject({
      assigned_to_human: true,
      last_decision: 'escalate_human',
    });

    const types = publishEventMock.mock.calls.map((c) => c[0]);
    expect(types).toContain('agent.escalated_human');
    expect(types).toContain('conversation.intent_changed');

    // T05 mandado pro cliente.
    const outbound = fake.tables.messages.find((m) => m.direction === 'outbound');
    expect((outbound?.content as string)).toContain('Levi Lael');
  });

  it('audit_log de coordenador.classified preenchido em qualquer caminho', async () => {
    const decision = decide({ intent: 'social.saudacao', confidence: null });
    await act(asClient(fake), {
      context: buildContext(fake),
      decision,
      classification: null,
      classificationError: null,
      preClassifyHandled: true,
      runId: RUN,
      traceId: 'trace-4',
      llmMetrics: null,
    });

    const audits = fake.tables.audit_log.filter(
      (l) => l.action === 'coordenador.classified',
    );
    expect(audits.length).toBeGreaterThanOrEqual(1);
    expect(audits[0]?.actor).toBe(`agent:${AGENT}`);
    expect((audits[0]?.metadata as Record<string, unknown>).intent).toBe(
      'social.saudacao',
    );
  });
});
