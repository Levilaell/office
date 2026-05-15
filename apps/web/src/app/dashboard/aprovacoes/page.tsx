'use client';

import { ApprovalsInbox } from '@/components/approvals/ApprovalsInbox';
import { decideApproval } from '@/lib/approvals-api';
import { usePendingApprovals } from '@/lib/realtime-store';

export default function AprovacoesPage() {
  const approvals = usePendingApprovals();

  const reportError = (action: string, err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[approvals] ${action} failed`, message);
    // Toast lib não está instalada — alert nativo cobre o caminho de
    // erro até a primeira sprint de UX polish.
    if (typeof window !== 'undefined') {
      window.alert(`Falha ao ${action}: ${message}`);
    }
  };

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <ApprovalsInbox
        approvals={approvals}
        onApprove={(id, justification) => {
          decideApproval(id, {
            action: 'approve',
            ...(justification && { justification }),
          }).catch((err) => reportError('aprovar', err));
        }}
        onReject={(id, justification) => {
          decideApproval(id, { action: 'reject', justification }).catch((err) =>
            reportError('rejeitar', err),
          );
        }}
        onModify={(id, modified, justification) => {
          decideApproval(id, {
            action: 'modify',
            modifiedProposal: modified,
            ...(justification && { justification }),
          }).catch((err) => reportError('modificar', err));
        }}
        onRequestMoreInfo={(id, question) => {
          decideApproval(id, { action: 'request_info', question }).catch((err) =>
            reportError('pedir mais info', err),
          );
        }}
      />
    </main>
  );
}
