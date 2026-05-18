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
  it('encontra todos os 10 templates declarados (6 Sprint 1.2 + 4 Sprint 1.3)', () => {
    expect(ATENDIMENTO_TEMPLATES).toHaveLength(10);
    for (const t of ATENDIMENTO_TEMPLATES) {
      expect(getTemplateById(t.id)?.id).toBe(t.id);
    }
  });
});

// Sprint 1.3 — testes pros templates do Especialista Operacional.
describe('T03 (doc recebido)', () => {
  it('renderiza com doc_label', () => {
    const result = renderTemplate('T03', {
      bot_name: 'Equipe X',
      doc_label: 'NF 12345',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toContain('NF 12345');
      expect(result.content).toContain('Equipe X');
      expect(result.content).not.toContain('{{');
    }
  });

  it('rejeita sem doc_label', () => {
    const result = renderTemplate('T03', { bot_name: 'X' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toEqual(['doc_label']);
    }
  });
});

describe('T06 (status obrigação)', () => {
  it('renderiza com todas as obrigatórias + amount_phrase opcional', () => {
    const result = renderTemplate('T06', {
      bot_name: 'Equipe X',
      obligation_label: 'DAS de outubro/2026',
      due_date_label: 'dia 20/10/2026',
      status_label: 'em aberto',
      amount_phrase: ' — valor R$ 487,30',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toContain('DAS de outubro/2026');
      expect(result.content).toContain('R$ 487,30');
      expect(result.content).toContain('em aberto');
      expect(result.content).not.toContain('{{');
    }
  });

  it('renderiza sem amount_phrase (vazia ou ausente)', () => {
    const result = renderTemplate('T06', {
      bot_name: 'Equipe X',
      obligation_label: 'INSS de outubro/2026',
      due_date_label: 'dia 20/10',
      status_label: 'em aberto',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).not.toContain('{{');
      expect(result.content).toContain('INSS de outubro/2026: vencimento em dia 20/10. Status: em aberto');
    }
  });

  it('rejeita sem obligation_label', () => {
    const result = renderTemplate('T06', {
      bot_name: 'X',
      due_date_label: 'X',
      status_label: 'X',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toContain('obligation_label');
    }
  });
});

describe('T07 (doc pendente)', () => {
  it('renderiza com doc_label e competencia_label', () => {
    const result = renderTemplate('T07', {
      bot_name: 'X',
      doc_label: 'NF de venda de outubro',
      competencia_label: 'outubro/2026',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toContain('NF de venda de outubro');
      expect(result.content).toContain('outubro/2026');
    }
  });
});

describe('T_NO_DATA', () => {
  it('renderiza só com bot_name', () => {
    const result = renderTemplate('T_NO_DATA', { bot_name: 'Equipe Levi' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toContain('Não consegui encontrar');
      expect(result.content).toContain('Equipe Levi');
    }
  });
});
