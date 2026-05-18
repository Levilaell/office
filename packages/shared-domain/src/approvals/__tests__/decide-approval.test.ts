import { describe, expect, it, vi } from 'vitest';
import { ApprovalRaceConditionError, decideApproval } from '../index';

type MaybeSingleResult = { data: unknown; error: unknown };

// Mock chainable do supabase-js, suficiente pro chain do decideApproval:
//   supabase.from('approvals').update({...}).eq('id', x).eq('status','pending')
//           .select().maybeSingle()
const buildSupabaseMock = (final: MaybeSingleResult) => {
  const maybeSingle = vi.fn().mockResolvedValue(final);
  const select = vi.fn(() => ({ maybeSingle }));
  const eq2 = vi.fn(() => ({ select, eq: eq2 }));
  const eq1 = vi.fn(() => ({ eq: eq2, select }));
  const update = vi.fn(() => ({ eq: eq1 }));
  const from = vi.fn(() => ({ update }));
  return {
    client: { from } as unknown as Parameters<typeof decideApproval>[0],
    spies: { from, update, eq1, eq2, select, maybeSingle },
  };
};

const APPROVAL_ID = '11111111-1111-1111-1111-111111111111';
const REVIEWER_ID = '22222222-2222-2222-2222-222222222222';

const successRow = {
  id: APPROVAL_ID,
  tenant_id: 'tenant-1',
  task_id: 'task-1',
  agent_id: 'agent-1',
  trace_id: 'trace-1',
  action_type: 'send.message',
  proposal: { text: 'oi' },
  context: {},
  status: 'approved',
  reviewer_user_id: REVIEWER_ID,
  decision: { action: 'approve' },
  decided_at: '2026-05-18T12:00:00.000Z',
  expires_at: null,
  created_at: '2026-05-18T11:00:00.000Z',
};

describe('decideApproval', () => {
  it('retorna a row atualizada quando o UPDATE encontra status=pending', async () => {
    const { client, spies } = buildSupabaseMock({ data: successRow, error: null });

    const result = await decideApproval(client, APPROVAL_ID, {
      status: 'approved',
      decision: { action: 'approve' },
      reviewerUserId: REVIEWER_ID,
    });

    expect(result).toEqual(successRow);
    expect(spies.from).toHaveBeenCalledWith('approvals');
    expect(spies.eq1).toHaveBeenCalledWith('id', APPROVAL_ID);
    // Barreira atômica: o segundo .eq filtra status=pending.
    expect(spies.eq2).toHaveBeenCalledWith('status', 'pending');
  });

  it('lança ApprovalRaceConditionError quando maybeSingle retorna null (status já mudou)', async () => {
    // Cobre os dois casos que colapsam pro mesmo retorno do UPDATE filtrado:
    // (a) outra requisição decidiu entre o nosso SELECT inicial e este UPDATE;
    // (b) approval já estava em status != pending (pre-check do route falhou
    //     ou foi bypassado). Ambos terminam aqui com data=null.
    const { client } = buildSupabaseMock({ data: null, error: null });

    await expect(
      decideApproval(client, APPROVAL_ID, {
        status: 'rejected',
        decision: { action: 'reject' },
        reviewerUserId: REVIEWER_ID,
      }),
    ).rejects.toBeInstanceOf(ApprovalRaceConditionError);
  });

  it('ApprovalRaceConditionError carrega o approvalId no payload', async () => {
    const { client } = buildSupabaseMock({ data: null, error: null });

    try {
      await decideApproval(client, APPROVAL_ID, {
        status: 'approved',
        decision: { action: 'approve' },
        reviewerUserId: null,
      });
      expect.unreachable('decideApproval deveria ter lançado');
    } catch (err) {
      expect(err).toBeInstanceOf(ApprovalRaceConditionError);
      expect((err as ApprovalRaceConditionError).approvalId).toBe(APPROVAL_ID);
      expect((err as ApprovalRaceConditionError).name).toBe('ApprovalRaceConditionError');
    }
  });

  it('propaga erro do Supabase sem traduzir pra race', async () => {
    const supabaseError = { message: 'connection lost', code: '08006' };
    const { client } = buildSupabaseMock({ data: null, error: supabaseError });

    await expect(
      decideApproval(client, APPROVAL_ID, {
        status: 'approved',
        decision: { action: 'approve' },
        reviewerUserId: REVIEWER_ID,
      }),
    ).rejects.toBe(supabaseError);
  });
});
