'use client';

import { useState } from 'react';
import { humanErrorMessage, parseHttpErrorBody } from '@/lib/error-messages';

type Scenario = 'operacional' | 'comercial' | 'escalacao';

const SCENARIO_LABEL: Record<Scenario, string> = {
  operacional: 'Operacional — DAS',
  comercial: 'Comercial — lead novo',
  escalacao: 'Escalação — intimação',
};

// Sprint 1.6 — widget flutuante no canto inferior direito do canvas em
// modo demo. Permite ao apresentador disparar um cenário sem sair do
// escritório virtual. Endpoint /api/demo/trigger-scenario é gated por
// `isDemoModeEnabled()` no servidor — botão ser visível depende do mesmo
// gate via prop no shell.

export function DemoTriggerWidget() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<
    | { kind: 'ok'; message: string }
    | { kind: 'err'; message: string }
    | null
  >(null);

  const trigger = async (scenario: Scenario) => {
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
        message: `Cenário "${SCENARIO_LABEL[scenario]}" disparado.`,
      });
      setOpen(false);
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
    <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2">
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`max-w-xs rounded-md border px-3 py-2 text-xs shadow-lg backdrop-blur ${
            feedback.kind === 'ok'
              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
              : 'border-red-500/40 bg-red-500/15 text-red-300'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {open && (
        <div className="flex w-64 flex-col gap-1 rounded-md border border-neutral-800 bg-neutral-900/95 p-2 shadow-xl backdrop-blur">
          {(['operacional', 'comercial', 'escalacao'] as Scenario[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void trigger(s)}
              disabled={submitting}
              className="rounded-md px-3 py-2 text-left text-xs text-neutral-200 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {SCENARIO_LABEL[s]}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={submitting}
        aria-expanded={open}
        className="rounded-full border border-primary/40 bg-primary/20 px-4 py-2 text-xs font-semibold text-primary shadow-lg backdrop-blur hover:bg-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Disparando…' : open ? 'Fechar' : 'Disparar cenário (demo)'}
      </button>
    </div>
  );
}
