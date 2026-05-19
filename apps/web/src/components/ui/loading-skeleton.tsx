import { cn } from '@/lib/utils';

// Sprint 1.6 — placeholders animados pra listagens que demoram > 200ms
// pra hidratar. Padroniza o look-and-feel; cada página passa a contagem
// de linhas e o tamanho.

type ListProps = {
  count?: number;
  rowClassName?: string;
  className?: string;
};

export function ListSkeleton({
  count = 3,
  rowClassName = 'h-16',
  className,
}: ListProps) {
  return (
    <ul
      className={cn('space-y-2', className)}
      aria-hidden
      aria-busy
      data-testid="list-skeleton"
    >
      {Array.from({ length: count }).map((_, i) => (
        <li
          key={i}
          className={cn(
            'animate-pulse rounded-md border border-neutral-800 bg-neutral-900/50',
            rowClassName,
          )}
        />
      ))}
    </ul>
  );
}

type BlockProps = {
  className?: string;
};

export function BlockSkeleton({ className }: BlockProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md border border-neutral-800 bg-neutral-900/50',
        className,
      )}
      aria-hidden
      aria-busy
    />
  );
}
