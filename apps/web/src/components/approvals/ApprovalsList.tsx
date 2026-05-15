'use client';

import { Card } from '@/components/ui/card';
import { ApprovalCard } from './ApprovalCard';
import type { ApprovalSnapshot } from '@/lib/realtime-types';

type Props = {
  approvals: ApprovalSnapshot[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function ApprovalsList({ approvals, selectedId, onSelect }: Props) {
  if (approvals.length === 0) {
    return (
      <Card className="border-dashed bg-card/40 p-10 text-center">
        <p className="text-sm text-muted-foreground">Nenhuma aprovação pendente.</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {approvals.map((approval) => (
        <ApprovalCard
          key={approval.id}
          approval={approval}
          selected={selectedId === approval.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
