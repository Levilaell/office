import { describe, expect, it } from 'vitest';
import {
  ATENDIMENTO_INTENTS,
  ATENDIMENTO_INTENT_SLUGS,
  getIntentDefinition,
  isKnownIntent,
} from '../intents';

describe('ATENDIMENTO_INTENTS catalog', () => {
  it('contém os 15 intents esperados pra Sprint 1.2', () => {
    expect(ATENDIMENTO_INTENT_SLUGS).toHaveLength(15);
  });

  it('todos os intents sociais têm template e decisão respond_direct', () => {
    const social = ATENDIMENTO_INTENTS.filter((i) => i.category === 'social');
    expect(social).toHaveLength(3);
    for (const i of social) {
      expect(i.defaultDecision).toBe('respond_direct');
      expect(i.template).toBeTruthy();
    }
  });

  it('intents operacionais (exceto duvida_regime) vão pra especialista operacional', () => {
    const op = ATENDIMENTO_INTENTS.filter(
      (i) => i.category === 'operacional' && i.slug !== 'operacional.duvida_regime',
    );
    expect(op.length).toBeGreaterThan(0);
    for (const i of op) {
      expect(i.defaultDecision).toBe('handoff_specialist');
      expect(i.targetAgent).toBe('atendimento.especialista_operacional');
    }
  });

  it('operacional.duvida_regime escala sempre', () => {
    const intent = getIntentDefinition('operacional.duvida_regime');
    expect(intent?.defaultDecision).toBe('escalate_human');
    expect(intent?.alwaysHuman).toBe(true);
  });

  it('urgente e requer_humano são marcados alwaysHuman', () => {
    expect(getIntentDefinition('urgente')?.alwaysHuman).toBe(true);
    expect(getIntentDefinition('requer_humano')?.alwaysHuman).toBe(true);
  });

  it('isKnownIntent é precisamente o conjunto declarado', () => {
    for (const slug of ATENDIMENTO_INTENT_SLUGS) {
      expect(isKnownIntent(slug)).toBe(true);
    }
    expect(isKnownIntent('foo.bar')).toBe(false);
    expect(isKnownIntent('')).toBe(false);
  });

  it('templates referenciados em intents existem em ATENDIMENTO_TEMPLATES', async () => {
    // Importa lazy pra não cruzar dependência circular no nível do módulo.
    const { ATENDIMENTO_TEMPLATES } = await import('../templates/index');
    const templateIds = new Set(ATENDIMENTO_TEMPLATES.map((t) => t.id));
    // Cast pra forma "wider": const `as const satisfies` narra cada item ao
    // literal exato (alguns sem `template`); o teste só quer validar a
    // referência quando ela existe.
    type Wide = { template?: string };
    for (const intent of ATENDIMENTO_INTENTS as ReadonlyArray<Wide>) {
      if (intent.template) {
        expect(templateIds.has(intent.template)).toBe(true);
      }
    }
  });
});
