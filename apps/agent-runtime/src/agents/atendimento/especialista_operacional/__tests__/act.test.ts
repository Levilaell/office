// =============================================================================
// Teste de act — efeitos colaterais do Especialista Operacional.
//
// Cobre os 3 caminhos de `action`:
//   - respond: cria draft + envia outbound + marca auto_approved + eventos
//   - request_clarification: similar
//   - escalate_human: marca conversation + manda T05/T_NO_DATA + eventos
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeSupabase } from '../../coordenador/__tests__/fake-supabase.js';
import { act } from '../act.js';
import type { EspecialistaResponse } from '../graph.js';
import type { EspecialistaOperacionalContext } from '../tools/context.js';

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
      content: 'Quando vence meu DAS?',
      metadata: { adapter_channel: 'simulated_webhook' },
      created_at: '2026-05-19T10:00:00.000Z',
    },
  ];
  fake.tables.agents = [
    {
      id: AGENT,
      tenant_id: TENANT,
      agent_key: 'atendimento.especialista_operacional',
      role: 'specialist',
      department: 'atendimento',
      name: 'Especialista Operacional',
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
  fake.tables.message_drafts = [];
  fake.tables.audit_log = [];
  return fake;
};

const buildContext = (fake: FakeSupabase): EspecialistaOperacionalContext => ({
  conversation: fake.tables.conversations[0] as never,
  message: fake.tables.messages[0] as never,
  history: [],
  specialistAgent: (fake.tables.agents ?? [])[0] as never,
  displaySettings: {
    bot_name: 'Levi Lael Contábil',
    signature: 'Equipe Levi Lael',
    business_hours: null,
  },
  accountSnapshot: {
    id: ACCOUNT,
    tenantId: TENANT,
    cnpj: '12.345.678/0001-90',
    razaoSocial: 'Padaria Teste LTDA',
    nomeFantasia: null,
    regimeTributario: 'simples_nacional',
    status: 'active',
    entities: [],
  },
  accountUnavailableReason: null,
});

const baseResponse = (
  partial: Partial<EspecialistaResponse> = {},
): EspecialistaResponse => ({
  action: 'respond',
  content: 'DAS de outubro vence dia 20/10. Valor: R$ 487,30.',
  template_used: 'T06',
  data_used: ['ob-uuid-1'],
  confidence: 0.92,
  reasoning: 'consultou obligations e renderizou status',
  ...partial,
});

describe('especialista_operacional/act', () => {
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

  it('respond: cria draft, envia outbound, marca auto_approved, publica specialist.responded', async () => {
    const out = await act(asClient(fake), {
      context: buildContext(fake),
      response: baseResponse({ action: 'respond' }),
      preDecided: false,
      intent: 'operacional.status_obrigacao',
      runId: RUN,
      traceId: 'trace-1',
      llmMetrics: {
        promptVersion: 'atendimento.especialista_operacional.respond@1.0.0',
        model: 'claude-sonnet-4-6',
        costUsd: 0.012,
      },
    });

    expect(out.action).toBe('respond');
    expect(out.outboundMessageId).not.toBeNull();
    expect(out.draftId).not.toBeNull();

    // Draft criado e marcado como auto_approved
    const drafts = fake.tables.message_drafts ?? [];
    expect(drafts).toHaveLength(1);
    const draft = drafts[0];
    expect(draft?.status).toBe('auto_approved');
    expect(draft?.final_message_id).toBe(out.outboundMessageId);

    // Outbound message criada
    const outbound = fake.tables.messages.find((m) => m.direction === 'outbound');
    expect(outbound?.sender_type).toBe('agent');
    expect((outbound?.content as string)).toContain('DAS');

    // Eventos publicados
    const types = publishEventMock.mock.calls.map((c) => c[0]);
    expect(types).toContain('specialist.responded');
    expect(types).not.toContain('agent.escalated_human');

    // Audit_log preenchido
    const audits = fake.tables.audit_log.filter(
      (l) => l.action === 'especialista_operacional.responded',
    );
    expect(audits).toHaveLength(1);
    expect(audits[0]?.actor).toBe(`agent:${AGENT}`);
  });

  it('escalate_human (default): manda T05, patch conversation, publica eventos', async () => {
    const out = await act(asClient(fake), {
      context: buildContext(fake),
      response: baseResponse({
        action: 'escalate_human',
        content: undefined,
        template_used: null,
        escalation_reason: 'cliente perguntou sobre auditoria, fora do escopo',
        data_used: [],
      }),
      preDecided: false,
      intent: 'operacional.duvida_geral',
      runId: RUN,
      traceId: 'trace-2',
      llmMetrics: null,
    });

    expect(out.action).toBe('escalate_human');
    expect(out.escalationPublished).toBe(true);
    expect(out.noDataPath).toBe(false);

    // Conversation marcada
    const conv = fake.tables.conversations.find((c) => c.id === CONV);
    expect(conv?.metadata).toMatchObject({
      assigned_to_human: true,
      escalated_by_agent_key: 'atendimento.especialista_operacional',
    });

    // T05 mandado
    const outbound = fake.tables.messages.find((m) => m.direction === 'outbound');
    expect((outbound?.content as string).toLowerCase()).toContain('alguém da equipe');

    // Eventos
    const types = publishEventMock.mock.calls.map((c) => c[0]);
    expect(types).toContain('agent.escalated_human');
    expect(types).toContain('specialist.responded');

    // Audit
    const audits = fake.tables.audit_log.filter(
      (l) => l.action === 'especialista_operacional.responded',
    );
    expect(audits).toHaveLength(1);
  });

  it('escalate_human (sem dados): usa T_NO_DATA + noDataPath=true', async () => {
    const out = await act(asClient(fake), {
      context: buildContext(fake),
      response: baseResponse({
        action: 'escalate_human',
        content: undefined,
        template_used: null,
        escalation_reason: 'sem dados disponíveis pra responder',
        data_used: [],
      }),
      preDecided: false,
      intent: 'operacional.status_obrigacao',
      runId: RUN,
      traceId: 'trace-3',
      llmMetrics: null,
    });

    expect(out.noDataPath).toBe(true);

    const outbound = fake.tables.messages.find((m) => m.direction === 'outbound');
    expect((outbound?.content as string).toLowerCase()).toContain('não consegui encontrar');
  });

  it('request_clarification: envia content como mensagem, publica respondido', async () => {
    const out = await act(asClient(fake), {
      context: buildContext(fake),
      response: baseResponse({
        action: 'request_clarification',
        content: 'De qual mês você está perguntando o DAS?',
        template_used: null,
      }),
      preDecided: false,
      intent: 'operacional.status_obrigacao',
      runId: RUN,
      traceId: 'trace-4',
      llmMetrics: {
        promptVersion: 'atendimento.especialista_operacional.respond@1.0.0',
        model: 'claude-sonnet-4-6',
        costUsd: 0.008,
      },
    });

    expect(out.action).toBe('request_clarification');
    expect(out.outboundMessageId).not.toBeNull();

    const outbound = fake.tables.messages.find((m) => m.direction === 'outbound');
    expect((outbound?.content as string)).toContain('De qual mês');

    const types = publishEventMock.mock.calls.map((c) => c[0]);
    expect(types).toContain('specialist.responded');
    expect(types).not.toContain('agent.escalated_human');
  });

  it('preDecided=true (curto-circuito sem LLM) é registrado no audit', async () => {
    const out = await act(asClient(fake), {
      context: buildContext(fake),
      response: baseResponse({
        action: 'escalate_human',
        content: undefined,
        template_used: null,
        escalation_reason: 'conversation sem account vinculada',
      }),
      preDecided: true,
      intent: 'operacional.status_obrigacao',
      runId: RUN,
      traceId: 'trace-5',
      llmMetrics: null,
    });

    expect(out.action).toBe('escalate_human');
    const audit = fake.tables.audit_log.find(
      (l) => l.action === 'especialista_operacional.responded',
    );
    expect((audit?.metadata as { pre_decided: boolean }).pre_decided).toBe(true);
  });
});
