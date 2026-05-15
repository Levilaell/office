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
import { getActionLabel } from '@/lib/action-labels';
import { getDepartmentMeta } from '@/lib/department-meta';
import { useAgent } from '@/lib/realtime-store';
import type { ApprovalSnapshot } from '@/lib/realtime-types';
import { ActionDialog, type ApprovalAction } from './ActionDialog';

type Props = {
  approval: ApprovalSnapshot | null;
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
  const agent = useAgent(approval?.agentId ?? '');
  const dept = approval ? getDepartmentMeta(agent?.department) : null;
  const actionLabel = approval ? getActionLabel(approval.actionType) : '';
  const description = approval
    ? pickString(approval.proposal, 'description')
      ?? pickString(approval.context, 'description')
      ?? 'Sem descrição.'
    : '';

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
          {approval && dept && (
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
                    <SheetTitle className="text-lg">{actionLabel}</SheetTitle>
                    <SheetDescription className="text-xs">
                      {agent?.name ?? 'Agente desconhecido'} · {dept.label}
                    </SheetDescription>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">
                    criado {relativeTime(approval.createdAt)}
                  </span>
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
                  <p className="text-sm text-foreground">{description}</p>
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

function pickString(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
