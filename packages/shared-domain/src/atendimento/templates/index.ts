// =============================================================================
// Registry de templates de mensagem do Atendimento
//
// Sprint 1.2: 6 templates necessários pro Coordenador (T02, T_THANKS, T_BYE,
// T04, T05, T13).
// Sprint 1.3: 4 templates adicionados pro Especialista Operacional (T03,
// T06, T07, T_NO_DATA).
// Sprint 1.4: 5 templates adicionados pro Especialista Comercial (T08, T08b,
// T09, T10, T10b). Demais (T01, T11, T12) só quando virarem necessários.
//
// `renderTemplate` faz substituição posicional `{{var}}` → valor. Validação
// de obrigatórias acontece antes da substituição: se variável obrigatória
// falta, retorna erro estruturado e caller decide (Coordenador escala
// humano em vez de mandar mensagem mutilada).
// =============================================================================

import type { MessageTemplate, TemplateVariables } from './types';
import { T02_SAUDACAO } from './t02-saudacao';
import { T_THANKS } from './t-thanks';
import { T_BYE } from './t-bye';
import { T03_DOC_RECEBIDO } from './t03-doc-recebido';
import { T04_VOU_VERIFICAR } from './t04-vou-verificar';
import { T05_ESCALACAO } from './t05-escalacao';
import { T06_STATUS_OBRIGACAO } from './t06-status-obrigacao';
import { T07_DOC_PENDENTE } from './t07-doc-pendente';
import { T08_SAUDACAO_LEAD } from './t08-saudacao-lead';
import { T08B_SAUDACAO_LEAD_SEM_NOME } from './t08b-saudacao-lead-sem-nome';
import { T09_PERGUNTA_SLOT } from './t09-pergunta-slot';
import { T10_FECHAMENTO_QUALIFICADO } from './t10-fechamento-qualificado';
import { T10B_FOLLOW_UP_HORARIO } from './t10b-follow-up-horario';
import { T13_FORA_HORARIO } from './t13-fora-horario';
import { T_NO_DATA } from './t-no-data';

export const ATENDIMENTO_TEMPLATES = [
  T02_SAUDACAO,
  T_THANKS,
  T_BYE,
  T03_DOC_RECEBIDO,
  T04_VOU_VERIFICAR,
  T05_ESCALACAO,
  T06_STATUS_OBRIGACAO,
  T07_DOC_PENDENTE,
  T08_SAUDACAO_LEAD,
  T08B_SAUDACAO_LEAD_SEM_NOME,
  T09_PERGUNTA_SLOT,
  T10_FECHAMENTO_QUALIFICADO,
  T10B_FOLLOW_UP_HORARIO,
  T13_FORA_HORARIO,
  T_NO_DATA,
] as const satisfies ReadonlyArray<MessageTemplate>;

export type AtendimentoTemplateId = (typeof ATENDIMENTO_TEMPLATES)[number]['id'];

const TEMPLATES_BY_ID: Record<string, MessageTemplate> = Object.fromEntries(
  ATENDIMENTO_TEMPLATES.map((t) => [t.id, t]),
);

export const getTemplateById = (id: string): MessageTemplate | undefined =>
  TEMPLATES_BY_ID[id];

export type RenderResult =
  | { ok: true; content: string }
  | { ok: false; reason: 'unknown_template' | 'missing_variables'; missing?: string[] };

const substitute = (template: string, vars: TemplateVariables): string => {
  // Regex captura `{{var}}` (sem espaços ao redor pra evitar match acidental
  // em código). Substituição posicional simples — sem helpers/filtros.
  return template.replace(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, (_, key: string) => {
    const value = vars[key];
    if (value === undefined || value === null) return '';
    return String(value);
  });
};

/**
 * Renderiza template por id. Retorna estrutura `ok=false` em vez de lançar
 * pra forçar caller a tratar erro explicitamente (no caso, Coordenador escala
 * pra humano e registra reasoning).
 */
export const renderTemplate = (
  id: string,
  variables: TemplateVariables,
): RenderResult => {
  const template = TEMPLATES_BY_ID[id];
  if (!template) {
    return { ok: false, reason: 'unknown_template' };
  }
  const validation = template.validate(variables);
  if (!validation.ok) {
    return { ok: false, reason: 'missing_variables', missing: validation.missing };
  }
  return { ok: true, content: substitute(template.template, variables) };
};

export type { MessageTemplate, TemplateVariables, TemplateValidationResult } from './types';
