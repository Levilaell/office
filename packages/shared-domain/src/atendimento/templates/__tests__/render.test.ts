import { describe, expect, it } from 'vitest';
import { renderTemplate, getTemplateById, ATENDIMENTO_TEMPLATES } from '../index';

describe('renderTemplate', () => {
  it('substitui placeholders simples', () => {
    const result = renderTemplate('T02', { bot_name: 'Equipe Levi Lael' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toBe('Oi! Aqui é Equipe Levi Lael, em que posso te ajudar?');
    }
  });

  it('rejeita quando template id é desconhecido', () => {
    const result = renderTemplate('T_NAO_EXISTE', {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('unknown_template');
    }
  });

  it('rejeita quando variável obrigatória falta', () => {
    const result = renderTemplate('T02', {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('missing_variables');
      expect(result.missing).toEqual(['bot_name']);
    }
  });

  it('T_THANKS renderiza corretamente', () => {
    const result = renderTemplate('T_THANKS', { bot_name: 'Contábil X' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toContain('Imagina');
      expect(result.content).toContain('Contábil X');
    }
  });

  it('T05 não inclui placeholder remanescente quando variável extra vem', () => {
    const result = renderTemplate('T05', {
      bot_name: 'Equipe',
      irrelevante: 'ignorado',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).not.toContain('{{');
      expect(result.content).toContain('Equipe');
    }
  });

  it('T13 exige next_business_window', () => {
    const missingWindow = renderTemplate('T13', { bot_name: 'Equipe' });
    expect(missingWindow.ok).toBe(false);
    if (!missingWindow.ok) {
      expect(missingWindow.missing).toEqual(['next_business_window']);
    }

    const ok = renderTemplate('T13', {
      bot_name: 'Equipe',
      next_business_window: 'amanhã às 08h',
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.content).toContain('amanhã às 08h');
    }
  });
});

describe('getTemplateById', () => {
  it('encontra todos os 6 templates declarados', () => {
    expect(ATENDIMENTO_TEMPLATES).toHaveLength(6);
    for (const t of ATENDIMENTO_TEMPLATES) {
      expect(getTemplateById(t.id)?.id).toBe(t.id);
    }
  });
});
