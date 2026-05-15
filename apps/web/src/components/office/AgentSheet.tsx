'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useAgentMetrics, useAgentRuns } from '@/lib/hooks/use-agent-detail';
import { useAgent } from '@/lib/realtime-store';
import type {
  AgentMetricsSnapshot,
  AgentMetricsWindow,
  AgentRunSnapshot,
  AgentSnapshot,
} from '@/lib/realtime-types';
import { relativeTime } from '@/lib/relative-time';
import { cn } from '@/lib/utils';
import type { AgentState } from '@office/shared-types';

const STATE_LABEL: Record<AgentState, string> = {
  idle: 'Ocioso',
  working: 'Trabalhando',
  awaiting_approval: 'Aguardando aprovação',
  error: 'Erro',
  paused: 'Pausado',
};

const STATE_CLASS: Record<AgentState, string> = {
  idle: 'bg-neutral-500/15 text-neutral-300 border-neutral-500/30',
  working: 'bg-green-500/15 text-green-400 border-green-500/30',
  awaiting_approval: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  error: 'bg-red-500/15 text-red-400 border-red-500/30',
  paused: 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30',
};

const DEPT_LABEL: Record<AgentSnapshot['department'], string> = {
  platform: 'Plataforma',
  atendimento: 'Atendimento',
  societario: 'Societário',
  pessoal: 'Pessoal',
  contabil: 'Contábil',
  fiscal: 'Fiscal',
  financeiro_interno: 'Financeiro Interno',
};

const ROLE_LABEL: Record<AgentSnapshot['role'], string> = {
  router: 'Roteador',
  coordinator: 'Coordenador',
  specialist: 'Especialista',
  supervisor: 'Supervisor',
};

const TIER_LABEL: Record<AgentSnapshot['tier'], string> = {
  triage: 'Triagem (Haiku)',
  default: 'Padrão (Sonnet)',
  critical: 'Crítico (Opus)',
};

const AUTONOMY_LABEL: Record<AgentSnapshot['autonomyTier'], string> = {
  manual: 'Manual',
  sugestivo: 'Sugestivo',
  semi_autonomo: 'Semi-autônomo',
  autonomo: 'Autônomo',
};

const RUN_STATUS_LABEL: Record<AgentRunSnapshot['status'], string> = {
  running: 'Em execução',
  completed: 'Concluído',
  failed: 'Falhou',
  timeout: 'Timeout',
  escalated: 'Escalado',
};

const RUN_STATUS_CLASS: Record<AgentRunSnapshot['status'], string> = {
  running: 'bg-blue-500/15 text-blue-300 border-blue-500/30 animate-pulse',
  completed: 'bg-green-500/15 text-green-400 border-green-500/30',
  failed: 'bg-red-500/15 text-red-400 border-red-500/30',
  timeout: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  escalated: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
};

const WINDOW_OPTIONS: { value: AgentMetricsWindow; label: string }[] = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
];

const formatDurationMs = (ms: number | null): string => {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds - minutes * 60);
  return `${minutes}m ${seconds}s`;
};

const formatCostUsd = (cost: number): string => {
  if (!Number.isFinite(cost) || cost <= 0) return '$0.00';
  if (cost < 0.001) return '<$0.001';
  if (cost < 1) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
};

const numberFormatter = new Intl.NumberFormat('pt-BR');
const formatTokens = (tokens: number): string => numberFormatter.format(tokens);

const formatSuccessRate = (rate: number): string => `${Math.round(rate * 100)}%`;

type Props = {
  agentId: string | null;
  onClose: () => void;
};

export const AgentSheet = ({ agentId, onClose }: Props) => {
  const agent = useAgent(agentId);
  const open = agentId !== null;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent className="flex flex-col overflow-y-auto bg-neutral-950 text-neutral-100">
        {!agent ? (
          <SheetHeader>
            <SheetTitle>Agente não encontrado</SheetTitle>
            <SheetDescription>
              {agentId
                ? `Sem dados pra agente ${agentId}.`
                : 'Selecione um agente no escritório.'}
            </SheetDescription>
          </SheetHeader>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="text-neutral-50">{agent.name}</SheetTitle>
              <SheetDescription className="text-neutral-400">
                {agent.description ?? 'Sem descrição.'}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="outline" className="border-neutral-700 text-neutral-300">
                {DEPT_LABEL[agent.department]}
              </Badge>
              <Badge variant="outline" className="border-neutral-700 text-neutral-300">
                {ROLE_LABEL[agent.role]}
              </Badge>
              <Badge variant="outline" className={STATE_CLASS[agent.state]}>
                {STATE_LABEL[agent.state]}
              </Badge>
            </div>

            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-400">Modelo</dt>
                <dd className="text-right text-neutral-200">{TIER_LABEL[agent.tier]}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-400">Autonomia</dt>
                <dd className="text-right text-neutral-200">
                  {AUTONOMY_LABEL[agent.autonomyTier]}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-400">Key</dt>
                <dd className="text-right">
                  <code className="rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-300">
                    {agent.agentKey}
                  </code>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-400">ID</dt>
                <dd className="text-right">
                  <code className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">
                    {agent.id}
                  </code>
                </dd>
              </div>
            </dl>

            <RecentRunsSection agentId={agent.id} />
            <MetricsSection agentId={agent.id} />

            <SheetFooter className="mt-auto pt-6">
              <Button
                variant="outline"
                disabled
                title="Em breve"
                className="border-neutral-700 text-neutral-400"
              >
                Configurar
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

const RecentRunsSection = ({ agentId }: { agentId: string }) => {
  const { runs, loading, error } = useAgentRuns(agentId);

  return (
    <section className="mt-6 border-t border-neutral-800 pt-4">
      <h3 className="text-xs uppercase tracking-wider text-neutral-500">Runs recentes</h3>
      <div className="mt-3">
        {loading ? (
          <RunsSkeleton />
        ) : error ? (
          <p className="text-sm text-red-400">Erro ao carregar runs. Tente novamente.</p>
        ) : runs.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhum run registrado neste período.</p>
        ) : (
          <ul className="space-y-2">
            {runs.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

const RunRow = ({ run }: { run: AgentRunSnapshot }) => (
  <li className="flex items-center justify-between gap-3 rounded-md border border-neutral-800 bg-neutral-900/50 px-3 py-2 text-xs">
    <div className="flex min-w-0 items-center gap-2">
      <Badge variant="outline" className={cn('shrink-0', RUN_STATUS_CLASS[run.status])}>
        {RUN_STATUS_LABEL[run.status]}
      </Badge>
      <span className="truncate text-neutral-400">{relativeTime(run.startedAt)}</span>
    </div>
    <div className="flex shrink-0 items-center gap-3 text-neutral-300">
      <span title="Duração">{formatDurationMs(run.durationMs)}</span>
      <span className="text-neutral-500" title="Custo">
        {formatCostUsd(run.costUsd)}
      </span>
    </div>
  </li>
);

const RunsSkeleton = () => (
  <ul className="space-y-2" aria-hidden>
    {[0, 1, 2].map((i) => (
      <li
        key={i}
        className="h-9 animate-pulse rounded-md border border-neutral-800 bg-neutral-900/50"
      />
    ))}
  </ul>
);

const MetricsSection = ({ agentId }: { agentId: string }) => {
  const [window, setWindow] = useState<AgentMetricsWindow>('7d');
  const { metrics, loading, error } = useAgentMetrics(agentId, window);

  return (
    <section className="mt-6 border-t border-neutral-800 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-wider text-neutral-500">Métricas</h3>
        <WindowToggle value={window} onChange={setWindow} />
      </div>
      <div className="mt-3">
        {loading ? (
          <MetricsSkeleton />
        ) : error ? (
          <p className="text-sm text-red-400">Erro ao carregar métricas. Tente novamente.</p>
        ) : !metrics || metrics.totalRuns === 0 ? (
          <p className="text-sm text-neutral-500">Sem runs neste período.</p>
        ) : (
          <MetricsGrid metrics={metrics} />
        )}
      </div>
    </section>
  );
};

const WindowToggle = ({
  value,
  onChange,
}: {
  value: AgentMetricsWindow;
  onChange: (next: AgentMetricsWindow) => void;
}) => (
  <div
    role="group"
    aria-label="Janela de tempo"
    className="inline-flex overflow-hidden rounded-md border border-neutral-800 bg-neutral-900"
  >
    {WINDOW_OPTIONS.map((opt) => {
      const active = value === opt.value;
      return (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={active}
          className={cn(
            'px-2.5 py-1 text-xs transition-colors',
            active
              ? 'bg-neutral-700 text-neutral-50'
              : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200',
          )}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);

const MetricsGrid = ({ metrics }: { metrics: AgentMetricsSnapshot }) => (
  <dl className="grid grid-cols-2 gap-2">
    <MetricCard label="Total runs" value={numberFormatter.format(metrics.totalRuns)} />
    <MetricCard label="Taxa de sucesso" value={formatSuccessRate(metrics.successRate)} />
    <MetricCard label="Duração média" value={formatDurationMs(metrics.avgDurationMs)} />
    <MetricCard label="Tokens totais" value={formatTokens(metrics.totalTokens)} />
    <MetricCard label="Custo total" value={formatCostUsd(metrics.totalCostUsd)} />
    <MetricCard label="Custo médio" value={formatCostUsd(metrics.avgCostUsd)} />
  </dl>
);

const MetricCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-neutral-800 bg-neutral-900/50 px-3 py-2">
    <dt className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</dt>
    <dd className="mt-0.5 text-sm font-medium text-neutral-100">{value}</dd>
  </div>
);

const MetricsSkeleton = () => (
  <div className="grid grid-cols-2 gap-2" aria-hidden>
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <div
        key={i}
        className="h-14 animate-pulse rounded-md border border-neutral-800 bg-neutral-900/50"
      />
    ))}
  </div>
);
