import { beforeEach, describe, expect, it } from 'vitest';
import { FakeSupabase } from '../../../conversations/__tests__/fake-supabase';
import {
  computeNextStatus,
  createLead,
  getLeadById,
  getLeadByConversationId,
  listLeadsByTenant,
  markLeadDropped,
  markLeadLost,
  markLeadQualified,
  markLeadScheduledPending,
  updateLeadQualificationData,
} from '../index';
import type { LeadSlots } from '../slots';

// Cast pra contornar tipos estritos do supabase-js — fake só implementa o
// subset usado por essas funções.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asClient = (fake: FakeSupabase): any => fake;

const TENANT_A = '11111111-1111-4000-8000-111111111111';
const CONV_A = 'aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaaa';

describe('createLead', () => {
  let fake: FakeSupabase;
  beforeEach(() => {
    fake = new FakeSupabase();
  });

  it('cria em status new com defaults', async () => {
    const lead = await createLead(asClient(fake), {
      tenantId: TENANT_A,
      source: 'simulated_webhook',
      primaryConversationId: CONV_A,
    });

    expect(lead.tenant_id).toBe(TENANT_A);
    expect(lead.source).toBe('simulated_webhook');
    expect(lead.status).toBe('new');
    expect(lead.primary_conversation_id).toBe(CONV_A);
    expect(lead.qualification_data).toEqual({});
    expect(fake.tables.leads).toHaveLength(1);
  });

  it('aceita qualification_data inicial', async () => {
    const lead = await createLead(asClient(fake), {
      tenantId: TENANT_A,
      source: 'manual',
      qualificationData: { contact_name: 'João' },
    });
    expect(lead.qualification_data).toEqual({ contact_name: 'João' });
  });
});

describe('getLeadByConversationId', () => {
  it('retorna null quando não existe', async () => {
    const fake = new FakeSupabase();
    const lead = await getLeadByConversationId(
      asClient(fake),
      TENANT_A,
      CONV_A,
    );
    expect(lead).toBeNull();
  });

  it('retorna lead quando existe', async () => {
    const fake = new FakeSupabase();
    const created = await createLead(asClient(fake), {
      tenantId: TENANT_A,
      source: 'email_imap',
      primaryConversationId: CONV_A,
    });
    const found = await getLeadByConversationId(
      asClient(fake),
      TENANT_A,
      CONV_A,
    );
    expect(found?.id).toBe(created.id);
  });

  it('respeita isolamento de tenant', async () => {
    const fake = new FakeSupabase();
    await createLead(asClient(fake), {
      tenantId: TENANT_A,
      source: 'manual',
      primaryConversationId: CONV_A,
    });
    const other = await getLeadByConversationId(
      asClient(fake),
      '22222222-2222-4000-8000-222222222222',
      CONV_A,
    );
    expect(other).toBeNull();
  });
});

describe('computeNextStatus', () => {
  it('não muda terminal status (converted, lost, dropped)', () => {
    expect(computeNextStatus('converted', {})).toBe('converted');
    expect(computeNextStatus('lost', {})).toBe('lost');
    expect(computeNextStatus('dropped', {})).toBe('dropped');
  });

  it('não regride scheduled_pending mesmo com slots completos', () => {
    expect(
      computeNextStatus('scheduled_pending', {
        contact_name: 'João',
        has_existing_company: false,
        company_size_estimate: 'mei',
        main_pain: 'x',
        decision_timeline: 'urgent',
      }),
    ).toBe('scheduled_pending');
  });

  it('avança new → qualifying ao primeiro slot preenchido', () => {
    expect(computeNextStatus('new', {})).toBe('new');
    expect(computeNextStatus('new', { contact_name: 'João' })).toBe(
      'qualifying',
    );
  });

  it('avança pra qualified quando todos core preenchidos', () => {
    const allFilled: LeadSlots = {
      contact_name: 'João',
      has_existing_company: false,
      company_size_estimate: 'mei',
      main_pain: 'x',
      decision_timeline: 'urgent',
    };
    expect(computeNextStatus('qualifying', allFilled)).toBe('qualified');
    expect(computeNextStatus('new', allFilled)).toBe('qualified');
  });
});

describe('updateLeadQualificationData', () => {
  let fake: FakeSupabase;
  let leadId: string;

  beforeEach(async () => {
    fake = new FakeSupabase();
    const lead = await createLead(asClient(fake), {
      tenantId: TENANT_A,
      source: 'simulated_webhook',
      primaryConversationId: CONV_A,
    });
    leadId = lead.id;
  });

  it('merge incremental — não sobrescreve slots existentes', async () => {
    await updateLeadQualificationData(asClient(fake), leadId, {
      contact_name: 'João',
    });
    const after2 = await updateLeadQualificationData(asClient(fake), leadId, {
      has_existing_company: true,
    });
    expect(after2.lead.qualification_data).toEqual({
      contact_name: 'João',
      has_existing_company: true,
    });
  });

  it('transição new → qualifying no primeiro slot', async () => {
    const result = await updateLeadQualificationData(asClient(fake), leadId, {
      contact_name: 'João',
    });
    expect(result.previousStatus).toBe('new');
    expect(result.lead.status).toBe('qualifying');
    expect(result.statusChanged).toBe(true);
  });

  it('transição → qualified seta qualified_at na primeira vez', async () => {
    const result = await updateLeadQualificationData(asClient(fake), leadId, {
      contact_name: 'João',
      has_existing_company: false,
      company_size_estimate: 'mei',
      main_pain: 'abrir empresa',
      decision_timeline: 'urgent',
    });
    expect(result.lead.status).toBe('qualified');
    expect(result.lead.qualified_at).toBeTruthy();
  });

  it('não sobrescreve qualified_at em updates subsequentes', async () => {
    const first = await updateLeadQualificationData(asClient(fake), leadId, {
      contact_name: 'João',
      has_existing_company: false,
      company_size_estimate: 'mei',
      main_pain: 'x',
      decision_timeline: 'urgent',
    });
    const firstQualifiedAt = first.lead.qualified_at;

    // Update auxiliar não muda status
    const second = await updateLeadQualificationData(asClient(fake), leadId, {
      industry_segment: 'padaria',
    });
    expect(second.lead.qualified_at).toBe(firstQualifiedAt);
    expect(second.statusChanged).toBe(false);
  });

  it('slot "unknown" é tratado como preenchido', async () => {
    const result = await updateLeadQualificationData(asClient(fake), leadId, {
      contact_name: 'João',
      has_existing_company: false,
      company_size_estimate: 'unknown',
      main_pain: 'preciso ajuda',
      decision_timeline: 'unknown',
    });
    expect(result.lead.status).toBe('qualified');
  });

  it('current_regime obrigatório quando has_existing_company=true', async () => {
    const result = await updateLeadQualificationData(asClient(fake), leadId, {
      contact_name: 'João',
      has_existing_company: true,
      company_size_estimate: 'small',
      main_pain: 'x',
      decision_timeline: 'no_rush',
    });
    expect(result.lead.status).toBe('qualifying'); // falta current_regime
  });

  it('lança quando lead não existe', async () => {
    await expect(
      updateLeadQualificationData(
        asClient(fake),
        '00000000-0000-4000-8000-000000000000',
        { contact_name: 'X' },
      ),
    ).rejects.toThrow(/not found/);
  });
});

describe('markLeadQualified', () => {
  it('idempotente — segunda chamada não altera qualified_at', async () => {
    const fake = new FakeSupabase();
    const lead = await createLead(asClient(fake), {
      tenantId: TENANT_A,
      source: 'manual',
    });
    const first = await markLeadQualified(asClient(fake), lead.id);
    expect(first.lead.status).toBe('qualified');
    const firstAt = first.lead.qualified_at;

    const second = await markLeadQualified(asClient(fake), lead.id);
    expect(second.lead.qualified_at).toBe(firstAt);
  });

  it('não regride scheduled_pending pra qualified', async () => {
    const fake = new FakeSupabase();
    const lead = await createLead(asClient(fake), {
      tenantId: TENANT_A,
      source: 'manual',
    });
    await markLeadQualified(asClient(fake), lead.id);
    await markLeadScheduledPending(asClient(fake), lead.id, {});
    const result = await markLeadQualified(asClient(fake), lead.id);
    expect(result.lead.status).toBe('scheduled_pending');
  });
});

describe('markLeadScheduledPending', () => {
  it('transita pra scheduled_pending e seta scheduled_call_at quando passada data', async () => {
    const fake = new FakeSupabase();
    const lead = await createLead(asClient(fake), {
      tenantId: TENANT_A,
      source: 'manual',
    });
    const date = new Date('2026-05-22T14:00:00Z');
    const result = await markLeadScheduledPending(asClient(fake), lead.id, {
      scheduledAt: date,
      notes: 'terça de manhã',
    });
    expect(result.lead.status).toBe('scheduled_pending');
    expect(result.lead.scheduled_call_at).toBe(date.toISOString());
    expect(result.lead.notes).toContain('terça de manhã');
  });

  it('preserva scheduled_call_at null quando data não passada', async () => {
    const fake = new FakeSupabase();
    const lead = await createLead(asClient(fake), {
      tenantId: TENANT_A,
      source: 'manual',
    });
    const result = await markLeadScheduledPending(asClient(fake), lead.id, {
      notes: 'final da semana',
    });
    expect(result.lead.scheduled_call_at).toBeNull();
    expect(result.lead.notes).toContain('final da semana');
  });
});

describe('markLeadLost e markLeadDropped', () => {
  it('lost grava razão e idempotente', async () => {
    const fake = new FakeSupabase();
    const lead = await createLead(asClient(fake), {
      tenantId: TENANT_A,
      source: 'manual',
    });
    const result = await markLeadLost(
      asClient(fake),
      lead.id,
      'fechou com concorrente',
    );
    expect(result.lead.status).toBe('lost');
    expect(result.lead.lost_reason).toBe('fechou com concorrente');

    const again = await markLeadLost(asClient(fake), lead.id, 'outro motivo');
    // idempotente: status já é lost, retorna sem alterar
    expect(again.lead.lost_reason).toBe('fechou com concorrente');
  });

  it('dropped separado de lost', async () => {
    const fake = new FakeSupabase();
    const lead = await createLead(asClient(fake), {
      tenantId: TENANT_A,
      source: 'manual',
    });
    const result = await markLeadDropped(
      asClient(fake),
      lead.id,
      'pediu humano cedo',
    );
    expect(result.lead.status).toBe('dropped');
  });
});

describe('listLeadsByTenant', () => {
  let fake: FakeSupabase;

  beforeEach(async () => {
    fake = new FakeSupabase();
    const a = await createLead(asClient(fake), {
      tenantId: TENANT_A,
      source: 'manual',
    });
    const b = await createLead(asClient(fake), {
      tenantId: TENANT_A,
      source: 'email_imap',
    });
    const c = await createLead(asClient(fake), {
      tenantId: TENANT_A,
      source: 'simulated_webhook',
    });
    await updateLeadQualificationData(asClient(fake), a.id, {
      contact_name: 'A',
    });
    await markLeadQualified(asClient(fake), b.id);
    await markLeadLost(asClient(fake), c.id, 'irrelevante');
  });

  it('lista todos do tenant sem filtro', async () => {
    const all = await listLeadsByTenant(asClient(fake), TENANT_A);
    expect(all).toHaveLength(3);
  });

  it('filtra por status único', async () => {
    const qualified = await listLeadsByTenant(asClient(fake), TENANT_A, {
      status: 'qualified',
    });
    expect(qualified).toHaveLength(1);
    expect(qualified[0]?.status).toBe('qualified');
  });

  it('filtra por múltiplos status (in)', async () => {
    const active = await listLeadsByTenant(asClient(fake), TENANT_A, {
      status: ['qualifying', 'qualified'],
    });
    expect(active).toHaveLength(2);
  });

  it('isolamento — outro tenant não aparece', async () => {
    const other = '99999999-9999-4000-8000-999999999999';
    await createLead(asClient(fake), {
      tenantId: other,
      source: 'manual',
    });
    const mine = await listLeadsByTenant(asClient(fake), TENANT_A);
    expect(mine).toHaveLength(3);
    expect(mine.every((l) => l.tenant_id === TENANT_A)).toBe(true);
  });
});

describe('getLeadById', () => {
  it('null quando não existe', async () => {
    const fake = new FakeSupabase();
    const lead = await getLeadById(
      asClient(fake),
      '00000000-0000-4000-8000-000000000000',
    );
    expect(lead).toBeNull();
  });
});
