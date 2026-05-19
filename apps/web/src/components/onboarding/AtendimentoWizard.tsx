'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AgentSnapshot } from '@/lib/realtime-types';

// Sprint 1.6 — wizard mínimo de configuração inicial pro Atendimento.
// Sem mexer em schema (display_settings já é JSONB), 3 passos curtos:
// identidade, horário comercial, tier de autonomia inicial.

type Tier = 'sugestivo' | 'semi_autonomo';

type TenantInfo = { id: string; name: string };

type BusinessHoursForm = {
  start: string;
  end: string;
  timezone: string;
  days: number[];
};

const DAY_LABEL = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const BR_TIMEZONES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'America/Sao_Paulo', label: 'São Paulo (UTC-3)' },
  { value: 'America/Manaus', label: 'Manaus (UTC-4)' },
  { value: 'America/Belem', label: 'Belém (UTC-3)' },
  { value: 'America/Fortaleza', label: 'Fortaleza (UTC-3)' },
  { value: 'America/Bahia', label: 'Bahia (UTC-3)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (UTC-4)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (UTC-5)' },
];

const TIER_INFO: Record<Tier, { label: string; description: string }> = {
  sugestivo: {
    label: 'Sugestivo (recomendado)',
    description:
      'Agente prepara rascunho; você aprova ou edita antes de enviar.',
  },
  semi_autonomo: {
    label: 'Semi-autônomo',
    description:
      'Agente envia direto pra cliente; você revisa o histórico depois.',
  },
};

type Props = {
  tenant: TenantInfo;
  agents: AgentSnapshot[];
};

export function AtendimentoWizard({ tenant, agents }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [botName, setBotName] = useState<string>(tenant.name);
  const [signature, setSignature] = useState<string>(tenant.name);
  const [businessHours, setBusinessHours] = useState<BusinessHoursForm>({
    start: '08:00',
    end: '18:00',
    timezone: 'America/Sao_Paulo',
    days: [1, 2, 3, 4, 5],
  });
  const [tiers, setTiers] = useState<Record<string, Tier>>(() => {
    const initial: Record<string, Tier> = {};
    for (const a of agents) {
      initial[a.id] = a.autonomyTier === 'semi_autonomo' ? 'semi_autonomo' : 'sugestivo';
    }
    return initial;
  });

  const step1Valid = useMemo(
    () => botName.trim().length > 0 && signature.trim().length > 0,
    [botName, signature],
  );
  const step2Valid = useMemo(
    () => businessHours.end > businessHours.start && businessHours.days.length > 0,
    [businessHours],
  );

  const submit = async (opts: { skip: boolean }): Promise<void> => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        bot_name: botName.trim() || tenant.name,
        signature: signature.trim() || tenant.name,
        business_hours: opts.skip
          ? null
          : {
              start: businessHours.start,
              end: businessHours.end,
              timezone: businessHours.timezone,
              days: [...businessHours.days].sort(),
            },
        agent_tiers: agents.map((a) => ({
          agent_id: a.id,
          autonomy_tier: tiers[a.id] ?? 'sugestivo',
        })),
        skipped: opts.skip,
      };
      const r = await fetch('/api/onboarding/atendimento', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Erro ${r.status}`);
      }
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar');
      setSubmitting(false);
    }
  };

  return (
    <main className="container mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Configurar Atendimento
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Três passos rápidos pra deixar sua equipe de IA pronta pra atender
          clientes. Você pode trocar tudo depois nas configurações.
        </p>
      </header>

      <Stepper step={step} />

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      {step === 1 && (
        <Step1Identity
          tenant={tenant}
          botName={botName}
          signature={signature}
          onBotNameChange={setBotName}
          onSignatureChange={setSignature}
        />
      )}

      {step === 2 && (
        <Step2Hours
          hours={businessHours}
          onChange={setBusinessHours}
        />
      )}

      {step === 3 && (
        <Step3Tiers
          agents={agents}
          tiers={tiers}
          onChange={(agentId, tier) =>
            setTiers((prev) => ({ ...prev, [agentId]: tier }))
          }
        />
      )}

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => void submit({ skip: true })}
          disabled={submitting}
        >
          Pular agora
        </Button>
        <div className="flex items-center gap-2">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
              disabled={submitting}
            >
              Voltar
            </Button>
          )}
          {step < 3 && (
            <Button
              onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
              disabled={
                submitting || (step === 1 && !step1Valid) || (step === 2 && !step2Valid)
              }
            >
              Continuar
            </Button>
          )}
          {step === 3 && (
            <Button
              onClick={() => void submit({ skip: false })}
              disabled={submitting}
            >
              {submitting ? 'Finalizando…' : 'Finalizar configuração'}
            </Button>
          )}
        </div>
      </footer>
    </main>
  );
}

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const items = [
    { n: 1, label: 'Identidade' },
    { n: 2, label: 'Horário' },
    { n: 3, label: 'Autonomia' },
  ];
  return (
    <ol className="mb-8 flex items-center gap-2" aria-label="Progresso do wizard">
      {items.map((it, i) => {
        const active = step === it.n;
        const done = step > it.n;
        return (
          <li key={it.n} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${
                active
                  ? 'border-primary bg-primary/20 text-primary'
                  : done
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                    : 'border-neutral-700 bg-neutral-900 text-neutral-500'
              }`}
            >
              {done ? '✓' : it.n}
            </span>
            <span
              className={`text-xs ${
                active ? 'font-semibold text-foreground' : 'text-muted-foreground'
              }`}
            >
              {it.label}
            </span>
            {i < items.length - 1 && (
              <span className="mx-1 h-px w-6 bg-neutral-700" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Step1Identity({
  tenant,
  botName,
  signature,
  onBotNameChange,
  onSignatureChange,
}: {
  tenant: TenantInfo;
  botName: string;
  signature: string;
  onBotNameChange: (v: string) => void;
  onSignatureChange: (v: string) => void;
}) {
  return (
    <Card className="space-y-5 p-6">
      <h2 className="text-lg font-semibold">Identidade do escritório</h2>
      <p className="text-sm text-muted-foreground">
        Como você quer que sua equipe de IA se apresente nas mensagens? Esses
        valores aparecem em todo template renderizado.
      </p>

      <div>
        <label className="mb-1 block text-xs font-semibold text-foreground">
          Nome do escritório (usado no início das mensagens)
        </label>
        <input
          type="text"
          value={botName}
          onChange={(e) => onBotNameChange(e.target.value)}
          placeholder={tenant.name}
          maxLength={80}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-foreground">
          Assinatura (usada no final das mensagens)
        </label>
        <input
          type="text"
          value={signature}
          onChange={(e) => onSignatureChange(e.target.value)}
          placeholder={tenant.name}
          maxLength={120}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
        />
      </div>

      <div className="rounded-md border border-neutral-800 bg-neutral-950/60 p-3 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">Como aparecerá:</p>
        <p className="mt-1 italic">
          “Olá! Aqui é da equipe da{' '}
          <span className="text-foreground">{botName || tenant.name}</span>. Sua
          dúvida sobre DAS: …”
        </p>
        <p className="mt-2 italic">
          “Qualquer dúvida tô por aqui. — <span className="text-foreground">{signature || tenant.name}</span>”
        </p>
      </div>
    </Card>
  );
}

function Step2Hours({
  hours,
  onChange,
}: {
  hours: BusinessHoursForm;
  onChange: (next: BusinessHoursForm) => void;
}) {
  const toggleDay = (day: number) => {
    const has = hours.days.includes(day);
    const next = has
      ? hours.days.filter((d) => d !== day)
      : [...hours.days, day];
    onChange({ ...hours, days: next });
  };

  return (
    <Card className="space-y-5 p-6">
      <h2 className="text-lg font-semibold">Horário comercial</h2>
      <p className="text-sm text-muted-foreground">
        Fora desse horário, seus agentes ainda recebem e classificam mensagens,
        mas usam templates de “fora do expediente”.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-foreground">
            Início
          </label>
          <input
            type="time"
            value={hours.start}
            onChange={(e) => onChange({ ...hours, start: e.target.value })}
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-foreground">
            Fim
          </label>
          <input
            type="time"
            value={hours.end}
            onChange={(e) => onChange({ ...hours, end: e.target.value })}
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          />
          {hours.end <= hours.start && (
            <p className="mt-1 text-xs text-red-400">
              Fim precisa ser depois do início.
            </p>
          )}
        </div>
      </div>

      <div>
        <span className="mb-2 block text-xs font-semibold text-foreground">
          Dias da semana
        </span>
        <div className="flex flex-wrap gap-1.5">
          {DAY_LABEL.map((label, i) => {
            const day = i + 1;
            const active = hours.days.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                aria-pressed={active}
                className={`rounded-md border px-2.5 py-1 text-xs ${
                  active
                    ? 'border-primary/60 bg-primary/20 text-foreground'
                    : 'border-neutral-700 bg-neutral-900 text-muted-foreground hover:bg-neutral-800'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {hours.days.length === 0 && (
          <p className="mt-1 text-xs text-red-400">
            Pelo menos um dia precisa estar ativo.
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-foreground">
          Fuso horário
        </label>
        <Select
          value={hours.timezone}
          onValueChange={(v) => onChange({ ...hours, timezone: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BR_TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Card>
  );
}

function Step3Tiers({
  agents,
  tiers,
  onChange,
}: {
  agents: AgentSnapshot[];
  tiers: Record<string, Tier>;
  onChange: (agentId: string, tier: Tier) => void;
}) {
  if (agents.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Nenhum agente configurável no Atendimento. Continue mesmo assim — os
        agentes padrão serão criados com tier sugestivo.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h2 className="text-lg font-semibold">Como cada agente vai operar?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Recomendamos começar todos em <strong>sugestivo</strong> pra você
          calibrar respostas. Quando confiar no agente, troca pra semi-autônomo
          nas configurações.
        </p>
      </Card>

      <div className="grid gap-3">
        {agents.map((agent) => (
          <Card key={agent.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-foreground">
                  {agent.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {agent.description ?? agent.agentKey}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {TIER_INFO[tiers[agent.id] ?? 'sugestivo'].description}
                </p>
              </div>
              <div className="shrink-0">
                <Select
                  value={tiers[agent.id] ?? 'sugestivo'}
                  onValueChange={(v) => onChange(agent.id, v as Tier)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sugestivo">
                      {TIER_INFO.sugestivo.label}
                    </SelectItem>
                    <SelectItem value="semi_autonomo">
                      {TIER_INFO.semi_autonomo.label}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
