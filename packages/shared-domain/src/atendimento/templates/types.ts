// =============================================================================
// Tipos de template de mensagem do Atendimento
//
// Template é a forma como o Coordenador (e Especialistas, no futuro) entregam
// resposta determinística. Templates não chamam LLM — substituem
// `{{variavel}}` por valor injetado. Validação de obrigatórias acontece em
// `render` antes de gerar a string final.
// =============================================================================

import type { ConversationChannel } from '@office/shared-types';

export type TemplateValidationResult =
  | { ok: true }
  | { ok: false; missing: string[] };

export type TemplateVariables = Record<string, unknown>;

export type MessageTemplate = {
  id: string;
  version: string;
  name: string;
  required_variables: ReadonlyArray<string>;
  optional_variables: ReadonlyArray<string>;
  /** String com `{{placeholders}}`. Renderer faz substituição posicional sem
   *  parsing rico (Handlebars-like é overkill na Sprint 1.2). */
  template: string;
  channels: ReadonlyArray<ConversationChannel>;
  validate: (variables: TemplateVariables) => TemplateValidationResult;
};
