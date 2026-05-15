'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useAgent } from '@/lib/realtime-store';
import type { AgentSnapshot } from '@/lib/realtime-types';
import type { AgentState } from '@office/shared-types';

const STATE_LABEL: Record<AgentState, string> = {
  idle: 'Ocioso',
  working: 'Trabalhando',
  awaiting_approval: 'Aguardando aprovação',
  error: 'Erro',
  paused: 'Pausado',
};

const STATE_CLASS: Record<AgentState, string> = {
  idle: 'bg-neutral-500/15 text-neutral-300 border-neutral-500/30',
  working: 'bg-green-500/15 text-green-400 border-green-500/30',
  awaiting_approval: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  error: 'bg-red-500/15 text-red-400 border-red-500/30',
  paused: 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30',
};

const DEPT_LABEL: Record<AgentSnapshot['department'], string> = {
  platform: 'Plataforma',
  atendimento: 'Atendimento',
  societario: 'Societário',
  pessoal: 'Pessoal',
  contabil: 'Contábil',
  fiscal: 'Fiscal',
  financeiro_interno: 'Financeiro Interno',
};

const ROLE_LABEL: Record<AgentSnapshot['role'], string> = {
  router: 'Roteador',
  coordinator: 'Coordenador',
  specialist: 'Especialista',
  supervisor: 'Supervisor',
};

const TIER_LABEL: Record<AgentSnapshot['tier'], string> = {
  triage: 'Triagem (Haiku)',
  default: 'Padrão (Sonnet)',
  critical: 'Crítico (Opus)',
};

const AUTONOMY_LABEL: Record<AgentSnapshot['autonomyTier'], string> = {
  manual: 'Manual',
  sugestivo: 'Sugestivo',
  semi_autonomo: 'Semi-autônomo',
  autonomo: 'Autônomo',
};

type Props = {
  agentId: string | null;
  onClose: () => void;
};

export const AgentSheet = ({ agentId, onClose }: Props) => {
  const agent = useAgent(agentId);
  const open = agentId !== null;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent className="flex flex-col overflow-y-auto bg-neutral-950 text-neutral-100">
        {!agent ? (
          <SheetHeader>
            <SheetTitle>Agente não encontrado</SheetTitle>
            <SheetDescription>
              {agentId
                ? `Sem dados pra agente ${agentId}.`
                : 'Selecione um agente no escritório.'}
            </SheetDescription>
          </SheetHeader>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="text-neutral-50">{agent.name}</SheetTitle>
              <SheetDescription className="text-neutral-400">
                {agent.description ?? 'Sem descrição.'}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="outline" className="border-neutral-700 text-neutral-300">
                {DEPT_LABEL[agent.department]}
              </Badge>
              <Badge variant="outline" className="border-neutral-700 text-neutral-300">
                {ROLE_LABEL[agent.role]}
              </Badge>
              <Badge variant="outline" className={STATE_CLASS[agent.state]}>
                {STATE_LABEL[agent.state]}
              </Badge>
            </div>

            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-400">Modelo</dt>
                <dd className="text-right text-neutral-200">{TIER_LABEL[agent.tier]}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-400">Autonomia</dt>
                <dd className="text-right text-neutral-200">
                  {AUTONOMY_LABEL[agent.autonomyTier]}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-400">Key</dt>
                <dd className="text-right">
                  <code className="rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-300">
                    {agent.agentKey}
                  </code>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-400">ID</dt>
                <dd className="text-right">
                  <code className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">
                    {agent.id}
                  </code>
                </dd>
              </div>
            </dl>

            <section className="mt-6 border-t border-neutral-800 pt-4">
              <h3 className="text-xs uppercase tracking-wider text-neutral-500">
                Runs recentes
              </h3>
              <p className="mt-2 text-sm text-neutral-500">Em breve (0.3e)</p>
            </section>

            <section className="mt-6 border-t border-neutral-800 pt-4">
              <h3 className="text-xs uppercase tracking-wider text-neutral-500">
                Métricas
              </h3>
              <p className="mt-2 text-sm text-neutral-500">Em breve (0.3e)</p>
            </section>

            <SheetFooter className="mt-auto pt-6">
              <Button
                variant="outline"
                disabled
                title="Em breve"
                className="border-neutral-700 text-neutral-400"
              >
                Configurar
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
