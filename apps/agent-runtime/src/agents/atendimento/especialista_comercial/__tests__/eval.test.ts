// =============================================================================
// Eval do Especialista Comercial — regressão estrutural.
//
// Modo: replay puro (LLM mockado via fixture). Valida que o PIPELINE
// (pre-detect → parse → normalize) processa cada fixture do jeito esperado.
// Não mede accuracy do modelo real — isso é workflow scheduled (TD-015
// expandido).
//
// Cobertura: 28 fixtures distribuídas por categoria:
//   - novo (5)         — primeira mensagem variada
//   - meio (5)         — qualificação em progresso
//   - multi-slot (3)   — extração múltipla numa mensagem
//   - desvio (3)       — cliente pergunta sobre serviço, agente volta
//   - pede_humano (3)  — request_human_handoff
//   - fechamento (3)   — última mensagem que completa qualificação
//   - schedule (2)     — pre-detect schedule_response
//   - silent_handoff (2) — lead em estado terminal
//   - parse_error (2)  — output de LLM inválido
// =============================================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { tryParseEspecialistaOutput } from '../graph.js';
import { preDetect, type PreDetectBranch } from '../pre-detect.js';
import { normalizeExtractedSlots } from '../slot-extractor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FixtureLead = z.object({
  status: z.string(),
  qualification_data: z.record(z.string(), z.unknown()),
});

const FixtureSchema = z.object({
  id: z.string(),
  category: z.string(),
  lead: FixtureLead.nullable(),
  currentMessage: z.string(),
  preDetectExpected: z.enum(['run_llm', 'schedule_response', 'silent_handoff']),
  llmResponse: z.string().optional(),
  expectedAction: z.string(),
  expectedNextSlot: z.string().optional(),
  expectedExtractedSlots: z.record(z.string(), z.unknown()).optional(),
});

type Fixture = z.infer<typeof FixtureSchema>;

const FIXTURES_PATH = resolve(
  __dirname,
  'fixtures/especialista-comercial-eval.json',
);

const loadFixtures = (): Fixture[] => {
  const raw = readFileSync(FIXTURES_PATH, 'utf-8');
  const parsed = JSON.parse(raw) as { entries: unknown[] };
  return parsed.entries.map((e) => FixtureSchema.parse(e));
};

const buildLead = (fxLead: Fixture['lead']) => {
  if (!fxLead) return null;
  // Minimal LeadRow stub — pre-detect só lê status + (status==='qualified'
  // sai pra hasScheduleHint que ignora outros campos). Resto irrelevante.
  return {
    id: 'lead-stub',
    tenant_id: 'tenant-stub',
    primary_contact_id: null,
    primary_conversation_id: null,
    source: 'simulated_webhook',
    source_metadata: {},
    status: fxLead.status,
    qualification_data: fxLead.qualification_data,
    estimated_value_monthly: null,
    notes: null,
    assigned_to_user_id: null,
    converted_to_account_id: null,
    qualified_at: null,
    scheduled_call_at: null,
    converted_at: null,
    lost_reason: null,
    created_at: '2026-05-20T00:00:00Z',
    updated_at: '2026-05-20T00:00:00Z',
  } as never;
};

describe('Especialista Comercial eval — structural regression (replay)', () => {
  const fixtures = loadFixtures();

  it('tem pelo menos 20 fixtures cobrindo todas categorias core', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(20);
    const categories = new Set(fixtures.map((f) => f.category));
    // Categorias obrigatórias pra cobertura mínima
    expect(categories.has('novo')).toBe(true);
    expect(categories.has('meio')).toBe(true);
    expect(categories.has('multi-slot')).toBe(true);
    expect(categories.has('desvio')).toBe(true);
    expect(categories.has('pede_humano')).toBe(true);
    expect(categories.has('fechamento')).toBe(true);
    expect(categories.has('schedule')).toBe(true);
    expect(categories.has('silent_handoff')).toBe(true);
  });

  for (const fx of fixtures) {
    it(`[${fx.id}] (${fx.category}) processa preDetect=${fx.preDetectExpected} → action=${fx.expectedAction}`, () => {
      // 1. Pre-detect deve bater com o esperado.
      const branch: PreDetectBranch = preDetect({
        lead: buildLead(fx.lead),
        currentMessage: fx.currentMessage,
      });
      expect(branch.kind).toBe(fx.preDetectExpected);

      // 2. Se branch == run_llm, parse + normalize o LLM response.
      if (branch.kind === 'run_llm') {
        expect(fx.llmResponse).toBeDefined();
        const parsed = tryParseEspecialistaOutput(fx.llmResponse ?? '');

        if (fx.expectedAction === 'parse_error') {
          expect(parsed.ok).toBe(false);
          return;
        }

        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;

        expect(parsed.value.action).toBe(fx.expectedAction);

        const normalized = normalizeExtractedSlots(parsed.value.extracted_slots);
        if (fx.expectedExtractedSlots) {
          expect(normalized).toEqual(fx.expectedExtractedSlots);
        }

        if (fx.expectedNextSlot !== undefined) {
          expect(parsed.value.next_target_slot).toBe(fx.expectedNextSlot);
        }
      }
    });
  }

  // Threshold gate: em replay mode, 100% deve passar (deterministic).
  // Em workflow scheduled futuro com LLM real, threshold cai pra 70% pra
  // tolerar variabilidade Haiku — mesma lógica do TD-015 do Coordenador.
  it('accuracy estrutural deve ser 100% em modo replay', () => {
    let passes = 0;
    for (const fx of fixtures) {
      const branch = preDetect({
        lead: buildLead(fx.lead),
        currentMessage: fx.currentMessage,
      });
      if (branch.kind !== fx.preDetectExpected) continue;

      if (branch.kind === 'run_llm') {
        const parsed = tryParseEspecialistaOutput(fx.llmResponse ?? '');
        if (fx.expectedAction === 'parse_error') {
          if (!parsed.ok) passes++;
          continue;
        }
        if (!parsed.ok) continue;
        if (parsed.value.action !== fx.expectedAction) continue;
        if (fx.expectedExtractedSlots) {
          const normalized = normalizeExtractedSlots(parsed.value.extracted_slots);
          if (JSON.stringify(normalized) !== JSON.stringify(fx.expectedExtractedSlots)) {
            continue;
          }
        }
      }
      passes++;
    }
    const accuracy = passes / fixtures.length;
    expect(accuracy).toBeGreaterThanOrEqual(1.0);
  });
});
