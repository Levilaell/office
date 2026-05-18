import { describe, expect, it } from 'vitest';
import { preDetect } from '../pre-detect';

const buildLead = (overrides: Partial<{ status: string }>) =>
  ({
    id: 'lead-1',
    tenant_id: 't1',
    primary_contact_id: null,
    primary_conversation_id: 'conv-1',
    source: 'simulated_webhook',
    source_metadata: {},
    status: overrides.status ?? 'new',
    qualification_data: {},
    estimated_value_monthly: null,
    notes: null,
    assigned_to_user_id: null,
    converted_to_account_id: null,
    qualified_at: null,
    scheduled_call_at: null,
    converted_at: null,
    lost_reason: null,
    created_at: '2026-05-19T00:00:00Z',
    updated_at: '2026-05-19T00:00:00Z',
  }) as never;

describe('preDetect', () => {
  it('run_llm quando lead é null (primeiro turno)', () => {
    const r = preDetect({ lead: null, currentMessage: 'oi' });
    expect(r.kind).toBe('run_llm');
  });

  it('run_llm pra lead em new', () => {
    const r = preDetect({
      lead: buildLead({ status: 'new' }),
      currentMessage: 'sou o João',
    });
    expect(r.kind).toBe('run_llm');
  });

  it('run_llm pra lead em qualifying', () => {
    const r = preDetect({
      lead: buildLead({ status: 'qualifying' }),
      currentMessage: 'tenho uma padaria',
    });
    expect(r.kind).toBe('run_llm');
  });

  it('schedule_response quando lead qualified + mensagem com horário', () => {
    const r = preDetect({
      lead: buildLead({ status: 'qualified' }),
      currentMessage: 'terça de manhã fica bom pra mim',
    });
    expect(r.kind).toBe('schedule_response');
  });

  it('schedule_response detecta "às 14h"', () => {
    const r = preDetect({
      lead: buildLead({ status: 'qualified' }),
      currentMessage: 'pode ser amanhã às 14h?',
    });
    expect(r.kind).toBe('schedule_response');
  });

  it('schedule_response detecta "amanhã"', () => {
    const r = preDetect({
      lead: buildLead({ status: 'qualified' }),
      currentMessage: 'amanhã está bom',
    });
    expect(r.kind).toBe('schedule_response');
  });

  it('run_llm quando qualified mas mensagem sem horário (cliente faz outra pergunta)', () => {
    const r = preDetect({
      lead: buildLead({ status: 'qualified' }),
      currentMessage: 'antes preciso saber quanto custa o serviço',
    });
    expect(r.kind).toBe('run_llm');
  });

  it('silent_handoff quando lead em scheduled_pending', () => {
    const r = preDetect({
      lead: buildLead({ status: 'scheduled_pending' }),
      currentMessage: 'qualquer coisa',
    });
    expect(r.kind).toBe('silent_handoff');
    if (r.kind === 'silent_handoff') {
      expect(r.reason).toContain('scheduled_pending');
    }
  });

  it('silent_handoff quando lead em converted', () => {
    const r = preDetect({
      lead: buildLead({ status: 'converted' }),
      currentMessage: 'oi',
    });
    expect(r.kind).toBe('silent_handoff');
  });

  it('silent_handoff quando lead em lost', () => {
    const r = preDetect({
      lead: buildLead({ status: 'lost' }),
      currentMessage: 'oi',
    });
    expect(r.kind).toBe('silent_handoff');
  });

  it('silent_handoff quando lead em dropped', () => {
    const r = preDetect({
      lead: buildLead({ status: 'dropped' }),
      currentMessage: 'oi',
    });
    expect(r.kind).toBe('silent_handoff');
  });
});
