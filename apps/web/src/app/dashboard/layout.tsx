import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { RealtimeProvider } from '@/components/realtime-provider';

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

  return <RealtimeProvider>{children}</RealtimeProvider>;
}
