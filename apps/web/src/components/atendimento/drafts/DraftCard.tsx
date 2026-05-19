'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { relativeFuture, relativeTime } from '@/lib/relative-time';
import { getDepartmentMeta } from '@/lib/department-meta';
import { useAgent } from '@/lib/realtime-store';
import type { DraftSnapshot } from '@/lib/realtime-types';

type Props = {
  draft: DraftSnapshot;
  selected: boolean;
  onSelect: (id: string) => void;
};

const previewContent = (content: string, max = 140): string =>
  content.length <= max ? content : `${content.slice(0, max).trimEnd()}…`;

export function DraftCard({ draft, selected, onSelect }: Props) {
  const agent = useAgent(draft.agentId);
  const dept = getDepartmentMeta(agent?.department);
  const createdAt = relativeTime(draft.createdAt);
  const expiresIn = draft.expiresAt ? relativeFuture(draft.expiresAt) : null;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onSelect(draft.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(draft.id);
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
            {draft.confidence !== null && (
              <span className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                confidence {(draft.confidence * 100).toFixed(0)}%
              </span>
            )}
          </div>

          <p className="line-clamp-3 text-sm text-foreground">
            {previewContent(draft.proposedContent)}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{createdAt}</span>
            {expiresIn && (
              <span
                className={cn(
                  expiresIn === 'expirado'
                    ? 'text-red-400'
                    : isUrgent(draft.expiresAt)
                      ? 'text-amber-400'
                      : 'text-muted-foreground',
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

const URGENT_MS = 5 * 60 * 1000;
const isUrgent = (expiresAt: string | null): boolean => {
  if (!expiresAt) return false;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return diff > 0 && diff <= URGENT_MS;
};
