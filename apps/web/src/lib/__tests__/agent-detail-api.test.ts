import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAgentMetrics, fetchAgentRuns } from '../agent-detail-api';
import type { AgentMetricsSnapshot, AgentRunSnapshot } from '../realtime-types';

const AGENT_ID = '00000000-0000-0000-0000-0000000000aa';

const RUN: AgentRunSnapshot = {
  id: '00000000-0000-0000-0000-000000000001',
  agentId: AGENT_ID,
  taskId: '00000000-0000-0000-0000-000000000002',
  status: 'completed',
  startedAt: '2026-05-15T11:00:00.000Z',
  finishedAt: '2026-05-15T11:00:01.800Z',
  durationMs: 1800,
  turnsUsed: 3,
  tokensUsed: 1234,
  costUsd: 0.000777,
  errorMessage: null,
  traceId: 'trace-abc',
};

const METRICS: AgentMetricsSnapshot = {
  totalRuns: 5,
  completed: 5,
  failed: 0,
  timedOut: 0,
  successRate: 1,
  avgDurationMs: 1800,
  totalTokens: 6170,
  totalCostUsd: 0.003885,
  avgCostUsd: 0.000777,
};

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const okResponse = (body: unknown): Response =>
  ({
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response);

const errorResponse = (status: number, body: unknown): Response =>
  ({
    ok: false,
    status,
    json: async () => body,
  } as unknown as Response);

describe('fetchAgentRuns', () => {
  it('faz GET sem query quando params vazios', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ runs: [RUN], nextCursor: null }));
    const result = await fetchAgentRuns(AGENT_ID);
    expect(result).toEqual({ runs: [RUN], nextCursor: null });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(`/api/agents/${AGENT_ID}/runs`);
  });

  it('serializa limit, cursor e status na query string', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ runs: [], nextCursor: null }));
    await fetchAgentRuns(AGENT_ID, {
      limit: 5,
      cursor: '00000000-0000-0000-0000-000000000099',
      status: 'failed',
    });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(
      `/api/agents/${AGENT_ID}/runs?limit=5&cursor=00000000-0000-0000-0000-000000000099&status=failed`,
    );
  });

  it('omite status=all da query string', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ runs: [], nextCursor: null }));
    await fetchAgentRuns(AGENT_ID, { status: 'all' });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(`/api/agents/${AGENT_ID}/runs`);
  });

  it('propaga erro HTTP com mensagem do servidor', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(404, { error: 'agent not found' }));
    await expect(fetchAgentRuns(AGENT_ID)).rejects.toThrow('agent not found');
  });
});

describe('fetchAgentMetrics', () => {
  it('usa window=7d por padrão', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ window: '7d', metrics: METRICS }));
    const result = await fetchAgentMetrics(AGENT_ID);
    expect(result).toEqual({ window: '7d', metrics: METRICS });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(`/api/agents/${AGENT_ID}/metrics?window=7d`);
  });

  it('serializa window=30d quando passado', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ window: '30d', metrics: METRICS }));
    await fetchAgentMetrics(AGENT_ID, '30d');
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(`/api/agents/${AGENT_ID}/metrics?window=30d`);
  });

  it('propaga erro HTTP genérico quando JSON falha', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response);
    await expect(fetchAgentMetrics(AGENT_ID)).rejects.toThrow('metrics failed 500');
  });
});
