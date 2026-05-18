// =============================================================================
// Decide — mapeia (intent + confidence + flags) em uma decisão concreta.
//
// Função pura. Recebe o intent decidido (pelo pre-classify ou pelo LLM) e
// converte em decisão (respond_direct / handoff_specialist / escalate_human
// / ignore) aplicando regras:
//
//  - Intent desconhecido → escalate_human (segurança contra LLM inventar).
//  - Intent com `alwaysHuman=true` → escalate_human, ignora defaultDecision.
//  - Confidence < CONFIDENCE_FLOOR e decision=respond_direct → escalate_human.
//    Razão: não responder direto quando o agente está inseguro.
// =============================================================================

import {
  getIntentDefinition,
  type AtendimentoIntentDefinition,
  type IntentDecision,
} from '@office/shared-domain';

export const CONFIDENCE_FLOOR = 0.65;

export type DecideInput = {
  intent: string;
  /** null aceita: pre-classify determinístico não tem confidence. */
  confidence: number | null;
};

export type DecideResult = {
  intent: string;
  decision: IntentDecision;
  definition: AtendimentoIntentDefinition | null;
  /** Razão da decisão final — vai pro audit_log e reasoning da classification. */
  rationale: string;
  /** Flag pra act detectar quando a decisão veio de fallback de segurança
   *  em vez do catálogo. Coordenador anexa essa info em decision_metadata. */
  promoted: boolean;
};

export const decide = (input: DecideInput): DecideResult => {
  const def = getIntentDefinition(input.intent) ?? null;

  if (!def) {
    return {
      intent: input.intent,
      decision: 'escalate_human',
      definition: null,
      rationale: `intent desconhecido "${input.intent}" — escalado por segurança`,
      promoted: true,
    };
  }

  if (def.alwaysHuman === true) {
    return {
      intent: def.slug,
      decision: 'escalate_human',
      definition: def,
      rationale: `intent ${def.slug} sempre escala pra humano`,
      promoted: def.defaultDecision !== 'escalate_human',
    };
  }

  if (
    def.defaultDecision === 'respond_direct' &&
    typeof input.confidence === 'number' &&
    input.confidence < CONFIDENCE_FLOOR
  ) {
    return {
      intent: def.slug,
      decision: 'escalate_human',
      definition: def,
      rationale: `confidence ${input.confidence.toFixed(2)} abaixo do piso ${CONFIDENCE_FLOOR}; escalado`,
      promoted: true,
    };
  }

  return {
    intent: def.slug,
    decision: def.defaultDecision,
    definition: def,
    rationale: `intent ${def.slug} → ${def.defaultDecision} (decisão padrão do catálogo)`,
    promoted: false,
  };
};
