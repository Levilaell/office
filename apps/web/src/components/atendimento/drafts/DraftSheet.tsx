'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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
import { getDepartmentMeta } from '@/lib/department-meta';
import { useAgent, useConversation } from '@/lib/realtime-store';
import type { DraftSnapshot } from '@/lib/realtime-types';
import { DraftActionDialog, type DraftAction } from './DraftActions';

type Props = {
  draft: DraftSnapshot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (id: string) => Promise<void>;
  onEdit: (id: string, editedContent: string) => Promise<void>;
  onReject: (id: string, reason: string | undefined) => Promise<void>;
};

const useNowTicker = (intervalMs = 5000): number => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
};

export function DraftSheet({
  draft,
  open,
  onOpenChange,
  onApprove,
  onEdit,
  onReject,
}: Props) {
  const [pendingAction, setPendingAction] = useState<DraftAction | null>(null);

  const agent = useAgent(draft?.agentId ?? '');
  const conversation = useConversation(draft?.conversationId ?? '');
  const dept = draft ? getDepartmentMeta(agent?.department) : null;

  useNowTicker(); // re-render pra atualizar countdown

  const isPending = draft?.status === 'pending';
  const expiresIn = draft?.expiresAt ? relativeFuture(draft.expiresAt) : null;

  const closeAll = (): void => {
    setPendingAction(null);
    onOpenChange(false);
  };

  const handleApprove = async (): Promise<void> => {
    if (!draft) return;
    try {
      await onApprove(draft.id);
      closeAll();
    } catch {
      setPendingAction(null);
    }
  };
  const handleEdit = async (editedContent: string): Promise<void> => {
    if (!draft) return;
    try {
      await onEdit(draft.id, editedContent);
      closeAll();
    } catch {
      setPendingAction(null);
    }
  };
  const handleReject = async (reason: string | undefined): Promise<void> => {
    if (!draft) return;
    try {
      await onReject(draft.id, reason);
      closeAll();
    } catch {
      setPendingAction(null);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl"
        >
          {draft && dept && (
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
                    <SheetTitle className="text-lg">
                      Rascunho de resposta
                    </SheetTitle>
                    <SheetDescription className="text-xs">
                      {agent?.name ?? 'Agente desconhecido'} · {dept.label}
                    </SheetDescription>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">
                    criado {relativeTime(draft.createdAt)}
                  </span>
                  {expiresIn && (
                    <span
                      className={cn(
                        expiresIn === 'expirado'
                          ? 'text-red-400'
                          : 'text-muted-foreground',
                      )}
                    >
                      expira {expiresIn}
                    </span>
                  )}
                  {!isPending && (
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md border border-border bg-muted/40 px-1.5 py-0.5 uppercase tracking-wide text-muted-foreground',
                      )}
                    >
                      {draft.status}
                    </span>
                  )}
                  {draft.confidence !== null && (
                    <span className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-muted-foreground">
                      confidence {(draft.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </SheetHeader>

              <div className="grid gap-5 px-6 py-5">
                <section className="grid gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Proposta
                  </h3>
                  <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-foreground">
                    <p className="whitespace-pre-wrap">{draft.proposedContent}</p>
                  </div>
                </section>

                {draft.reasoning && (
                  <section className="grid gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Raciocínio do agente
                    </h3>
                    <p className="text-sm text-foreground">{draft.reasoning}</p>
                  </section>
                )}

                {conversation && (
                  <section className="grid gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Conversa relacionada
                    </h3>
                    <div className="text-sm text-foreground">
                      {conversation.subject ?? conversation.channelHandle}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {conversation.channel} · {conversation.unreadCount} não
                      lidas
                    </div>
                    <Link
                      href={`/dashboard/atendimento/conversas/${conversation.id}`}
                      className="text-xs text-primary underline-offset-2 hover:underline"
                    >
                      Ver histórico completo →
                    </Link>
                  </section>
                )}

                {draft.editDiff && draft.status === 'edited' && (
                  <section className="grid gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Edição registrada
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Conteúdo editado pelo operador antes do envio. Diff salvo
                      no histórico (visual não renderizado nesta versão).
                    </p>
                  </section>
                )}
              </div>

              {isPending && (
                <div className="mt-auto grid gap-2 border-t border-border bg-card/50 px-6 py-4 sm:grid-cols-2">
                  <Button onClick={() => setPendingAction('approve')}>
                    Aprovar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPendingAction('edit')}
                  >
                    Editar e aprovar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setPendingAction('reject')}
                    className="sm:col-span-2"
                  >
                    Rejeitar
                  </Button>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {draft && (
        <DraftActionDialog
          draft={draft}
          pendingAction={pendingAction}
          onCancel={() => setPendingAction(null)}
          onApprove={handleApprove}
          onEdit={handleEdit}
          onReject={handleReject}
        />
      )}
    </>
  );
}
