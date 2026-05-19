'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAgents, useRealtimeStore } from '@/lib/realtime-store';
import type { AgentSnapshot } from '@/lib/realtime-types';

// Apenas estes 2 tiers são expostos na Fase 1. Outros tiers (manual, autonomo)
// existem no schema mas não estão implementados — agente loga warning e opera
// como sugestivo se configurado via SQL.
const SUPPORTED_TIERS: ReadonlyArray<{ value: 'sugestivo' | 'semi_autonomo'; label: string; description: string }> = [
  {
    value: 'sugestivo',
    label: 'Sugestivo (default)',
    description:
      'Agente prepara rascunho; operador aprova/edita/rejeita antes do envio.',
  },
  {
    value: 'semi_autonomo',
    label: 'Semi-autônomo',
    description:
      'Agente envia direto; operador revisa histórico depois.',
  },
];

type ToastState =
  | { kind: 'idle' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

export default function AgentesConfigPage() {
  const agents = useAgents();
  const upsertAgent = useRealtimeStore((s) => s.upsertAgent);
  const [toast, setToast] = useState<ToastState>({ kind: 'idle' });
  const [savingId, setSavingId] = useState<string | null>(null);

  // Filtra apenas agentes de departamentos que entregam em Atendimento na
  // Fase 1 (Coordenador + 2 Especialistas). Router (platform) não é
  // configurável aqui — autonomo por design.
  const configurable = agents.filter(
    (a) => a.department === 'atendimento' && a.role !== 'router',
  );

  const handleChange = useCallback(
    async (agent: AgentSnapshot, tier: 'sugestivo' | 'semi_autonomo'): Promise<void> => {
      if (agent.autonomyTier === tier) return;
      setSavingId(agent.id);
      try {
        const r = await fetch(`/api/configuracoes/agentes/${agent.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ autonomy_tier: tier }),
        });
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as {
            error?: string;
            reason?: string;
          };
          const msg =
            body.error === 'permission_denied'
              ? 'Permissão insuficiente: apenas owner/manager pode alterar tier.'
              : (body.reason ?? body.error ?? `Erro ${r.status}`);
          setToast({ kind: 'error', message: msg });
          return;
        }
        // Aplica delta direto no store pra UI ficar consistente sem refetch.
        upsertAgent({ ...agent, autonomyTier: tier });
        setToast({ kind: 'success', message: `Tier de ${agent.name} atualizado.` });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        setToast({ kind: 'error', message });
      } finally {
        setSavingId(null);
      }
    },
    [upsertAgent],
  );

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Tier de autonomia dos agentes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Define como cada agente responde. Sugestivo = rascunho para sua
          aprovação. Semi-autônomo = envia direto.
          Você sempre pode trocar depois.
        </p>
      </header>

      {toast.kind !== 'idle' && (
        <Toast toast={toast} onClose={() => setToast({ kind: 'idle' })} />
      )}

      {configurable.length === 0 ? (
        <Card className="border-dashed bg-card/40 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum agente configurável neste tenant.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {configurable.map((agent) => (
            <AgentRow
              key={agent.id}
              agent={agent}
              saving={savingId === agent.id}
              onChange={handleChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentRow({
  agent,
  saving,
  onChange,
}: {
  agent: AgentSnapshot;
  saving: boolean;
  onChange: (
    agent: AgentSnapshot,
    tier: 'sugestivo' | 'semi_autonomo',
  ) => void;
}) {
  const currentTierInfo =
    SUPPORTED_TIERS.find((t) => t.value === agent.autonomyTier) ??
    SUPPORTED_TIERS[0]!;

  return (
    <Card className="bg-card/60 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">{agent.name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {agent.description ?? agent.agentKey}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {currentTierInfo.description}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Select
            value={agent.autonomyTier}
            onValueChange={(v) =>
              onChange(agent, v as 'sugestivo' | 'semi_autonomo')
            }
            disabled={saving}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_TIERS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}

function Toast({
  toast,
  onClose,
}: {
  toast: { kind: 'success' | 'error'; message: string };
  onClose: () => void;
}) {
  return (
    <div
      className={`mb-4 flex items-start justify-between rounded-md border px-4 py-3 text-sm ${
        toast.kind === 'success'
          ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
          : 'border-red-300 bg-red-50 text-red-900'
      }`}
      role="status"
    >
      <span>{toast.message}</span>
      <Button
        size="sm"
        variant="ghost"
        onClick={onClose}
        aria-label="Fechar notificação"
      >
        ✕
      </Button>
    </div>
  );
}
