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
  it('encontra todos os templates declarados', () => {
    // Sprint 1.2: 6 (T02, T_THANKS, T_BYE, T04, T05, T13)
    // Sprint 1.3: +4 (T03, T06, T07, T_NO_DATA)
    // Sprint 1.4: +5 (T08, T08b, T09, T10, T10b)
    // Total: 15
    expect(ATENDIMENTO_TEMPLATES).toHaveLength(15);
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

describe('templates Comercial (Sprint 1.4)', () => {
  it('T08 renderiza com lead_first_name', () => {
    const result = renderTemplate('T08', { lead_first_name: 'João' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toBe(
        'Que ótimo ter você por aqui, João! Pra te ajudar da melhor forma, posso fazer algumas perguntas rápidas?',
      );
    }
  });

  it('T08 rejeita sem lead_first_name', () => {
    const result = renderTemplate('T08', {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('missing_variables');
      expect(result.missing).toEqual(['lead_first_name']);
    }
  });

  it('T08b renderiza sem variáveis obrigatórias', () => {
    const result = renderTemplate('T08b', {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toContain('qual seu nome?');
    }
  });

  it('T09 passthrough — preserva content exato', () => {
    const result = renderTemplate('T09', {
      content: 'Qual o porte da empresa?',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toBe('Qual o porte da empresa?');
    }
  });

  it('T09 preserva content multi-linha (contexto + pergunta)', () => {
    const multiline = 'Boa, João!\n\nQual o porte da empresa?';
    const result = renderTemplate('T09', { content: multiline });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toBe(multiline);
    }
  });

  it('T09 rejeita content vazio ou só whitespace', () => {
    const empty = renderTemplate('T09', { content: '' });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.reason).toBe('missing_variables');

    const blank = renderTemplate('T09', { content: '   ' });
    expect(blank.ok).toBe(false);
    if (!blank.ok) expect(blank.reason).toBe('missing_variables');
  });

  it('T10 renderiza com lead_first_name e responsavel_name', () => {
    const result = renderTemplate('T10', {
      lead_first_name: 'João',
      responsavel_name: 'Equipe Levi',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toContain('Perfeito, João');
      expect(result.content).toContain('com Equipe Levi');
      expect(result.content).toContain('Qual o melhor dia e horário');
    }
  });

  it('T10 exige ambos lead_first_name e responsavel_name', () => {
    const semNome = renderTemplate('T10', { responsavel_name: 'X' });
    expect(semNome.ok).toBe(false);
    const semResp = renderTemplate('T10', { lead_first_name: 'João' });
    expect(semResp.ok).toBe(false);
  });

  it('T10b renderiza com responsavel_name', () => {
    const result = renderTemplate('T10b', { responsavel_name: 'Levi' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toContain('Combinado!');
      expect(result.content).toContain('Vou confirmar com Levi');
    }
  });

  it('T10b exige responsavel_name', () => {
    const result = renderTemplate('T10b', {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toEqual(['responsavel_name']);
    }
  });
});
