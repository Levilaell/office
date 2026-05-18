import { describe, expect, it } from 'vitest';
import { tryParseEspecialistaOutput } from '../graph';

describe('tryParseEspecialistaOutput', () => {
  it('parse JSON limpo', () => {
    const raw = JSON.stringify({
      action: 'ask_next_slot',
      content: 'Qual seu nome?',
      extracted_slots: {},
      confidence: 0.9,
      reasoning: 'primeiro turno',
    });
    const r = tryParseEspecialistaOutput(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.action).toBe('ask_next_slot');
      expect(r.value.content).toBe('Qual seu nome?');
    }
  });

  it('parse JSON com code fences ```json', () => {
    const raw =
      '```json\n' +
      JSON.stringify({
        action: 'mark_qualified',
        content: 'Perfeito!',
        extracted_slots: { contact_name: 'João' },
        confidence: 0.95,
        reasoning: 'todos preenchidos',
      }) +
      '\n```';
    const r = tryParseEspecialistaOutput(raw);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.action).toBe('mark_qualified');
  });

  it('parse JSON com code fences ``` simples', () => {
    const raw =
      '```\n' +
      JSON.stringify({
        action: 'escalate_human',
        content: 'Vou pedir pra alguém da equipe.',
        extracted_slots: {},
        confidence: 0.8,
        reasoning: 'caso complexo',
        escalation_reason: 'dúvida regulatória',
      }) +
      '\n```';
    const r = tryParseEspecialistaOutput(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.action).toBe('escalate_human');
      expect(r.value.escalation_reason).toBe('dúvida regulatória');
    }
  });

  it('rejeita JSON inválido', () => {
    const r = tryParseEspecialistaOutput('{action: ask_next_slot}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('JSON inválido');
  });

  it('rejeita action desconhecida', () => {
    const r = tryParseEspecialistaOutput(
      JSON.stringify({
        action: 'do_something_weird',
        content: 'oi',
        extracted_slots: {},
        confidence: 0.5,
        reasoning: 'r',
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('schema inválido');
  });

  it('rejeita confidence fora do range [0,1]', () => {
    const r = tryParseEspecialistaOutput(
      JSON.stringify({
        action: 'ask_next_slot',
        content: 'x',
        extracted_slots: {},
        confidence: 1.5,
        reasoning: 'r',
      }),
    );
    expect(r.ok).toBe(false);
  });

  it('rejeita content vazio', () => {
    const r = tryParseEspecialistaOutput(
      JSON.stringify({
        action: 'ask_next_slot',
        content: '',
        extracted_slots: {},
        confidence: 0.5,
        reasoning: 'r',
      }),
    );
    expect(r.ok).toBe(false);
  });

  it('extracted_slots default {} quando ausente', () => {
    const r = tryParseEspecialistaOutput(
      JSON.stringify({
        action: 'ask_next_slot',
        content: 'oi',
        confidence: 0.5,
        reasoning: 'r',
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.extracted_slots).toEqual({});
  });
});
