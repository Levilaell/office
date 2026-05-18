import { beforeEach, describe, expect, it } from 'vitest';
import { FakeSupabase } from './fake-supabase';
import {
  getLastClassification,
  listClassificationsForConversation,
  recordClassification,
} from '../classifications';

// Mesmo padrão dos outros testes do módulo: fake implementa só o subset
// usado pelo domain — cast pra contornar tipos estritos do supabase-js.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asClient = (fake: FakeSupabase): any => fake;

const TENANT_A = '11111111-1111-4000-8000-111111111111';
const CONV_A = '22222222-2222-4000-8000-222222222222';
const AGENT_COORD = '33333333-3333-4000-8000-333333333333';

const seedConversation = (fake: FakeSupabase, id = CONV_A, intent: string | null = null): void => {
  fake.tables.conversations.push({
    id,
    tenant_id: TENANT_A,
    account_id: 'acc-1',
    channel: 'simulated_webhook',
    channel_handle: 'a@x.com',
    status: 'open',
    subject: null,
    intent_current: intent,
    last_message_at: null,
    unread_count: 0,
    metadata: {},
    created_at: '2026-05-19T00:00:00.000Z',
    updated_at: '2026-05-19T00:00:00.000Z',
  });
};

describe('recordClassification', () => {
  let fake: FakeSupabase;
  beforeEach(() => {
    fake = new FakeSupabase();
    seedConversation(fake);
  });

  it('insere row em conversation_classifications e atualiza intent_current da conversation', async () => {
    const row = await recordClassification(asClient(fake), {
      tenantId: TENANT_A,
      conversationId: CONV_A,
      messageId: 'msg-1',
      agentId: AGENT_COORD,
      agentRunId: 'run-1',
      intent: 'social.saudacao',
      confidence: 0.92,
      reasoning: 'mensagem curta com saudação',
      decision: 'respond_direct',
      decisionMetadata: { template: 'T02' },
      promptVersion: 'atendimento.coordenador.classify@1.0.0',
      model: 'claude-sonnet-4-6',
      costUsd: 0.003,
    });

    expect(row.intent).toBe('social.saudacao');
    expect(row.decision).toBe('respond_direct');
    expect(fake.tables.conversation_classifications).toHaveLength(1);

    const conv = fake.tables.conversations.find((r) => r.id === CONV_A);
    expect(conv?.intent_current).toBe('social.saudacao');
  });

  it('aceita confidence null (pre-classify determinístico sem LLM)', async () => {
    const row = await recordClassification(asClient(fake), {
      tenantId: TENANT_A,
      conversationId: CONV_A,
      messageId: 'msg-1',
      agentId: AGENT_COORD,
      agentRunId: null,
      intent: 'requer_humano',
      confidence: null,
      reasoning: 'mensagem não-texto',
      decision: 'escalate_human',
    });

    expect(row.confidence).toBeNull();
    expect(row.decision).toBe('escalate_human');
  });

  it('atualiza intent_current pra última classificação quando mais de uma é registrada', async () => {
    await recordClassification(asClient(fake), {
      tenantId: TENANT_A,
      conversationId: CONV_A,
      messageId: 'msg-1',
      agentId: AGENT_COORD,
      agentRunId: 'run-1',
      intent: 'social.saudacao',
      confidence: 0.95,
      reasoning: 'oi',
      decision: 'respond_direct',
    });
    await recordClassification(asClient(fake), {
      tenantId: TENANT_A,
      conversationId: CONV_A,
      messageId: 'msg-2',
      agentId: AGENT_COORD,
      agentRunId: 'run-2',
      intent: 'operacional.status_obrigacao',
      confidence: 0.78,
      reasoning: 'pergunta sobre DAS',
      decision: 'handoff_specialist',
    });

    expect(fake.tables.conversation_classifications).toHaveLength(2);
    const conv = fake.tables.conversations.find((r) => r.id === CONV_A);
    expect(conv?.intent_current).toBe('operacional.status_obrigacao');
  });
});

describe('getLastClassification', () => {
  it('retorna null quando não há classificação', async () => {
    const fake = new FakeSupabase();
    seedConversation(fake);
    const result = await getLastClassification(asClient(fake), CONV_A);
    expect(result).toBeNull();
  });

  it('retorna a mais recente por created_at DESC', async () => {
    const fake = new FakeSupabase();
    seedConversation(fake);
    fake.tables.conversation_classifications = [
      {
        id: 'cls-1',
        tenant_id: TENANT_A,
        conversation_id: CONV_A,
        agent_id: AGENT_COORD,
        intent: 'social.saudacao',
        decision: 'respond_direct',
        decision_metadata: {},
        confidence: 0.9,
        reasoning: 'oi',
        message_id: null,
        agent_run_id: null,
        prompt_version: null,
        model: null,
        cost_usd: null,
        created_at: '2026-05-19T10:00:00.000Z',
      },
      {
        id: 'cls-2',
        tenant_id: TENANT_A,
        conversation_id: CONV_A,
        agent_id: AGENT_COORD,
        intent: 'operacional.status_obrigacao',
        decision: 'handoff_specialist',
        decision_metadata: { targetAgentKey: 'atendimento.especialista_operacional' },
        confidence: 0.81,
        reasoning: 'DAS',
        message_id: null,
        agent_run_id: null,
        prompt_version: null,
        model: null,
        cost_usd: null,
        created_at: '2026-05-19T11:00:00.000Z',
      },
    ];
    const result = await getLastClassification(asClient(fake), CONV_A);
    expect(result?.id).toBe('cls-2');
    expect(result?.intent).toBe('operacional.status_obrigacao');
  });
});

describe('listClassificationsForConversation', () => {
  it('respeita limit e retorna ordenado por created_at DESC', async () => {
    const fake = new FakeSupabase();
    seedConversation(fake);
    fake.tables.conversation_classifications = [1, 2, 3, 4, 5].map((i) => ({
      id: `cls-${i}`,
      tenant_id: TENANT_A,
      conversation_id: CONV_A,
      agent_id: AGENT_COORD,
      intent: 'social.saudacao',
      decision: 'respond_direct',
      decision_metadata: {},
      confidence: 0.5 + i / 10,
      reasoning: `r${i}`,
      message_id: null,
      agent_run_id: null,
      prompt_version: null,
      model: null,
      cost_usd: null,
      // Datas crescentes — esperamos a mais recente primeiro (cls-5).
      created_at: `2026-05-19T1${i}:00:00.000Z`,
    }));

    const list = await listClassificationsForConversation(asClient(fake), CONV_A, 3);
    expect(list).toHaveLength(3);
    expect(list[0]?.id).toBe('cls-5');
    expect(list[2]?.id).toBe('cls-3');
  });
});
