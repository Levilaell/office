'use client';

import { useMemo, useState } from 'react';
import { useLeads, usePendingDraftByConversation } from '@/lib/realtime-store';
import { relativeTime } from '@/lib/relative-time';
import type { LeadSnapshot, LeadStatus } from '@/lib/realtime-types';

// =============================================================================
// Página de leads — Sprint 1.4
//
// Inbox de qualificação comercial. Lista todos os leads do tenant, filtrável
// por status. Cada card mostra: nome (se preenchido), source, status, slots
// preenchidos (resumo), timestamp de última atividade.
//
// Escopo Fase 1: visualização + filtro. Pipeline Kanban, busca, edição
// manual de slots, follow-up automatizado → Fase 3+.
// =============================================================================

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'Novo',
  qualifying: 'Qualificando',
  qualified: 'Qualificado',
  scheduled_pending: 'Aguardando agendar',
  converted: 'Convertido',
  lost: 'Perdido',
  dropped: 'Abandonado',
};

const STATUS_TONE: Record<LeadStatus, 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple'> = {
  new: 'gray',
  qualifying: 'blue',
  qualified: 'green',
  scheduled_pending: 'purple',
  converted: 'green',
  lost: 'red',
  dropped: 'yellow',
};

const TONE_CLASSES: Record<string, string> = {
  gray: 'bg-gray-100 text-gray-700 border-gray-200',
  blue: 'bg-blue-100 text-blue-800 border-blue-200',
  green: 'bg-green-100 text-green-800 border-green-200',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  red: 'bg-red-100 text-red-800 border-red-200',
  purple: 'bg-purple-100 text-purple-800 border-purple-200',
};

const SOURCE_LABEL: Record<string, string> = {
  whatsapp_evolution: 'WhatsApp (Evolution)',
  whatsapp_cloud: 'WhatsApp (Cloud)',
  email_imap: 'E-mail',
  simulated_webhook: 'Webhook simulado',
  manual: 'Manual',
  unknown: 'Desconhecido',
};

const FILTER_OPTIONS: ReadonlyArray<{ value: 'all' | LeadStatus; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'new', label: 'Novos' },
  { value: 'qualifying', label: 'Qualificando' },
  { value: 'qualified', label: 'Qualificados' },
  { value: 'scheduled_pending', label: 'Aguardando agendar' },
  { value: 'converted', label: 'Convertidos' },
  { value: 'lost', label: 'Perdidos' },
  { value: 'dropped', label: 'Abandonados' },
];

function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[STATUS_TONE[status]]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

const formatSlotValue = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'sim' : 'não';
  if (typeof value === 'string' && value.length > 60) {
    return `${value.slice(0, 57)}...`;
  }
  return String(value);
};

const PRIORITY_SLOTS: ReadonlyArray<[string, string]> = [
  ['contact_name', 'Nome'],
  ['main_pain', 'Dor'],
  ['has_existing_company', 'Já tem empresa'],
  ['company_size_estimate', 'Porte'],
  ['current_regime', 'Regime'],
  ['decision_timeline', 'Urgência'],
];

const renderSlotsSummary = (
  data: Record<string, unknown>,
): ReadonlyArray<{ label: string; value: string }> => {
  const items: Array<{ label: string; value: string }> = [];
  for (const [key, label] of PRIORITY_SLOTS) {
    if (data[key] !== undefined) {
      items.push({ label, value: formatSlotValue(data[key]) });
    }
  }
  return items;
};

const getContactName = (data: Record<string, unknown>): string => {
  const name = data.contact_name;
  return typeof name === 'string' && name.trim().length > 0 ? name : 'Lead sem nome';
};

function LeadCard({ lead }: { lead: LeadSnapshot }) {
  const sourceLabel = SOURCE_LABEL[lead.source] ?? lead.source;
  const slots = renderSlotsSummary(lead.qualificationData);
  const lastActivity = lead.updatedAt ?? lead.createdAt;
  const contactName = getContactName(lead.qualificationData);
  const pendingDraft = usePendingDraftByConversation(
    lead.primaryConversationId ?? '',
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-gray-900">
              {contactName}
            </h3>
            <StatusBadge status={lead.status} />
            {pendingDraft && (
              <span
                className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700"
                title="Agente preparou resposta aguardando aprovação"
              >
                Rascunho pendente
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-600">
            {sourceLabel} · criado {relativeTime(lead.createdAt)}
            {lead.qualifiedAt && ` · qualificado ${relativeTime(lead.qualifiedAt)}`}
          </p>
        </div>
        <div className="text-right text-xs text-gray-500 shrink-0">
          {relativeTime(lastActivity)}
        </div>
      </div>

      {slots.length > 0 && (
        <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-gray-700 sm:grid-cols-2">
          {slots.map(({ label, value }) => (
            <div key={label} className="flex">
              <dt className="w-20 shrink-0 text-gray-500">{label}:</dt>
              <dd className="truncate">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {lead.notes && (
        <div className="mt-3 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
          {lead.notes}
        </div>
      )}

      {lead.lostReason && lead.status === 'lost' && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          <strong>Motivo:</strong> {lead.lostReason}
        </div>
      )}
    </div>
  );
}

export default function LeadsPage() {
  const leads = useLeads();
  const [filter, setFilter] = useState<'all' | LeadStatus>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return leads;
    return leads.filter((l) => l.status === filter);
  }, [leads, filter]);

  const countByStatus = useMemo(() => {
    const acc: Partial<Record<LeadStatus, number>> = {};
    for (const l of leads) {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
    }
    return acc;
  }, [leads]);

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Leads</h1>
        <p className="mt-1 text-sm text-gray-600">
          Leads de qualificação comercial. O Especialista Comercial coleta
          informações via chat; quando todos os slots core são preenchidos, o
          lead vira <em>qualificado</em> e a equipe agenda call.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTER_OPTIONS.map((opt) => {
          const count =
            opt.value === 'all' ? leads.length : countByStatus[opt.value] ?? 0;
          const isActive = filter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              {opt.label} <span className="opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
          <p className="text-sm">Nenhum lead {filter === 'all' ? '' : `em "${STATUS_LABEL[filter as LeadStatus]}"`} ainda.</p>
          <p className="mt-1 text-xs">
            Use <code className="rounded bg-gray-100 px-1">pnpm seed:leads-test-data</code>{' '}
            pra criar leads de teste.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((l) => (
            <LeadCard key={l.id} lead={l} />
          ))}
        </div>
      )}
    </main>
  );
}
