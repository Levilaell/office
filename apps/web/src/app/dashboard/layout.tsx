import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { RealtimeProvider } from '@/components/realtime-provider';
import { getSupabaseForCurrentUser } from '@/lib/supabase';
import {
  toAgentSnapshot,
  toApprovalSnapshot,
  toChannelSessionSnapshot,
  toConversationSnapshot,
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
  const [agentsRes, tasksRes, approvalsRes, conversationsRes, channelSessionsRes] =
    await Promise.all([
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
    ]);

  const initialSnapshot: InitialSnapshot = {
    agents: (agentsRes.data ?? []).map(toAgentSnapshot),
    tasks: (tasksRes.data ?? []).map(toTaskSnapshot),
    approvals: (approvalsRes.data ?? []).map(toApprovalSnapshot),
    conversations: (conversationsRes.data ?? []).map(toConversationSnapshot),
    channelSessions: (channelSessionsRes.data ?? []).map(toChannelSessionSnapshot),
  };

  return <RealtimeProvider initialSnapshot={initialSnapshot}>{children}</RealtimeProvider>;
}
