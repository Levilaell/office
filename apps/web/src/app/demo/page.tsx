import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { isDemoModeEnabled } from '@office/shared-config';
import { DemoLanding } from '@/components/demo/DemoLanding';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function DemoPage() {
  if (!isDemoModeEnabled()) {
    // Não vaza existência da rota em produção sem flag.
    notFound();
  }

  const { userId, orgId } = await auth();
  const authStatus =
    userId && orgId ? 'signed_in_with_org' : userId ? 'signed_in_no_org' : 'anon';

  return <DemoLanding authStatus={authStatus} />;
}
