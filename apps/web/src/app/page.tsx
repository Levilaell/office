import { health } from '@office/shared-domain';

export default function Home() {
  const status = health();

  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Office</h1>
      <p className="text-muted-foreground">
        Plataforma de agentes de IA para escritórios contábeis brasileiros.
      </p>
      <code className="rounded bg-muted px-3 py-1 text-sm">
        shared-domain health: {String(status.ok)}
      </code>
    </main>
  );
}
