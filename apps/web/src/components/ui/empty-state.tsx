import type { ReactNode } from 'react';
import { Card } from './card';
import { cn } from '@/lib/utils';

// Sprint 1.6 — empty state padronizado pra listagens vazias. Substitui
// padrões inline que cada página tinha.

type Props = {
  title: string;
  body?: ReactNode;
  /** Ícone/emoji opcional. Mantemos texto puro como default — sem dependência
   *  de lib de ícones; "ilustração" cabe ao componente caller. */
  icon?: ReactNode;
  /** Ação principal (link/botão) abaixo do corpo. */
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, body, icon, action, className }: Props) {
  return (
    <Card
      className={cn(
        'flex flex-col items-center gap-3 border-dashed bg-card/40 p-10 text-center',
        className,
      )}
      role="status"
    >
      {icon && (
        <div aria-hidden className="text-3xl text-muted-foreground/60">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {body && (
        <div className="max-w-md text-sm text-muted-foreground">{body}</div>
      )}
      {action && <div className="mt-2">{action}</div>}
    </Card>
  );
}
