// =============================================================================
// Pre-classify determinístico — atalhos antes de chamar LLM.
//
// Sprint 1.2: dois atalhos seguros:
// 1. Mensagem não-texto → `requer_humano` (Coordenador não interpreta áudio/
//    imagem; transcrição/OCR é Sprint 1.5+).
// 2. Mensagem curta com padrão claro de saudação → `social.saudacao` direto.
//    Evita pagar Sonnet por mensagem trivial.
//
// `confidence = null` indica decisão determinística (não-LLM). Persistimos
// null no DB pra distinguir de "classificou e ficou inseguro".
// =============================================================================

import type { AtendimentoIntentSlug } from '@office/shared-domain';

export type PreClassifyInput = {
  contentTrimmed: string;
  mediaType: string;
};

export type PreClassifyResult =
  | {
      handled: true;
      intent: AtendimentoIntentSlug;
      reasoning: string;
    }
  | { handled: false };

// Word boundary \b com unicode (á/é/ç) não funciona como em ASCII — usamos
// negative lookbehind/lookahead simulado por anchors de início/fim ou
// separador não-alfanumérico. Pra Sprint 1.2, basta procurar substring; o
// limite de 30 caracteres do contexto evita falso positivo em texto rico.
const GREETING_REGEX =
  /(?:^|\s)(oi|ol[áa]|bom\s*dia|boa\s*tarde|boa\s*noite|hello|hi|hey|ei|opa|saudaç[ãa]o)/i;

const FAREWELL_REGEX = /(?:^|\s)(tchau|falou|at[ée]\s*mais|bye)/i;

const THANKS_REGEX =
  /(?:^|\s)(obrigad[oa]|valeu|agradeç[oa]|thanks?|thx|brigad[oa])/i;

const isTextMedia = (mediaType: string): boolean =>
  mediaType === 'text' || mediaType === 'system_event';

export const preClassify = (input: PreClassifyInput): PreClassifyResult => {
  if (!isTextMedia(input.mediaType)) {
    return {
      handled: true,
      intent: 'requer_humano',
      reasoning: `mensagem do tipo ${input.mediaType} não é texto — encaminhar pra humano`,
    };
  }

  const text = input.contentTrimmed;

  // Mensagens curtas com padrão social claro classificam direto.
  // Limite de 30 caracteres evita "bom dia, vocês fazem ECD?" cair em
  // social.saudacao quando deveria ser operacional.duvida_geral.
  if (text.length > 0 && text.length <= 30) {
    if (THANKS_REGEX.test(text)) {
      return {
        handled: true,
        intent: 'social.agradecimento',
        reasoning: 'mensagem curta com padrão de agradecimento',
      };
    }
    if (FAREWELL_REGEX.test(text)) {
      return {
        handled: true,
        intent: 'social.despedida',
        reasoning: 'mensagem curta com padrão de despedida',
      };
    }
    if (GREETING_REGEX.test(text)) {
      return {
        handled: true,
        intent: 'social.saudacao',
        reasoning: 'mensagem curta com padrão de saudação',
      };
    }
  }

  return { handled: false };
};
