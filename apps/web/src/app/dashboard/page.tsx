import { redirect } from 'next/navigation';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import { getCurrentTenant } from '@office/shared-domain';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentAuthContext } from '@/lib/auth';
import { getSupabaseForCurrentUser } from '@/lib/supabase';

export default async function DashboardPage() {
  const ctx = await getCurrentAuthContext();
  if (!ctx) {
    redirect('/sign-in');
  }

  const supabase = await getSupabaseForCurrentUser();
  const tenant = await getCurrentTenant(supabase);
  if (!tenant) {
    // Sessão tem org no Clerk mas o tenant no DB ainda não existe —
    // o user precisa passar pelo onboarding síncrono.
    redirect('/onboarding/finishing');
  }

  return (
    <main className="container flex min-h-screen flex-col gap-6 py-8">
      <header className="flex items-center justify-between gap-4">
        <OrganizationSwitcher hidePersonal />
        <UserButton />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{tenant.name}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Tenant: </span>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{tenant.id}</code>
          </div>
          <div>
            <span className="text-muted-foreground">Tier: </span>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{tenant.tier}</code>
          </div>
          <div>
            <span className="text-muted-foreground">Status: </span>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{tenant.status}</code>
          </div>
          <div>
            <span className="text-muted-foreground">Role: </span>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{ctx.role}</code>
          </div>
          <div>
            <span className="text-muted-foreground">Email: </span>
            <span>{ctx.email}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Escritório virtual</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Placeholder do escritório virtual.
        </CardContent>
      </Card>
    </main>
  );
}
