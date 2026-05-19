// =============================================================================
// Teste de act — efeitos colaterais do Especialista Operacional.
//
// Cobre os 3 caminhos de `action` cruzados com os 2 tiers suportados:
//   - respond + sugestivo (default Fase 1)  → draft pending, NÃO envia
//   - respond + semi_autonomo                → envia direto + auto_approved
//   - request_clarification (default tier sugestivo) → draft pending
//   - escalate_human → manda T05/T_NO_DATA DIRETO (sem draft, ADR-017)
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

  it('respond + tier sugestivo: draft pending, NÃO envia outbound, publica draft.created + specialist.responded', async () => {
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
    expect(out.queuedForApproval).toBe(true);
    expect(out.tierApplied).toBe('sugestivo');
    expect(out.outboundMessageId).toBeNull();
    expect(out.draftId).not.toBeNull();

    // Draft criado em status pending com expires_at
    const drafts = fake.tables.message_drafts ?? [];
    expect(drafts).toHaveLength(1);
    const draft = drafts[0];
    expect(draft?.status).toBe('pending');
    expect(draft?.final_message_id).toBeNull();
    expect(draft?.expires_at).not.toBeNull();

    // NÃO mandou mensagem outbound
    const outbound = fake.tables.messages.find((m) => m.direction === 'outbound');
    expect(outbound).toBeUndefined();

    // Eventos publicados — draft.created + specialist.responded
    const types = publishEventMock.mock.calls.map((c) => c[0]);
    expect(types).toContain('draft.created');
    expect(types).toContain('specialist.responded');
    expect(types).not.toContain('agent.escalated_human');

    // Audit_log preenchido com tier_applied + queued_for_approval
    const audits = fake.tables.audit_log.filter(
      (l) => l.action === 'especialista_operacional.responded',
    );
    expect(audits).toHaveLength(1);
    const meta = audits[0]?.metadata as Record<string, unknown>;
    expect(meta.tier_applied).toBe('sugestivo');
    expect(meta.queued_for_approval).toBe(true);
  });

  it('respond + tier semi_autonomo: envia direto, draft auto_approved, sem draft.created', async () => {
    // Configura agente como semi_autonomo.
    if (fake.tables.agents?.[0]) {
      fake.tables.agents[0].autonomy_tier = 'semi_autonomo';
    }
    const out = await act(asClient(fake), {
      context: buildContext(fake),
      response: baseResponse({ action: 'respond' }),
      preDecided: false,
      intent: 'operacional.status_obrigacao',
      runId: RUN,
      traceId: 'trace-1b',
      llmMetrics: {
        promptVersion: 'atendimento.especialista_operacional.respond@1.0.0',
        model: 'claude-sonnet-4-6',
        costUsd: 0.012,
      },
    });

    expect(out.action).toBe('respond');
    expect(out.queuedForApproval).toBe(false);
    expect(out.tierApplied).toBe('semi_autonomo');
    expect(out.outboundMessageId).not.toBeNull();
    expect(out.draftId).not.toBeNull();

    const drafts = fake.tables.message_drafts ?? [];
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.status).toBe('auto_approved');
    expect(drafts[0]?.final_message_id).toBe(out.outboundMessageId);

    const outbound = fake.tables.messages.find((m) => m.direction === 'outbound');
    expect(outbound?.sender_type).toBe('agent');
    expect((outbound?.content as string)).toContain('DAS');

    const types = publishEventMock.mock.calls.map((c) => c[0]);
    expect(types).not.toContain('draft.created');
    expect(types).toContain('specialist.responded');
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

    // Sprint 1.5 (ADR-017): T05 vai DIRETO, sem draft.
    expect(out.draftId).toBeNull();
    const drafts = fake.tables.message_drafts ?? [];
    expect(drafts).toHaveLength(0);

    // Conversation marcada
    const conv = fake.tables.conversations.find((c) => c.id === CONV);
    expect(conv?.metadata).toMatchObject({
      assigned_to_human: true,
      escalated_by_agent_key: 'atendimento.especialista_operacional',
    });

    // T05 mandado direto
    const outbound = fake.tables.messages.find((m) => m.direction === 'outbound');
    expect((outbound?.content as string).toLowerCase()).toContain('alguém da equipe');

    // Eventos
    const types = publishEventMock.mock.calls.map((c) => c[0]);
    expect(types).toContain('agent.escalated_human');
    expect(types).toContain('specialist.responded');
    expect(types).not.toContain('draft.created');

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

  it('request_clarification + tier sugestivo: draft pending, NÃO envia', async () => {
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
    expect(out.queuedForApproval).toBe(true);
    expect(out.tierApplied).toBe('sugestivo');
    expect(out.outboundMessageId).toBeNull();
    expect(out.draftId).not.toBeNull();

    const drafts = fake.tables.message_drafts ?? [];
    expect(drafts[0]?.status).toBe('pending');
    expect((drafts[0]?.proposed_content as string)).toContain('De qual mês');

    const outbound = fake.tables.messages.find((m) => m.direction === 'outbound');
    expect(outbound).toBeUndefined();

    const types = publishEventMock.mock.calls.map((c) => c[0]);
    expect(types).toContain('draft.created');
    expect(types).toContain('specialist.responded');
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
