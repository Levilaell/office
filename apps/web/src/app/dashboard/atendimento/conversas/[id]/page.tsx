import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { ConversationDetailView } from '@/components/atendimento/conversations/ConversationDetailView';
import { loadConversationDetail } from '@/lib/conversation-detail';
import { getSupabaseForCurrentUser } from '@/lib/supabase';

type Params = { id: string };

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function ConversationDetailPage({
  params,
}: Readonly<{ params: Promise<Params> }>) {
  const { userId, orgId } = await auth();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const { id } = await params;

  const supabase = await getSupabaseForCurrentUser();
  const detail = await loadConversationDetail(supabase, id);
  if (!detail) notFound();

  // Carrega nome do account em paralelo via authenticated client (RLS).
  const accountRes = await supabase
    .from('accounts')
    .select('razao_social, nome_fantasia, cnpj')
    .eq('id', detail.conversation.accountId)
    .maybeSingle();

  const accountSummary =
    !accountRes.error && accountRes.data
      ? {
          razaoSocial: accountRes.data.razao_social as string,
          nomeFantasia: (accountRes.data.nome_fantasia as string | null) ?? null,
          cnpj: (accountRes.data.cnpj as string | null) ?? null,
        }
      : null;

  return (
    <ConversationDetailView
      initialDetail={detail}
      accountSummary={accountSummary}
    />
  );
}
