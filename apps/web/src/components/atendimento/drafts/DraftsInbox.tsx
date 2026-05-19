'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/loading-skeleton';
import { cn } from '@/lib/utils';
import { DEPARTMENT_FILTER_OPTIONS } from '@/lib/department-meta';
import {
  useAgent,
  useDraft,
  useHydrated,
  usePendingDrafts,
} from '@/lib/realtime-store';
import type { DraftSnapshot } from '@/lib/realtime-types';
import { DraftCard } from './DraftCard';
import { DraftSheet } from './DraftSheet';

const SHEET_SLIDE_MS = 350;
const URGENT_WINDOW_MS = 5 * 60 * 1000;

type UrgencyFilter = 'all' | 'urgent';
type DepartmentFilter = 'all' | string;

type Props = {
  onApprove: (id: string) => Promise<void>;
  onEdit: (id: string, editedContent: string) => Promise<void>;
  onReject: (id: string, reason: string | undefined) => Promise<void>;
};

export function DraftsInbox({ onApprove, onEdit, onReject }: Props) {
  const hydrated = useHydrated();
  const drafts = usePendingDrafts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<DepartmentFilter>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all');

  const current = useDraft(selectedId ?? '');
  const lastDraftRef = useRef<DraftSnapshot | null>(null);

  useEffect(() => {
    if (current) lastDraftRef.current = current;
  }, [current]);

  const displayed = current ?? lastDraftRef.current;

  const urgencyFiltered = useMemo(() => {
    if (urgencyFilter !== 'urgent') return drafts;
    const now = Date.now();
    return drafts.filter((d) => {
      if (!d.expiresAt) return false;
      const diff = new Date(d.expiresAt).getTime() - now;
      return diff > 0 && diff <= URGENT_WINDOW_MS;
    });
  }, [drafts, urgencyFilter]);

  const hasActiveFilter = departmentFilter !== 'all' || urgencyFilter !== 'all';

  const handleOpenChange = (open: boolean): void => {
    if (!open) {
      setSelectedId(null);
      window.setTimeout(() => {
        lastDraftRef.current = null;
      }, SHEET_SLIDE_MS);
    }
  };

  return (
    <div className="grid gap-6">
      <header className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Inbox de rascunhos
            </h1>
            <p className="text-sm text-muted-foreground">
              Respostas propostas pelos agentes aguardando aprovação humana.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Departamento</span>
              <Select
                value={departmentFilter}
                onValueChange={(v) => setDepartmentFilter(v as DepartmentFilter)}
              >
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {DEPARTMENT_FILTER_OPTIONS.map((dept) => (
                    <SelectItem key={dept.key} value={dept.key}>
                      {dept.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Urgência</span>
              <Select
                value={urgencyFilter}
                onValueChange={(v) => setUrgencyFilter(v as UrgencyFilter)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Urgência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="urgent">Expirando em 5 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CountBadge label="Pendentes" value={drafts.length} />
          {hasActiveFilter && (
            <CountBadge
              label="Após filtros"
              value={urgencyFiltered.length}
              className="border-primary/30 bg-primary/10 text-primary"
            />
          )}
        </div>
      </header>

      {!hydrated ? (
        <ListSkeleton count={3} rowClassName="h-20" />
      ) : (
        <FilteredList
          drafts={urgencyFiltered}
          departmentFilter={departmentFilter}
          hasActiveFilter={hasActiveFilter}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      )}

      <DraftSheet
        draft={displayed}
        open={selectedId !== null}
        onOpenChange={handleOpenChange}
        onApprove={onApprove}
        onEdit={onEdit}
        onReject={onReject}
      />
    </div>
  );
}

function FilteredList({
  drafts,
  departmentFilter,
  hasActiveFilter,
  selectedId,
  onSelect,
}: {
  drafts: DraftSnapshot[];
  departmentFilter: DepartmentFilter;
  hasActiveFilter: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (drafts.length === 0) {
    return (
      <EmptyState
        icon="📥"
        title={
          hasActiveFilter
            ? 'Nenhum rascunho corresponde aos filtros'
            : 'Inbox vazio'
        }
        body={
          hasActiveFilter
            ? 'Ajusta o filtro pra ver mais rascunhos.'
            : 'Sua equipe de IA está esperando você. Rascunhos aparecem aqui quando agentes precisam de aprovação.'
        }
      />
    );
  }

  return (
    <div className="grid gap-3">
      {drafts.map((draft) => (
        <DepartmentGate
          key={draft.id}
          draft={draft}
          departmentFilter={departmentFilter}
          selected={selectedId === draft.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function DepartmentGate({
  draft,
  departmentFilter,
  selected,
  onSelect,
}: {
  draft: DraftSnapshot;
  departmentFilter: DepartmentFilter;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const agent = useAgent(draft.agentId);
  const visible =
    departmentFilter === 'all'
      ? true
      : agent?.department === departmentFilter;
  if (!visible) return null;
  return <DraftCard draft={draft} selected={selected} onSelect={onSelect} />;
}

function CountBadge({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs',
        'border-border bg-card text-foreground',
        className,
      )}
    >
      <span className="opacity-80">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}
