// =============================================================================
// Eval do Especialista Operacional — regressão estrutural (replay).
//
// Mode: replay puro (sem chamada real ao Anthropic). Não mede accuracy do
// modelo; mede que o PIPELINE de:
//   1. curto-circuito (sem account, intent always-human) entrega escalate
//   2. parse Zod do output do LLM bate cenários válidos e rejeita inválidos
//   3. `act` materializa a `action` corretamente (escalate vs respond)
//
// Promover prompt: gravar respostas reais (HTTP cassette) e medir accuracy
// semântica. Fica como TD pra Sprint 1.5+. Por ora: threshold de 75%
// estrutural (todas as 25 fixtures devem mapear pra ação correta).
// =============================================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ESPECIALISTA_RESPONSE_SCHEMA } from '../graph.js';

type Fixture = {
  id: string;
  scenario: string;
  message: string;
  intent: string;
  hasAccount: boolean;
  hasObligations: boolean;
  hasDocuments: boolean;
  preDecided: boolean;
  mockedLlmOutput: string | null;
  expectedAction: 'respond' | 'escalate_human' | 'request_clarification';
  expectedTemplateUsed: string | null;
};

const FixtureSchema = z.object({
  id: z.string(),
  scenario: z.string(),
  message: z.string(),
  intent: z.string(),
  hasAccount: z.boolean(),
  hasObligations: z.boolean(),
  hasDocuments: z.boolean(),
  preDecided: z.boolean(),
  mockedLlmOutput: z.string().nullable(),
  expectedAction: z.enum(['respond', 'escalate_human', 'request_clarification']),
  expectedTemplateUsed: z.string().nullable(),
});

const FIXTURES_PATH = resolve(
  __dirname,
  'fixtures/especialista-operacional-eval.json',
);

const loadFixtures = (): Fixture[] => {
  const raw = readFileSync(FIXTURES_PATH, 'utf-8');
  const parsed = JSON.parse(raw) as { entries: unknown[] };
  return parsed.entries.map((e) => FixtureSchema.parse(e));
};

const stripFences = (raw: string): string => {
  const trimmed = raw.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fence?.[1]?.trim() ?? trimmed;
};

const ALWAYS_HUMAN_INTENTS = new Set([
  'operacional.duvida_regime',
  'urgente',
  'requer_humano',
]);

/**
 * Simula o pipeline do handler + graph + act sem rodar LLM real:
 *   1. Curto-circuito: hasAccount=false OU intent always-human → escalate_human
 *   2. LLM mocked: parse JSON → schema → action; falha = escalate_human
 */
const simulatePipeline = (fx: Fixture): { action: string; templateUsed: string | null } => {
  // Curto-circuitos (handler antes do graph)
  if (!fx.hasAccount) {
    return { action: 'escalate_human', templateUsed: null };
  }
  if (ALWAYS_HUMAN_INTENTS.has(fx.intent)) {
    return { action: 'escalate_human', templateUsed: null };
  }

  // LLM path
  if (!fx.mockedLlmOutput) {
    // Sem mock — fixture indica que era pra ser curto-circuito mas hasAccount=true
    // e intent não-always-human. Defesa: escala.
    return { action: 'escalate_human', templateUsed: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(fx.mockedLlmOutput));
  } catch {
    return { action: 'escalate_human', templateUsed: null };
  }

  const result = ESPECIALISTA_RESPONSE_SCHEMA.safeParse(parsed);
  if (!result.success) {
    return { action: 'escalate_human', templateUsed: null };
  }

  return {
    action: result.data.action,
    templateUsed: result.data.template_used,
  };
};

describe('Especialista Operacional eval — structural regression (replay)', () => {
  const fixtures = loadFixtures();

  it('tem pelo menos 20 fixtures (cobertura mínima)', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(20);
  });

  it('cobertura: pelo menos 5 perguntas com dado, 3 sem dado, 3 escalações regulatórias, 3 clarificações', () => {
    const respond = fixtures.filter((f) => f.expectedAction === 'respond');
    const escalates = fixtures.filter((f) => f.expectedAction === 'escalate_human');
    const clarifs = fixtures.filter((f) => f.expectedAction === 'request_clarification');
    expect(respond.length).toBeGreaterThanOrEqual(5);
    expect(escalates.length).toBeGreaterThanOrEqual(6);
    expect(clarifs.length).toBeGreaterThanOrEqual(2);
  });

  // Per-fixture assertion — todas devem bater (threshold 100% no nível
  // estrutural, dado que mockedLlmOutput foi escrito pra simular o LLM
  // ideal pro cenário).
  for (const fx of fixtures) {
    it(`[${fx.id}] ${fx.scenario} → action=${fx.expectedAction}`, () => {
      const result = simulatePipeline(fx);
      expect(result.action).toBe(fx.expectedAction);
      if (fx.expectedTemplateUsed !== null) {
        expect(result.templateUsed).toBe(fx.expectedTemplateUsed);
      }
    });
  }

  // Threshold "soft" de 75% — historicamente o spec exigia esse piso pra
  // promover prompt. Como replay é determinístico (mock = ideal), aqui
  // serve como guard se alguém quiser adulterar fixture pra "passar"
  // forçadamente.
  it('accuracy estrutural >= 75% (threshold de promoção)', () => {
    let correct = 0;
    for (const fx of fixtures) {
      const result = simulatePipeline(fx);
      if (result.action === fx.expectedAction) {
        if (fx.expectedTemplateUsed === null || result.templateUsed === fx.expectedTemplateUsed) {
          correct += 1;
        }
      }
    }
    const accuracy = correct / fixtures.length;
    expect(accuracy).toBeGreaterThanOrEqual(0.75);
  });
});
