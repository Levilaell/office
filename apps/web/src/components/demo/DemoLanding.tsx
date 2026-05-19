'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { humanErrorMessage, parseHttpErrorBody } from '@/lib/error-messages';

type AuthStatus = 'anon' | 'signed_in_no_org' | 'signed_in_with_org';

type Scenario = 'operacional' | 'comercial' | 'escalacao';

const SCENARIO_LABEL: Record<Scenario, string> = {
  operacional: 'Cliente perguntando sobre DAS (operacional)',
  comercial: 'Lead novo querendo conhecer serviços (comercial)',
  escalacao: 'Cliente com intimação da Receita (escalação)',
};

type Props = {
  authStatus: AuthStatus;
};

export function DemoLanding({ authStatus }: Props) {
  const [scenario, setScenario] = useState<Scenario>('operacional');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<
    { kind: 'ok'; message: string } | { kind: 'err'; message: string } | null
  >(null);

  const trigger = async () => {
    setSubmitting(true);
    setFeedback(null);
    try {
      const r = await fetch('/api/demo/trigger-scenario', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });
      if (!r.ok) {
        const body = await parseHttpErrorBody(r);
        throw new Error(humanErrorMessage(r.status, body));
      }
      setFeedback({
        kind: 'ok',
        message: 'Cenário disparado. Abra o escritório virtual pra ver a equipe operando.',
      });
    } catch (err) {
      setFeedback({
        kind: 'err',
        message: err instanceof Error ? err.message : 'Falha ao disparar',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="container mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-4 py-12">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Modo demo
        </p>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight text-foreground">
          Veja a plataforma operando ao vivo
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Escritório de demonstração com dados fictícios. Dispare um cenário e
          acompanhe os agentes classificando, respondendo e escalando pra você
          no escritório virtual.
        </p>
      </header>

      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">Disparar cenário de exemplo</h2>
        <p className="text-sm text-muted-foreground">
          Escolha um cenário pra simular uma mensagem inbound de cliente. O
          Coordenador classifica, delega pro Especialista e (em tier sugestivo)
          gera rascunho pra você aprovar.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold text-foreground">
              Cenário
            </label>
            <Select
              value={scenario}
              onValueChange={(v) => setScenario(v as Scenario)}
              disabled={authStatus !== 'signed_in_with_org' || submitting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="operacional">
                  {SCENARIO_LABEL.operacional}
                </SelectItem>
                <SelectItem value="comercial">
                  {SCENARIO_LABEL.comercial}
                </SelectItem>
                <SelectItem value="escalacao">
                  {SCENARIO_LABEL.escalacao}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => void trigger()}
            disabled={authStatus !== 'signed_in_with_org' || submitting}
          >
            {submitting ? 'Disparando…' : 'Disparar cenário'}
          </Button>
        </div>

        {authStatus !== 'signed_in_with_org' && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            {authStatus === 'anon'
              ? 'Pra disparar, faça login com seu usuário do tenant demo.'
              : 'Selecione o tenant demo no Clerk Organization Switcher (não há tenant ativo agora).'}
          </div>
        )}

        {feedback && (
          <div
            role="status"
            className={`rounded-md border px-3 py-2 text-xs ${
              feedback.kind === 'ok'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/40 bg-red-500/10 text-red-300'
            }`}
          >
            {feedback.message}
          </div>
        )}
      </Card>

      <Card className="space-y-3 p-6">
        <h2 className="text-lg font-semibold">Abrir o escritório virtual</h2>
        <p className="text-sm text-muted-foreground">
          Visualize a equipe de IA operando em tempo real: avatares trabalhando,
          drafts pendentes, animação de handoff entre Coordenador e
          Especialista.
        </p>
        <Button asChild variant="outline">
          <Link href="/dashboard/escritorio">Abrir escritório virtual →</Link>
        </Button>
      </Card>

      <Card className="space-y-2 bg-neutral-950/60 p-6">
        <h3 className="text-sm font-semibold">Como acessar o tenant demo</h3>
        <p className="text-xs text-muted-foreground">
          1. Login com seu usuário do Clerk.{' '}
          {authStatus !== 'anon' ? (
            <span className="text-emerald-300">✓ Logado</span>
          ) : (
            <Link href="/sign-in" className="text-primary underline-offset-2 hover:underline">
              Fazer login agora →
            </Link>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          2. No Clerk Organization Switcher (canto superior do dashboard),
          selecione &ldquo;Demo — Levi Lael&rdquo;.
        </p>
        <p className="text-xs text-muted-foreground">
          3. Volte aqui e dispare um cenário. Ou abra o escritório virtual
          direto.
        </p>
        <p className="mt-2 text-[10px] text-neutral-500">
          Pra recriar tenant demo:{' '}
          <code className="rounded bg-neutral-900 px-1">pnpm seed:demo-tenant</code>
          . Pra apagar:{' '}
          <code className="rounded bg-neutral-900 px-1">pnpm seed:demo-cleanup</code>.
        </p>
      </Card>
    </main>
  );
}
