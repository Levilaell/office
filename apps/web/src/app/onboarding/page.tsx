import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { CreateOrganization } from '@clerk/nextjs';

export default async function OnboardingPage() {
  const { userId, orgId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }
  if (orgId) {
    // Já tem org ativa — só falta criar tenant no nosso DB.
    redirect('/onboarding/finishing');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Criar escritório</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Antes de entrar no escritório virtual, crie a organização que vai representar o seu
          escritório contábil.
        </p>
      </div>
      <CreateOrganization
        afterCreateOrganizationUrl="/onboarding/finishing"
        skipInvitationScreen
      />
    </main>
  );
}
