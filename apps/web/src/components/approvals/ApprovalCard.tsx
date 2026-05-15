'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { relativeFuture, relativeTime } from '@/lib/relative-time';
import { getActionLabel } from '@/lib/action-labels';
import { getDepartmentMeta } from '@/lib/department-meta';
import { useAgent } from '@/lib/realtime-store';
import type { ApprovalSnapshot } from '@/lib/realtime-types';

type Props = {
  approval: ApprovalSnapshot;
  selected: boolean;
  onSelect: (id: string) => void;
};

export function ApprovalCard({ approval, selected, onSelect }: Props) {
  const agent = useAgent(approval.agentId);
  const dept = getDepartmentMeta(agent?.department);
  const actionLabel = getActionLabel(approval.actionType);
  const createdAt = relativeTime(approval.createdAt);
  const expiresIn = approval.expiresAt ? relativeFuture(approval.expiresAt) : null;
  const description =
    pickString(approval.proposal, 'description') ??
    pickString(approval.context, 'description') ??
    'Sem descrição.';
  const accountName =
    pickString(approval.context, 'account_name') ??
    pickString(approval.context, 'cliente');

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onSelect(approval.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(approval.id);
        }
      }}
      className={cn(
        'cursor-pointer border-border/60 bg-card/60 p-4 transition-colors hover:border-primary/50 hover:bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected && 'border-primary/70 bg-card ring-1 ring-primary/40',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base',
            dept.color,
          )}
          aria-hidden
        >
          {dept.emoji}
        </div>

        <div className="grid flex-1 gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {agent?.name ?? 'Agente desconhecido'}
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-md border border-transparent px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                dept.color,
              )}
            >
              {dept.label}
            </span>
          </div>

          <div className="text-base font-semibold text-foreground">{actionLabel}</div>

          {accountName && (
            <div className="text-xs text-muted-foreground">{accountName}</div>
          )}

          <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{createdAt}</span>
            {expiresIn && (
              <span
                className={cn(
                  expiresIn === 'expirado' ? 'text-red-400' : 'text-muted-foreground',
                )}
              >
                expira {expiresIn}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function pickString(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
