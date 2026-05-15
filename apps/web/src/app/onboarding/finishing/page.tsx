'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function FinishingPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const res = await fetch('/api/onboarding/complete-org', {
          method: 'POST',
          cache: 'no-store',
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({ error: 'falha desconhecida' }))) as {
            error?: string;
          };
          if (!cancelled) setErrorMsg(body.error ?? 'falha ao finalizar onboarding');
          return;
        }
        if (!cancelled) router.replace('/dashboard');
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'falha de rede');
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 py-12">
      <p className="text-sm text-muted-foreground">
        {errorMsg ? `Erro: ${errorMsg}` : 'Preparando seu escritório...'}
      </p>
    </main>
  );
}
