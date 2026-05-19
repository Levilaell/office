'use client';

import { useCallback, useState } from 'react';
import { humanErrorMessage, parseHttpErrorBody } from '@/lib/error-messages';
import { useRealtimeStore } from '@/lib/realtime-store';
import type { DraftSnapshot } from '@/lib/realtime-types';
import { DraftsInbox } from '@/components/atendimento/drafts/DraftsInbox';

const decideEndpoint = (id: string): string =>
  `/api/atendimento/drafts/${id}/decide`;

const refetchDrafts = async (): Promise<DraftSnapshot[]> => {
  const r = await fetch('/api/atendimento/drafts?status=pending', {
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`drafts fetch failed: ${r.status}`);
  const body = (await r.json()) as { drafts: DraftSnapshot[] };
  return body.drafts;
};

type ToastState =
  | { kind: 'idle' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

export default function DraftsInboxPage() {
  const replaceDrafts = useRealtimeStore((s) => s.replaceDrafts);
  const [toast, setToast] = useState<ToastState>({ kind: 'idle' });

  const decide = useCallback(
    async (
      id: string,
      body: Record<string, unknown>,
      successMsg: string,
    ): Promise<void> => {
      try {
        const r = await fetch(decideEndpoint(id), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          const errBody = await parseHttpErrorBody(r);
          throw new Error(humanErrorMessage(r.status, errBody));
        }
        // Não esperamos o evento via socket pra remover do inbox — refetch
        // pra reconciliar (lista de pending muda; mais simples que delta).
        const drafts = await refetchDrafts();
        replaceDrafts(drafts);
        setToast({ kind: 'success', message: successMsg });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Falha desconhecida';
        setToast({ kind: 'error', message });
        throw err;
      }
    },
    [replaceDrafts],
  );

  const onApprove = useCallback(
    async (id: string): Promise<void> => {
      await decide(id, { action: 'approve' }, 'Rascunho aprovado e enviado.');
    },
    [decide],
  );
  const onEdit = useCallback(
    async (id: string, editedContent: string): Promise<void> => {
      await decide(
        id,
        { action: 'edit', edited_content: editedContent },
        'Edição aprovada e enviada.',
      );
    },
    [decide],
  );
  const onReject = useCallback(
    async (id: string, reason: string | undefined): Promise<void> => {
      await decide(
        id,
        {
          action: 'reject',
          ...(reason !== undefined && { reason }),
        },
        'Rascunho rejeitado.',
      );
    },
    [decide],
  );

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {toast.kind !== 'idle' && (
        <Toast toast={toast} onClose={() => setToast({ kind: 'idle' })} />
      )}
      <DraftsInbox onApprove={onApprove} onEdit={onEdit} onReject={onReject} />
    </div>
  );
}

function Toast({
  toast,
  onClose,
}: {
  toast: { kind: 'success' | 'error'; message: string };
  onClose: () => void;
}) {
  return (
    <div
      className={`mb-4 flex items-start justify-between gap-3 rounded-md border px-4 py-3 text-sm ${
        toast.kind === 'success'
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
          : 'border-red-500/40 bg-red-500/10 text-red-300'
      }`}
      role="status"
      aria-live="polite"
    >
      <span>{toast.message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar notificação"
        className="shrink-0 text-xs opacity-70 hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}
