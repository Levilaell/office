import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { RealtimeProvider } from '@/components/realtime-provider';
import { getSupabaseForCurrentUser } from '@/lib/supabase';
import {
  toAgentSnapshot,
  toApprovalSnapshot,
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
  const [agentsRes, tasksRes, approvalsRes] = await Promise.all([
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
  ]);

  const initialSnapshot: InitialSnapshot = {
    agents: (agentsRes.data ?? []).map(toAgentSnapshot),
    tasks: (tasksRes.data ?? []).map(toTaskSnapshot),
    approvals: (approvalsRes.data ?? []).map(toApprovalSnapshot),
  };

  return <RealtimeProvider initialSnapshot={initialSnapshot}>{children}</RealtimeProvider>;
}
