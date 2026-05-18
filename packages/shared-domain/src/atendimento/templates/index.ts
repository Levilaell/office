// =============================================================================
// Registry de templates de mensagem do Atendimento
//
// Sprint 1.2: 6 templates necessários pro Coordenador (T02, T_THANKS, T_BYE,
// T04, T05, T13). Outros (T01, T03, T06-T12) ficam como TD — Coordenador
// não precisa deles enquanto Especialistas não estão online.
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
import { T04_VOU_VERIFICAR } from './t04-vou-verificar';
import { T05_ESCALACAO } from './t05-escalacao';
import { T13_FORA_HORARIO } from './t13-fora-horario';

export const ATENDIMENTO_TEMPLATES = [
  T02_SAUDACAO,
  T_THANKS,
  T_BYE,
  T04_VOU_VERIFICAR,
  T05_ESCALACAO,
  T13_FORA_HORARIO,
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
