'use client';

import type { ApprovalSnapshot } from '@/lib/realtime-types';

export type DecideInput =
  | { action: 'approve'; justification?: string }
  | { action: 'reject'; justification: string }
  | { action: 'modify'; modifiedProposal: Record<string, unknown>; justification?: string }
  | { action: 'request_info'; question: string };

export async function decideApproval(
  id: string,
  input: DecideInput,
): Promise<ApprovalSnapshot> {
  const res = await fetch(`/api/approvals/${id}/decide`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(error.error ?? `decide failed with ${res.status}`);
  }
  const data = (await res.json()) as { approval: ApprovalSnapshot };
  return data.approval;
}
