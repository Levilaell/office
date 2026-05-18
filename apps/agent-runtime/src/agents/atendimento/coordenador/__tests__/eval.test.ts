// =============================================================================
// Eval do Coordenador — regressão estrutural.
//
// Mode: replay puro (sem chamada real ao Anthropic). Não mede accuracy do
// modelo; mede que o PIPELINE de classificação processa um conjunto fixo de
// mensagens da forma esperada:
//
//   1. pre-classify decide o que pode (sociais curtas, não-texto)
//   2. quando vai pro LLM, o JSON mockado é parseado validamente
//   3. decide() mapeia intent + confidence → decision esperada
//
// Substituir mockResponse por gravação real (HTTP cassette) vira Sprint 1.5+
// quando promovermos prompt e quisermos detectar regressão semântica.
// =============================================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { decide } from '../decide.js';
import { preClassify } from '../pre-classify.js';
import { CLASSIFICATION_SCHEMA } from '../graph.js';

type Fixture = {
  id: string;
  content: string;
  mediaType: string;
  preClassifyExpected: string;
  llmResponse?: string;
  expectedIntent: string;
  expectedDecision: 'respond_direct' | 'handoff_specialist' | 'escalate_human' | 'ignore';
  expectedPromoted?: boolean;
};

const FixtureSchema = z.object({
  id: z.string(),
  content: z.string(),
  mediaType: z.string(),
  preClassifyExpected: z.string(),
  llmResponse: z.string().optional(),
  expectedIntent: z.string(),
  expectedDecision: z.enum([
    'respond_direct',
    'handoff_specialist',
    'escalate_human',
    'ignore',
  ]),
  expectedPromoted: z.boolean().optional(),
});

const FIXTURES_PATH = resolve(__dirname, 'fixtures/coordenador-eval.json');

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

const tryParse = (
  raw: string,
):
  | { ok: true; intent: string; confidence: number }
  | { ok: false; error: string } => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  const result = CLASSIFICATION_SCHEMA.safeParse(parsed);
  if (!result.success) return { ok: false, error: result.error.message };
  return { ok: true, intent: result.data.intent, confidence: result.data.confidence };
};

describe('Coordenador eval — structural regression (replay)', () => {
  const fixtures = loadFixtures();

  it('tem pelo menos 30 fixtures (cobertura por categoria)', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(30);
  });

  for (const fx of fixtures) {
    it(`[${fx.id}] processa ${fx.expectedIntent} → ${fx.expectedDecision}`, () => {
      // 1. Pre-classify.
      const pre = preClassify({
        contentTrimmed: fx.content.trim(),
        mediaType: fx.mediaType,
      });

      if (fx.preClassifyExpected !== 'llm') {
        // Pre-classify deve resolver — verifica o caminho.
        expect(pre.handled).toBe(true);
        if (pre.handled) {
          expect(pre.intent).toBe(fx.preClassifyExpected);
        }
        const decision = decide({ intent: pre.handled ? pre.intent : '', confidence: null });
        expect(decision.intent).toBe(fx.expectedIntent);
        expect(decision.decision).toBe(fx.expectedDecision);
        return;
      }

      // 2. Pre-classify NÃO resolve — usamos o llmResponse do fixture.
      expect(pre.handled).toBe(false);
      const llmText = fx.llmResponse;
      if (!llmText) {
        throw new Error(`fixture ${fx.id} declarou preClassifyExpected=llm mas não tem llmResponse`);
      }

      const parsed = tryParse(llmText);
      if (!parsed.ok) {
        // JSON inválido — agente vai escalate_human com intent=requer_humano.
        const decision = decide({ intent: 'requer_humano', confidence: null });
        expect(decision.intent).toBe(fx.expectedIntent);
        expect(decision.decision).toBe(fx.expectedDecision);
        return;
      }

      const decision = decide({ intent: parsed.intent, confidence: parsed.confidence });
      expect(decision.intent).toBe(fx.expectedIntent);
      expect(decision.decision).toBe(fx.expectedDecision);
      if (fx.expectedPromoted !== undefined) {
        expect(decision.promoted).toBe(fx.expectedPromoted);
      }
    });
  }
});
