// =============================================================================
// Pre-detect — atalhos determinísticos antes do LLM.
//
// Dois casos saem do fluxo padrão:
//
// 1. Lead já está `scheduled_pending` (agendou horário em turno anterior).
//    Bot não responde mais — silent handoff: garante metadata.assigned_to_human
//    e publica `agent.escalated_human` se ainda não foi. Sem mensagem outbound,
//    sem LLM. Humano cuida.
//
// 2. Lead está `qualified` (T10 enviado em turno anterior) E mensagem atual
//    parece resposta de horário → schedule_response. Skip LLM; transita pra
//    `scheduled_pending` + envia T10b.
//
// 3. Lead já está terminal (`converted`/`lost`/`dropped`) → silent. Não
//    deveríamos receber mensagem, mas se receber, silent handoff.
// =============================================================================

import type { LeadRow } from '@office/shared-domain';
import { hasScheduleHint } from './schedule-parser.js';

export type PreDetectBranch =
  | { kind: 'run_llm' }
  | { kind: 'schedule_response'; reason: string }
  | { kind: 'silent_handoff'; reason: string };

export type PreDetectInput = {
  /** Lead existente vinculado à conversation (null se primeiro turno). */
  lead: LeadRow | null;
  /** Texto da mensagem inbound atual. */
  currentMessage: string;
};

export const preDetect = (input: PreDetectInput): PreDetectBranch => {
  const lead = input.lead;
  if (!lead) return { kind: 'run_llm' };

  const status = lead.status;

  if (
    status === 'converted' ||
    status === 'lost' ||
    status === 'dropped'
  ) {
    return {
      kind: 'silent_handoff',
      reason: `lead em status terminal (${status}) — bot não responde mais`,
    };
  }

  if (status === 'scheduled_pending') {
    return {
      kind: 'silent_handoff',
      reason:
        'lead já agendou horário (status=scheduled_pending) — humano cuida das próximas mensagens',
    };
  }

  if (status === 'qualified' && hasScheduleHint(input.currentMessage)) {
    return {
      kind: 'schedule_response',
      reason: 'lead qualificado respondeu com sugestão de horário',
    };
  }

  return { kind: 'run_llm' };
};
