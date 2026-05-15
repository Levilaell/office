'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { DEPARTMENT_FILTER_OPTIONS } from '@/lib/department-meta';
import { useAgent, useApproval } from '@/lib/realtime-store';
import type { ApprovalSnapshot } from '@/lib/realtime-types';
import { ApprovalCard } from './ApprovalCard';
import { ApprovalSheet } from './ApprovalSheet';

const SHEET_SLIDE_MS = 350;
const EXPIRING_WINDOW_MS = 4 * 60 * 60 * 1000;

type UrgencyFilter = 'all' | 'expiring_soon';
type DepartmentFilter = 'all' | string;

type Props = {
  approvals: ApprovalSnapshot[];
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
  const [departmentFilter, setDepartmentFilter] = useState<DepartmentFilter>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all');

  // Stub do realtime-store aceita '' sem crashar; quando A mergear a
  // versão real precisa cobrir esse caso (passar id vazio é o jeito
  // honesto de dizer "nenhum selecionado" sem mudar a forma do hook).
  const current = useApproval(selectedId ?? '');
  const lastApprovalRef = useRef<ApprovalSnapshot | null>(null);

  useEffect(() => {
    if (current) {
      lastApprovalRef.current = current;
    }
  }, [current]);

  const displayed = current ?? lastApprovalRef.current;

  const urgencyFiltered = useMemo(() => {
    if (urgencyFilter !== 'expiring_soon') return approvals;
    const now = Date.now();
    return approvals.filter((a) => {
      if (!a.expiresAt) return false;
      const expiresAt = new Date(a.expiresAt).getTime();
      const diff = expiresAt - now;
      return diff > 0 && diff <= EXPIRING_WINDOW_MS;
    });
  }, [approvals, urgencyFilter]);

  const hasActiveFilter = departmentFilter !== 'all' || urgencyFilter !== 'all';

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedId(null);
      window.setTimeout(() => {
        lastApprovalRef.current = null;
      }, SHEET_SLIDE_MS);
    }
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
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Urgência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="expiring_soon">Expirando em 4h</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CountBadge label="Total pendentes" value={approvals.length} />
          {hasActiveFilter && (
            <CountBadge
              label="Após filtros"
              value={urgencyFiltered.length}
              className="border-primary/30 bg-primary/10 text-primary"
            />
          )}
        </div>
      </header>

      <FilteredList
        approvals={urgencyFiltered}
        departmentFilter={departmentFilter}
        hasActiveFilter={hasActiveFilter}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      <ApprovalSheet
        approval={displayed}
        open={selectedId !== null}
        onOpenChange={handleOpenChange}
        onApprove={onApprove}
        onReject={onReject}
        onModify={onModify}
        onRequestMoreInfo={onRequestMoreInfo}
      />
    </div>
  );
}

function FilteredList({
  approvals,
  departmentFilter,
  hasActiveFilter,
  selectedId,
  onSelect,
}: {
  approvals: ApprovalSnapshot[];
  departmentFilter: DepartmentFilter;
  hasActiveFilter: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  // Department só dá pra resolver dentro do componente filho (precisa
  // chamar useAgent). Pra mostrar empty state correto quando o filtro
  // exclui tudo, cada gate reporta sua visibilidade aqui. Inicial
  // otimista: tudo visível, evita flicker quando há matches.
  const [visibleIds, setVisibleIds] = useState<Set<string>>(
    () => new Set(approvals.map((a) => a.id)),
  );

  useEffect(() => {
    setVisibleIds(new Set(approvals.map((a) => a.id)));
  }, [approvals, departmentFilter]);

  const reportVisibility = useCallback((id: string, visible: boolean) => {
    setVisibleIds((prev) => {
      const has = prev.has(id);
      if (visible === has) return prev;
      const next = new Set(prev);
      if (visible) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  if (approvals.length === 0) {
    return (
      <EmptyState
        text={
          hasActiveFilter
            ? 'Nenhuma aprovação corresponde aos filtros ativos.'
            : 'Nenhuma aprovação pendente.'
        }
      />
    );
  }

  const allHidden = departmentFilter !== 'all' && visibleIds.size === 0;
  if (allHidden) {
    return (
      <EmptyState text="Nenhuma aprovação para esse departamento." />
    );
  }

  return (
    <div className="grid gap-3">
      {approvals.map((approval) => (
        <DepartmentGate
          key={approval.id}
          approval={approval}
          departmentFilter={departmentFilter}
          selected={selectedId === approval.id}
          onSelect={onSelect}
          onVisibility={reportVisibility}
        />
      ))}
    </div>
  );
}

function DepartmentGate({
  approval,
  departmentFilter,
  selected,
  onSelect,
  onVisibility,
}: {
  approval: ApprovalSnapshot;
  departmentFilter: DepartmentFilter;
  selected: boolean;
  onSelect: (id: string) => void;
  onVisibility: (id: string, visible: boolean) => void;
}) {
  const agent = useAgent(approval.agentId);
  const visible =
    departmentFilter === 'all'
      ? true
      : agent?.department === departmentFilter;

  useEffect(() => {
    onVisibility(approval.id, !!visible);
  }, [approval.id, visible, onVisibility]);

  if (!visible) return null;
  return <ApprovalCard approval={approval} selected={selected} onSelect={onSelect} />;
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card className="border-dashed bg-card/40 p-10 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </Card>
  );
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
