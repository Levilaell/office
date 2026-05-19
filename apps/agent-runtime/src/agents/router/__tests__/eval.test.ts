// =============================================================================
// Eval do Roteador — regressão estrutural.
//
// Mode: replay puro (sem chamada real ao Anthropic). Não mede accuracy do
// modelo; mede que o PIPELINE de classificação processa um conjunto fixo de
// mensagens da forma esperada:
//
//   1. O JSON mockado `llmResponse` é parseado validamente
//   2. ROUTER_DECISION_SCHEMA aceita o `department` esperado
//   3. Confidence label bate com o cassette
//
// Cobertura obrigatória do prompt v1.1.0 (Sprint Fase 2-prep):
//   - >= 5 mensagens classificadas em `atendimento`
//   - >= 5 mensagens classificadas em `societario`
//   - >= 5 mensagens classificadas em `platform`
//   - Pelo menos 1 mensagem em cada um dos outros 4 departamentos
//
// Substituir mockResponse por gravação real (HTTP cassette) com Anthropic vira
// TD pra sprint subsequente (TD-015 cobre Coordenador; criar similar pro Router).
// =============================================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { DEPARTMENTS, ROUTER_DECISION_SCHEMA, type RouterDepartment } from '../graph.js';

type Fixture = {
  id: string;
  content: string;
  llmResponse: string;
  expectedDepartment: RouterDepartment;
  expectedConfidence: 'high' | 'medium' | 'low';
};

const FixtureSchema = z.object({
  id: z.string(),
  content: z.string(),
  llmResponse: z.string(),
  expectedDepartment: z.enum(DEPARTMENTS),
  expectedConfidence: z.enum(['high', 'medium', 'low']),
});

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES_PATH = resolve(__dirname, 'fixtures/router-eval.json');

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

describe('Roteador eval — structural regression (replay)', () => {
  const fixtures = loadFixtures();

  it('tem pelo menos 20 fixtures', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(20);
  });

  it('cobre todos os 7 departamentos (incluindo platform)', () => {
    const departments = new Set(fixtures.map((f) => f.expectedDepartment));
    for (const dep of DEPARTMENTS) {
      expect(departments.has(dep), `falta fixture pra ${dep}`).toBe(true);
    }
  });

  it('tem mínimo de 5 fixtures pra atendimento, societario, platform', () => {
    const counts: Record<string, number> = {};
    for (const f of fixtures) {
      counts[f.expectedDepartment] = (counts[f.expectedDepartment] ?? 0) + 1;
    }
    expect(counts.atendimento ?? 0).toBeGreaterThanOrEqual(5);
    expect(counts.societario ?? 0).toBeGreaterThanOrEqual(5);
    expect(counts.platform ?? 0).toBeGreaterThanOrEqual(5);
  });

  for (const fx of fixtures) {
    it(`[${fx.id}] llmResponse parse + schema → ${fx.expectedDepartment}`, () => {
      const parsed = JSON.parse(stripFences(fx.llmResponse));
      const result = ROUTER_DECISION_SCHEMA.safeParse(parsed);
      expect(result.success, result.success ? '' : result.error.message).toBe(true);
      if (!result.success) return;
      expect(result.data.department).toBe(fx.expectedDepartment);
      expect(result.data.confidence).toBe(fx.expectedConfidence);
      expect(result.data.reasoning.length).toBeGreaterThan(0);
    });
  }
});
