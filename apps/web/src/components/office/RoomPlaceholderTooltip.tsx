'use client';

import { useEffect } from 'react';

const DEPARTMENT_LABEL: Record<string, string> = {
  societario: 'Societário',
  pessoal: 'Pessoal',
  contabil: 'Contábil',
  fiscal: 'Fiscal',
  financeiro_interno: 'Financeiro Interno',
  recepcao: 'Recepção',
};

type Props = {
  department: string | null;
  onClose: () => void;
};

export function RoomPlaceholderTooltip({ department, onClose }: Props) {
  useEffect(() => {
    if (!department) return;
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [department, onClose]);

  if (!department) return null;
  const label = DEPARTMENT_LABEL[department] ?? department;

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-md border border-neutral-700 bg-neutral-900/95 px-4 py-2 text-xs text-neutral-200 shadow-lg backdrop-blur"
      role="status"
      aria-live="polite"
    >
      <span className="font-semibold text-neutral-50">{label}</span>{' '}
      <span className="text-neutral-400">
        — em construção, disponível na Fase 2.
      </span>
    </div>
  );
}
