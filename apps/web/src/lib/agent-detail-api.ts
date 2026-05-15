'use client';

import type {
  AgentMetricsSnapshot,
  AgentMetricsWindow,
  AgentRunSnapshot,
} from '@/lib/realtime-types';

export type FetchAgentRunsParams = {
  limit?: number;
  cursor?: string;
  status?: 'all' | 'completed' | 'failed' | 'running';
};

export type FetchAgentRunsResult = {
  runs: AgentRunSnapshot[];
  nextCursor: string | null;
};

export type FetchAgentMetricsResult = {
  window: AgentMetricsWindow;
  metrics: AgentMetricsSnapshot;
};

const readError = async (res: Response): Promise<string> => {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error ?? `${res.status}`;
};

export async function fetchAgentRuns(
  agentId: string,
  params: FetchAgentRunsParams = {},
): Promise<FetchAgentRunsResult> {
  const qs = new URLSearchParams();
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.status && params.status !== 'all') qs.set('status', params.status);
  const query = qs.toString();
  const res = await fetch(`/api/agents/${agentId}/runs${query ? `?${query}` : ''}`);
  if (!res.ok) {
    throw new Error(`runs failed ${await readError(res)}`);
  }
  return res.json() as Promise<FetchAgentRunsResult>;
}

export async function fetchAgentMetrics(
  agentId: string,
  window: AgentMetricsWindow = '7d',
): Promise<FetchAgentMetricsResult> {
  const res = await fetch(`/api/agents/${agentId}/metrics?window=${window}`);
  if (!res.ok) {
    throw new Error(`metrics failed ${await readError(res)}`);
  }
  return res.json() as Promise<FetchAgentMetricsResult>;
}
