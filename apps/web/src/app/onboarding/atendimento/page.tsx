import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import {
  getCurrentTenant,
  tenantNeedsOnboarding,
} from '@office/shared-domain';
import { AtendimentoWizard } from '@/components/onboarding/AtendimentoWizard';
import { getSupabaseForCurrentUser } from '@/lib/supabase';
import { toAgentSnapshot } from '@/lib/realtime-mappers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function OnboardingAtendimentoPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const supabase = await getSupabaseForCurrentUser();
  const tenant = await getCurrentTenant(supabase);
  if (!tenant) redirect('/onboarding/finishing');

  // Se já está completado (ou nunca esteve pendente, caso de tenant
  // legado), pula o wizard direto pro dashboard.
  if (!tenantNeedsOnboarding(tenant.display_settings)) {
    redirect('/dashboard');
  }

  const { data: agentsData } = await supabase
    .from('agents')
    .select('*')
    .eq('department', 'atendimento')
    .order('role', { ascending: true });

  const configurableAgents = (agentsData ?? [])
    .map(toAgentSnapshot)
    .filter((a) => a.role !== 'router');

  return (
    <AtendimentoWizard
      tenant={{
        id: tenant.id,
        name: tenant.name,
      }}
      agents={configurableAgents}
    />
  );
}
