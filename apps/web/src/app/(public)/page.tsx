import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { Button } from '@/components/ui/button';

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) {
    redirect('/dashboard');
  }

  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-8 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Office</h1>
        <p className="max-w-md text-muted-foreground">
          Plataforma de agentes de IA para escritórios contábeis brasileiros.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/sign-in">Entrar</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/sign-up">Criar conta</Link>
        </Button>
      </div>
    </main>
  );
}
