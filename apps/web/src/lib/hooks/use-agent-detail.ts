'use client';

import { useEffect, useState } from 'react';
import { fetchAgentMetrics, fetchAgentRuns } from '@/lib/agent-detail-api';
import type {
  AgentMetricsSnapshot,
  AgentMetricsWindow,
  AgentRunSnapshot,
} from '@/lib/realtime-types';

export type UseAgentRunsResult = {
  runs: AgentRunSnapshot[];
  loading: boolean;
  error: string | null;
};

export function useAgentRuns(agentId: string | null): UseAgentRunsResult {
  const [runs, setRuns] = useState<AgentRunSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agentId) {
      setRuns([]);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAgentRuns(agentId, { limit: 10 })
      .then(({ runs: fetched }) => {
        if (!cancelled) setRuns(fetched);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'erro ao carregar runs');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  return { runs, loading, error };
}

export type UseAgentMetricsResult = {
  metrics: AgentMetricsSnapshot | null;
  loading: boolean;
  error: string | null;
};

export function useAgentMetrics(
  agentId: string | null,
  window: AgentMetricsWindow = '7d',
): UseAgentMetricsResult {
  const [metrics, setMetrics] = useState<AgentMetricsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agentId) {
      setMetrics(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAgentMetrics(agentId, window)
      .then(({ metrics: fetched }) => {
        if (!cancelled) setMetrics(fetched);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'erro ao carregar métricas');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId, window]);

  return { metrics, loading, error };
}
