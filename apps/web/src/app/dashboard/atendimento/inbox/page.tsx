'use client';

import { useCallback } from 'react';
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

const handleError = async (response: Response): Promise<void> => {
  let detail = `${response.status}`;
  try {
    const body = (await response.json()) as { error?: string; reason?: string };
    if (body.error) detail = body.error;
    if (body.reason) detail += `: ${body.reason}`;
  } catch {
    // ignore
  }
  throw new Error(detail);
};

export default function DraftsInboxPage() {
  const replaceDrafts = useRealtimeStore((s) => s.replaceDrafts);

  const decide = useCallback(
    async (id: string, body: Record<string, unknown>): Promise<void> => {
      const r = await fetch(decideEndpoint(id), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) await handleError(r);
      // Não esperamos o evento via socket pra remover do inbox — refetch
      // pra reconciliar (lista de pending muda; mais simples que delta).
      const drafts = await refetchDrafts();
      replaceDrafts(drafts);
    },
    [replaceDrafts],
  );

  const onApprove = useCallback(
    async (id: string): Promise<void> => {
      await decide(id, { action: 'approve' });
    },
    [decide],
  );
  const onEdit = useCallback(
    async (id: string, editedContent: string): Promise<void> => {
      await decide(id, { action: 'edit', edited_content: editedContent });
    },
    [decide],
  );
  const onReject = useCallback(
    async (id: string, reason: string | undefined): Promise<void> => {
      await decide(id, {
        action: 'reject',
        ...(reason !== undefined && { reason }),
      });
    },
    [decide],
  );

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <DraftsInbox onApprove={onApprove} onEdit={onEdit} onReject={onReject} />
    </div>
  );
}
