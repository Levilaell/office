import { describe, expect, it } from 'vitest';
import { incrementRunUsage, RunNotFoundError } from '../index';

type Row = { turns: number; tokens_used: number; cost_usd: number };

/**
 * Fake supabase em memória: guarda 1 row de agent_runs e responde ao chain
 * `from('agent_runs').select(...).eq('id', X).maybeSingle()` e
 * `from('agent_runs').update({...}).eq('id', X).select().maybeSingle()`.
 *
 * Simula o read-modify-write da função real — duas chamadas sequenciais devem
 * ler o valor atualizado pela primeira.
 */
const buildFakeSupabase = (initial: Row | null) => {
  let row: Row | null = initial ? { ...initial } : null;

  const updateOp = (patch: Partial<Row>) => ({
    eq: (_col: string, _val: string) => ({
      select: () => ({
        maybeSingle: async () => {
          if (!row) return { data: null, error: null };
          row = { ...row, ...patch };
          return { data: row, error: null };
        },
      }),
    }),
  });

  const selectOp = () => ({
    eq: (_col: string, _val: string) => ({
      maybeSingle: async () => ({ data: row ? { ...row } : null, error: null }),
    }),
  });

  const from = (_table: string) => ({
    select: selectOp,
    update: updateOp,
  });

  return {
    client: { from } as unknown as Parameters<typeof incrementRunUsage>[0],
    snapshot: () => (row ? { ...row } : null),
  };
};

const RUN_ID = '00000000-0000-0000-0000-0000000000aa';

describe('incrementRunUsage', () => {
  it('soma deltas e usa turns=1 por default quando omitido', async () => {
    const { client, snapshot } = buildFakeSupabase({
      turns: 0,
      tokens_used: 0,
      cost_usd: 0,
    });

    const result = await incrementRunUsage(client, RUN_ID, {
      tokensIn: 100,
      tokensOut: 50,
      costUsd: 0.0012,
    });

    expect(result.turns).toBe(1);
    expect(result.tokens_used).toBe(150);
    expect(result.cost_usd).toBeCloseTo(0.0012, 6);
    expect(snapshot()).toMatchObject({
      turns: 1,
      tokens_used: 150,
    });
  });

  it('duas chamadas sequenciais acumulam corretamente', async () => {
    const { client } = buildFakeSupabase({
      turns: 0,
      tokens_used: 0,
      cost_usd: 0,
    });

    await incrementRunUsage(client, RUN_ID, {
      tokensIn: 100,
      tokensOut: 50,
      costUsd: 0.001,
    });
    const final = await incrementRunUsage(client, RUN_ID, {
      tokensIn: 200,
      tokensOut: 80,
      costUsd: 0.0025,
    });

    expect(final.turns).toBe(2); // 1 + 1
    expect(final.tokens_used).toBe(430); // 150 + 280
    expect(final.cost_usd).toBeCloseTo(0.0035, 6);
  });

  it('respeita turns explícito (incluindo zero pra ações sem LLM)', async () => {
    const { client } = buildFakeSupabase({
      turns: 5,
      tokens_used: 0,
      cost_usd: 0,
    });

    const result = await incrementRunUsage(client, RUN_ID, {
      turns: 0,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
    });

    expect(result.turns).toBe(5);
  });

  it('lança RunNotFoundError quando o run não existe', async () => {
    const { client } = buildFakeSupabase(null);

    await expect(
      incrementRunUsage(client, RUN_ID, {
        tokensIn: 10,
        tokensOut: 5,
        costUsd: 0.0001,
      }),
    ).rejects.toBeInstanceOf(RunNotFoundError);
  });

  it('RunNotFoundError carrega o runId', async () => {
    const { client } = buildFakeSupabase(null);

    try {
      await incrementRunUsage(client, RUN_ID, {
        tokensIn: 1,
        tokensOut: 1,
        costUsd: 0,
      });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(RunNotFoundError);
      expect((err as RunNotFoundError).runId).toBe(RUN_ID);
      expect((err as RunNotFoundError).name).toBe('RunNotFoundError');
    }
  });
});
