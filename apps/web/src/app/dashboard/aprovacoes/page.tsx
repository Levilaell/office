'use client';

import { useState } from 'react';
import { ApprovalsInbox } from '@/components/approvals/ApprovalsInbox';
import { MOCK_APPROVALS, type MockApproval } from '@/components/approvals/approvals-mock';

export default function AprovacoesPage() {
  const [approvals, setApprovals] = useState<MockApproval[]>(MOCK_APPROVALS);

  const remove = (id: string) => setApprovals((cur) => cur.filter((a) => a.id !== id));

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <ApprovalsInbox
        approvals={approvals}
        onApprove={(id, justification) => {
          console.log('[approval] approve', { id, justification });
          remove(id);
        }}
        onReject={(id, justification) => {
          console.log('[approval] reject', { id, justification });
          remove(id);
        }}
        onModify={(id, modified, justification) => {
          console.log('[approval] modify', { id, modified, justification });
          remove(id);
        }}
        onRequestMoreInfo={(id, question) => {
          console.log('[approval] request_info', { id, question });
          remove(id);
        }}
      />
    </main>
  );
}
