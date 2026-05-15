'use client';

import { useMemo, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ApprovalSheet } from './ApprovalSheet';
import { ApprovalsList } from './ApprovalsList';
import {
  PRIORITY_COLORS,
  PRIORITY_ORDER,
  type ApprovalPriority,
  type MockApproval,
} from './approvals-mock';

type PriorityFilter = 'all' | ApprovalPriority;

type Props = {
  approvals: MockApproval[];
  onApprove: (id: string, justification?: string) => void;
  onReject: (id: string, justification: string) => void;
  onModify: (id: string, modified: Record<string, unknown>, justification?: string) => void;
  onRequestMoreInfo: (id: string, question: string) => void;
};

export function ApprovalsInbox({
  approvals,
  onApprove,
  onReject,
  onModify,
  onRequestMoreInfo,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<PriorityFilter>('all');

  const counts = useMemo(() => {
    const base: Record<ApprovalPriority, number> = { urgent: 0, high: 0, medium: 0, low: 0 };
    for (const a of approvals) base[a.priority] += 1;
    return base;
  }, [approvals]);

  const filtered = useMemo(() => {
    if (filter === 'all') return approvals;
    return approvals.filter((a) => a.priority === filter);
  }, [approvals, filter]);

  const selected = useMemo(
    () => approvals.find((a) => a.id === selectedId) ?? null,
    [approvals, selectedId],
  );

  const handleOpenChange = (open: boolean) => {
    if (!open) setSelectedId(null);
  };

  return (
    <div className="grid gap-6">
      <header className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Inbox de aprovações
            </h1>
            <p className="text-sm text-muted-foreground">
              Ações propostas pelos agentes aguardando decisão humana.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Filtrar por prioridade</span>
            <Select value={filter} onValueChange={(v) => setFilter(v as PriorityFilter)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {PRIORITY_ORDER.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_COLORS[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CountBadge label="Total" value={approvals.length} tone="neutral" />
          {PRIORITY_ORDER.map((p) => (
            <CountBadge
              key={p}
              label={PRIORITY_COLORS[p].label}
              value={counts[p]}
              tone="priority"
              className={PRIORITY_COLORS[p].badge}
            />
          ))}
        </div>
      </header>

      <ApprovalsList
        approvals={filtered}
        selectedId={selectedId}
        onSelect={(id) => setSelectedId(id)}
      />

      <ApprovalSheet
        approval={selected}
        open={selected !== null}
        onOpenChange={handleOpenChange}
        onApprove={onApprove}
        onReject={onReject}
        onModify={onModify}
        onRequestMoreInfo={onRequestMoreInfo}
      />
    </div>
  );
}

function CountBadge({
  label,
  value,
  tone,
  className,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'priority';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs',
        tone === 'neutral'
          ? 'border-border bg-card text-foreground'
          : 'border-transparent',
        className,
      )}
    >
      <span className="opacity-80">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}
