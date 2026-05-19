'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { DraftSnapshot } from '@/lib/realtime-types';

export type DraftAction = 'approve' | 'edit' | 'reject';

type Props = {
  draft: DraftSnapshot;
  pendingAction: DraftAction | null;
  onCancel: () => void;
  onApprove: () => Promise<void>;
  onEdit: (editedContent: string) => Promise<void>;
  onReject: (reason: string | undefined) => Promise<void>;
};

export function DraftActionDialog({
  draft,
  pendingAction,
  onCancel,
  onApprove,
  onEdit,
  onReject,
}: Props) {
  const [editedContent, setEditedContent] = useState(draft.proposedContent);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const open = pendingAction !== null;

  const handleSubmit = async (): Promise<void> => {
    setSubmitting(true);
    try {
      if (pendingAction === 'approve') {
        await onApprove();
      } else if (pendingAction === 'edit') {
        if (editedContent.trim().length === 0) return;
        await onEdit(editedContent);
      } else if (pendingAction === 'reject') {
        await onReject(reason.trim().length > 0 ? reason.trim() : undefined);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (next: boolean): void => {
    if (!next && !submitting) onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {pendingAction === 'approve' && 'Aprovar e enviar'}
            {pendingAction === 'edit' && 'Editar antes de enviar'}
            {pendingAction === 'reject' && 'Rejeitar rascunho'}
          </DialogTitle>
          <DialogDescription>
            {pendingAction === 'approve' &&
              'A mensagem proposta vai ser enviada ao cliente. Confirmar?'}
            {pendingAction === 'edit' &&
              'Ajuste o texto antes de enviar. A versão final fica salva no histórico.'}
            {pendingAction === 'reject' &&
              'O cliente NÃO recebe nada. Motivo opcional pra ajudar a calibrar o agente.'}
          </DialogDescription>
        </DialogHeader>

        {pendingAction === 'edit' && (
          <Textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            rows={8}
            maxLength={2000}
            disabled={submitting}
          />
        )}

        {pendingAction === 'reject' && (
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="Por que está rejeitando? (opcional)"
            maxLength={500}
            disabled={submitting}
          />
        )}

        {pendingAction === 'approve' && (
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-foreground">
            <p className="whitespace-pre-wrap">{draft.proposedContent}</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              submitting ||
              (pendingAction === 'edit' && editedContent.trim().length === 0)
            }
            variant={pendingAction === 'reject' ? 'destructive' : 'default'}
          >
            {submitting
              ? 'Enviando...'
              : pendingAction === 'approve'
                ? 'Aprovar e enviar'
                : pendingAction === 'edit'
                  ? 'Editar e enviar'
                  : 'Rejeitar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
