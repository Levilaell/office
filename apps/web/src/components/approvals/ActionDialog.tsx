'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { cn } from '@/lib/utils';
import { getActionLabel } from '@/lib/action-labels';
import type { ApprovalSnapshot } from '@/lib/realtime-types';

export type ApprovalAction = 'approve' | 'reject' | 'modify' | 'request_info';

type Copy = {
  title: string;
  description: string;
  justificationLabel: string;
  justificationPlaceholder: string;
  justificationRequired: boolean;
  confirmLabel: string;
  confirmVariant: 'default' | 'destructive';
};

const COPY: Record<ApprovalAction, Copy> = {
  approve: {
    title: 'Aprovar ação',
    description:
      'A ação proposta será executada pelo agente conforme registrado. Justificativa opcional ficará no log de auditoria.',
    justificationLabel: 'Justificativa (opcional)',
    justificationPlaceholder: 'Ex: revisei a proposta, está de acordo com o caso.',
    justificationRequired: false,
    confirmLabel: 'Aprovar',
    confirmVariant: 'default',
  },
  reject: {
    title: 'Rejeitar ação',
    description:
      'A ação será descartada e o agente notificado. Justificativa é obrigatória pra alimentar o aprendizado.',
    justificationLabel: 'Justificativa',
    justificationPlaceholder: 'Ex: valor divergente do que foi conciliado.',
    justificationRequired: true,
    confirmLabel: 'Rejeitar',
    confirmVariant: 'destructive',
  },
  modify: {
    title: 'Modificar e aprovar',
    description:
      'Edite o JSON da proposta antes de aprovar. Mudança é registrada no audit log.',
    justificationLabel: 'Comentário sobre a mudança (opcional)',
    justificationPlaceholder: 'Ex: ajustei o valor pra refletir a apuração revisada.',
    justificationRequired: false,
    confirmLabel: 'Aprovar modificado',
    confirmVariant: 'default',
  },
  request_info: {
    title: 'Pedir mais informações',
    description:
      'A solicitação é enviada ao agente como follow-up. A ação fica pendente até nova proposta.',
    justificationLabel: 'O que precisa esclarecer',
    justificationPlaceholder: 'Ex: confirme o regime tributário antes de transmitir.',
    justificationRequired: true,
    confirmLabel: 'Enviar pergunta',
    confirmVariant: 'default',
  },
};

type Props = {
  action: ApprovalAction | null;
  approval: ApprovalSnapshot | null;
  onCancel: () => void;
  onApprove: (id: string, justification?: string) => void;
  onReject: (id: string, justification: string) => void;
  onModify: (id: string, modified: Record<string, unknown>, justification?: string) => void;
  onRequestMoreInfo: (id: string, question: string) => void;
};

export function ActionDialog({
  action,
  approval,
  onCancel,
  onApprove,
  onReject,
  onModify,
  onRequestMoreInfo,
}: Props) {
  const [justification, setJustification] = useState('');
  const [modifiedJson, setModifiedJson] = useState('');

  useEffect(() => {
    if (action && approval) {
      setJustification('');
      setModifiedJson(JSON.stringify(approval.proposal, null, 2));
    }
  }, [action, approval]);

  const copy = action ? COPY[action] : null;

  const jsonError = useMemo(() => {
    if (action !== 'modify') return null;
    try {
      const parsed = JSON.parse(modifiedJson);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return 'JSON deve ser um objeto.';
      }
      return null;
    } catch {
      return 'JSON inválido.';
    }
  }, [action, modifiedJson]);

  const trimmedJustification = justification.trim();
  const justificationMissing = copy?.justificationRequired && trimmedJustification.length === 0;
  const confirmDisabled = !!justificationMissing;

  if (!action || !approval || !copy) return null;

  const actionLabel = getActionLabel(approval.actionType);
  const accountName = pickString(approval.context, 'account_name')
    ?? pickString(approval.context, 'cliente');

  const handleConfirm = () => {
    if (confirmDisabled) return;
    const id = approval.id;
    const note = trimmedJustification.length > 0 ? trimmedJustification : undefined;
    if (action === 'approve') {
      onApprove(id, note);
    } else if (action === 'reject') {
      onReject(id, trimmedJustification);
    } else if (action === 'modify') {
      let modified: Record<string, unknown> = approval.proposal;
      try {
        const parsed = JSON.parse(modifiedJson);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          modified = parsed as Record<string, unknown>;
        }
      } catch {
        // JSON inválido — mantém a proposal original; o vermelho já avisou.
      }
      onModify(id, modified, note);
    } else {
      onRequestMoreInfo(id, trimmedJustification);
    }
  };

  return (
    <Dialog
      open={action !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">{actionLabel}</div>
            {accountName && <div className="mt-0.5">Cliente: {accountName}</div>}
          </div>

          {action === 'modify' && (
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-foreground">Proposta (JSON)</label>
              <Textarea
                value={modifiedJson}
                onChange={(e) => setModifiedJson(e.target.value)}
                className={cn(
                  'min-h-[160px] font-mono text-xs',
                  jsonError && 'border-red-500/60 focus-visible:ring-red-500/40',
                )}
                spellCheck={false}
              />
              {jsonError && (
                <span className="text-xs text-red-400">{jsonError}</span>
              )}
            </div>
          )}

          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-foreground">
              {copy.justificationLabel}
              {copy.justificationRequired && <span className="text-red-400"> *</span>}
            </label>
            <Textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder={copy.justificationPlaceholder}
              className="min-h-[90px] text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant={copy.confirmVariant}
            onClick={handleConfirm}
            disabled={confirmDisabled}
          >
            {copy.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function pickString(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
