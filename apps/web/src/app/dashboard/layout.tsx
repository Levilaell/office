import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getCurrentTenant, tenantNeedsOnboarding } from '@office/shared-domain';
import { RealtimeProvider } from '@/components/realtime-provider';
import { getSupabaseForCurrentUser } from '@/lib/supabase';
import {
  toAgentSnapshot,
  toApprovalSnapshot,
  toChannelSessionSnapshot,
  toConversationSnapshot,
  toDraftSnapshot,
  toLeadSnapshot,
  toTaskSnapshot,
} from '@/lib/realtime-mappers';
import type { InitialSnapshot } from '@/lib/realtime-types';

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { userId, orgId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }
  if (!orgId) {
    redirect('/onboarding');
  }

  // Pre-busca o snapshot inicial server-side. RLS filtra por tenant via JWT
  // do Clerk. Fica garantido que o cliente só recebe dados do tenant ativo.
  const supabase = await getSupabaseForCurrentUser();

  // Sprint 1.6 — redirect pro wizard SE tenant novo (display_settings.
  // onboarding_completed === false). Tenants legados (undefined) e
  // tenants já configurados (true) passam direto. Wizard pode ser pulado.
  const tenant = await getCurrentTenant(supabase);
  if (tenant && tenantNeedsOnboarding(tenant.display_settings)) {
    redirect('/onboarding/atendimento');
  }
  const [
    agentsRes,
    tasksRes,
    approvalsRes,
    conversationsRes,
    channelSessionsRes,
    leadsRes,
    draftsRes,
  ] = await Promise.all([
    supabase.from('agents').select('*').order('created_at', { ascending: false }),
    supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('approvals')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase
      .from('conversations')
      .select('*')
      .eq('status', 'open')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('channel_sessions')
      .select('*')
      .order('channel', { ascending: true }),
    supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('message_drafts')
      .select('*')
      .eq('status', 'pending')
      .order('expires_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const initialSnapshot: InitialSnapshot = {
    agents: (agentsRes.data ?? []).map(toAgentSnapshot),
    tasks: (tasksRes.data ?? []).map(toTaskSnapshot),
    approvals: (approvalsRes.data ?? []).map(toApprovalSnapshot),
    conversations: (conversationsRes.data ?? []).map(toConversationSnapshot),
    channelSessions: (channelSessionsRes.data ?? []).map(toChannelSessionSnapshot),
    leads: (leadsRes.data ?? []).map(toLeadSnapshot),
    drafts: (draftsRes.data ?? []).map(toDraftSnapshot),
  };

  return <RealtimeProvider initialSnapshot={initialSnapshot}>{children}</RealtimeProvider>;
}
