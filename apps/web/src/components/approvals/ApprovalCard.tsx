'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { relativeFuture, relativeTime } from '@/lib/relative-time';
import {
  DEPT_LABELS,
  PRIORITY_COLORS,
  type MockApproval,
} from './approvals-mock';

type Props = {
  approval: MockApproval;
  selected: boolean;
  onSelect: (id: string) => void;
};

export function ApprovalCard({ approval, selected, onSelect }: Props) {
  const dept = DEPT_LABELS[approval.agentDepartment];
  const priority = PRIORITY_COLORS[approval.priority];
  const createdAt = relativeTime(approval.createdAt);
  const expiresIn = approval.expiresAt ? relativeFuture(approval.expiresAt) : null;

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
            <span className="text-sm font-medium text-foreground">{approval.agentName}</span>
            <span
              className={cn(
                'inline-flex items-center rounded-md border border-transparent px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                dept.color,
              )}
            >
              {dept.label}
            </span>
          </div>

          <div className="text-base font-semibold text-foreground">{approval.actionLabel}</div>

          {approval.accountName && (
            <div className="text-xs text-muted-foreground">{approval.accountName}</div>
          )}

          <p className="line-clamp-2 text-sm text-muted-foreground">{approval.description}</p>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span
              className={cn(
                'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                priority.badge,
              )}
            >
              {priority.label}
            </span>
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
