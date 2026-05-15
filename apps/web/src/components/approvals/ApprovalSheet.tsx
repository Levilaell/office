'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { relativeFuture, relativeTime } from '@/lib/relative-time';
import { ActionDialog, type ApprovalAction } from './ActionDialog';
import {
  DEPT_LABELS,
  PRIORITY_COLORS,
  type MockApproval,
} from './approvals-mock';

type Props = {
  approval: MockApproval | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (id: string, justification?: string) => void;
  onReject: (id: string, justification: string) => void;
  onModify: (id: string, modified: Record<string, unknown>, justification?: string) => void;
  onRequestMoreInfo: (id: string, question: string) => void;
};

export function ApprovalSheet({
  approval,
  open,
  onOpenChange,
  onApprove,
  onReject,
  onModify,
  onRequestMoreInfo,
}: Props) {
  const [pendingAction, setPendingAction] = useState<ApprovalAction | null>(null);

  const dept = approval ? DEPT_LABELS[approval.agentDepartment] : null;
  const priority = approval ? PRIORITY_COLORS[approval.priority] : null;

  const closeAll = () => {
    setPendingAction(null);
    onOpenChange(false);
  };

  const handleApprove = (id: string, justification?: string) => {
    onApprove(id, justification);
    closeAll();
  };
  const handleReject = (id: string, justification: string) => {
    onReject(id, justification);
    closeAll();
  };
  const handleModify = (
    id: string,
    modified: Record<string, unknown>,
    justification?: string,
  ) => {
    onModify(id, modified, justification);
    closeAll();
  };
  const handleRequestMoreInfo = (id: string, question: string) => {
    onRequestMoreInfo(id, question);
    closeAll();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl"
        >
          {approval && dept && priority && (
            <>
              <SheetHeader className="border-b border-border bg-card/50 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg',
                      dept.color,
                    )}
                    aria-hidden
                  >
                    {dept.emoji}
                  </div>
                  <div className="grid gap-0.5 text-left">
                    <SheetTitle className="text-lg">{approval.actionLabel}</SheetTitle>
                    <SheetDescription className="text-xs">
                      {approval.agentName} · {dept.label}
                    </SheetDescription>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      priority.badge,
                    )}
                  >
                    {priority.label}
                  </span>
                  <span className="text-muted-foreground">criado {relativeTime(approval.createdAt)}</span>
                  {approval.expiresAt && (
                    <span
                      className={cn(
                        relativeFuture(approval.expiresAt) === 'expirado'
                          ? 'text-red-400'
                          : 'text-muted-foreground',
                      )}
                    >
                      expira {relativeFuture(approval.expiresAt)}
                    </span>
                  )}
                </div>
              </SheetHeader>

              <div className="grid gap-5 px-6 py-5">
                <section className="grid gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Descrição
                  </h3>
                  <p className="text-sm text-foreground">{approval.description}</p>
                </section>

                <section className="grid gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Contexto
                  </h3>
                  <JsonBlock data={approval.context} />
                </section>

                <section className="grid gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Proposta
                  </h3>
                  <JsonBlock data={approval.proposal} />
                </section>

                <section className="grid gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Histórico
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Sem eventos registrados ainda. O histórico aparece aqui após integração com o bus de eventos.
                  </p>
                </section>
              </div>

              <div className="mt-auto grid gap-2 border-t border-border bg-card/50 px-6 py-4 sm:grid-cols-2">
                <Button onClick={() => setPendingAction('approve')}>Aprovar</Button>
                <Button variant="destructive" onClick={() => setPendingAction('reject')}>
                  Rejeitar
                </Button>
                <Button variant="outline" onClick={() => setPendingAction('modify')}>
                  Modificar
                </Button>
                <Button variant="outline" onClick={() => setPendingAction('request_info')}>
                  Pedir mais info
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ActionDialog
        action={pendingAction}
        approval={approval}
        onCancel={() => setPendingAction(null)}
        onApprove={handleApprove}
        onReject={handleReject}
        onModify={handleModify}
        onRequestMoreInfo={handleRequestMoreInfo}
      />
    </>
  );
}

function JsonBlock({ data }: { data: Record<string, unknown> }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs leading-relaxed text-foreground">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
