import { describe, expect, it } from 'vitest';
import { decide, CONFIDENCE_FLOOR } from '../decide.js';

describe('decide', () => {
  it('intent desconhecido escala humano com flag promoted=true', () => {
    const result = decide({ intent: 'inventado.qualquer_coisa', confidence: 0.9 });
    expect(result.decision).toBe('escalate_human');
    expect(result.definition).toBeNull();
    expect(result.promoted).toBe(true);
  });

  it('intent social.saudacao + confidence alta → respond_direct', () => {
    const result = decide({ intent: 'social.saudacao', confidence: 0.92 });
    expect(result.decision).toBe('respond_direct');
    expect(result.definition?.template).toBe('T02');
    expect(result.promoted).toBe(false);
  });

  it('respond_direct com confidence baixa é promovido a escalate_human', () => {
    const result = decide({
      intent: 'social.saudacao',
      confidence: CONFIDENCE_FLOOR - 0.01,
    });
    expect(result.decision).toBe('escalate_human');
    expect(result.promoted).toBe(true);
  });

  it('intent operacional → handoff_specialist sem promoção (mesmo com confidence baixa)', () => {
    const result = decide({
      intent: 'operacional.status_obrigacao',
      confidence: 0.5,
    });
    expect(result.decision).toBe('handoff_specialist');
    expect(result.definition?.targetAgent).toBe(
      'atendimento.especialista_operacional',
    );
    expect(result.promoted).toBe(false);
  });

  it('intent alwaysHuman (urgente) sempre escala', () => {
    const result = decide({ intent: 'urgente', confidence: 1.0 });
    expect(result.decision).toBe('escalate_human');
    expect(result.promoted).toBe(false); // urgente já tem defaultDecision=escalate
  });

  it('operacional.duvida_regime escala independente da confidence', () => {
    const result = decide({
      intent: 'operacional.duvida_regime',
      confidence: 0.99,
    });
    expect(result.decision).toBe('escalate_human');
  });

  it('confidence null preserva defaultDecision (caso pre-classify determinístico)', () => {
    const result = decide({ intent: 'social.saudacao', confidence: null });
    expect(result.decision).toBe('respond_direct');
    expect(result.promoted).toBe(false);
  });
});
