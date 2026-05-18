// =============================================================================
// Testes dos formatters do Especialista Operacional (pt-BR de dado canônico).
// =============================================================================

import { describe, expect, it } from 'vitest';
import type {
  AccountSnapshot,
  DocumentSnapshot,
  ObligationSnapshot,
} from '@office/shared-domain';
import {
  formatAccountSummary,
  formatBrCompetencia,
  formatBrCurrency,
  formatBrDate,
  formatDocumentsList,
  formatObligationsList,
} from '../tools/formatting.js';

describe('formatBrDate', () => {
  it('converte ISO date pra DD/MM/YYYY', () => {
    expect(formatBrDate('2026-10-20')).toBe('20/10/2026');
  });

  it('aceita ISO datetime e usa só a parte de data', () => {
    expect(formatBrDate('2026-10-20T15:30:00Z')).toBe('20/10/2026');
  });

  it('retorna original em formato inválido', () => {
    expect(formatBrDate('20/10/2026')).toBe('20/10/2026');
  });
});

describe('formatBrCompetencia', () => {
  it('converte YYYY-MM em mês/ano PT-BR', () => {
    expect(formatBrCompetencia('2026-10')).toBe('outubro/2026');
    expect(formatBrCompetencia('2026-03')).toBe('março/2026');
  });

  it('retorna original em formato inválido', () => {
    expect(formatBrCompetencia('outubro')).toBe('outubro');
  });
});

describe('formatBrCurrency', () => {
  it('formata número como BRL', () => {
    const formatted = formatBrCurrency(487.3);
    expect(formatted).toMatch(/R\$/);
    expect(formatted).toContain('487');
  });

  it('null retorna string vazia', () => {
    expect(formatBrCurrency(null)).toBe('');
  });
});

describe('formatAccountSummary', () => {
  it('renderiza snapshot completo com matriz e filial', () => {
    const snapshot: AccountSnapshot = {
      id: 'a1',
      tenantId: 't1',
      cnpj: '12.345.678/0001-90',
      razaoSocial: 'Padaria Teste LTDA',
      nomeFantasia: 'Padaria Boa',
      regimeTributario: 'simples_nacional',
      status: 'active',
      entities: [
        {
          id: 'e1',
          type: 'matriz',
          inscricaoEstadual: 'IE-1',
          inscricaoMunicipal: 'IM-1',
        },
        {
          id: 'e2',
          type: 'filial',
          inscricaoEstadual: null,
          inscricaoMunicipal: null,
        },
      ],
    };
    const out = formatAccountSummary(snapshot);
    expect(out).toContain('Padaria Teste LTDA');
    expect(out).toContain('Simples Nacional');
    expect(out).toContain('12.345.678/0001-90');
    expect(out).toContain('1 matriz');
    expect(out).toContain('1 filial');
  });

  it('null retorna mensagem de fallback', () => {
    const out = formatAccountSummary(null);
    expect(out.toLowerCase()).toContain('não encontrada');
  });

  it('regime tributário desconhecido cai no slug', () => {
    const snapshot: AccountSnapshot = {
      id: 'a1',
      tenantId: 't1',
      cnpj: '00',
      razaoSocial: 'X',
      nomeFantasia: null,
      regimeTributario: 'mei',
      status: 'active',
      entities: [],
    };
    expect(formatAccountSummary(snapshot)).toContain('MEI');
  });
});

describe('formatObligationsList', () => {
  it('formata lista com competencia + due_date + status', () => {
    const obligations: ObligationSnapshot[] = [
      {
        id: 'ob1',
        type: 'das',
        category: 'federal',
        description: null,
        competencia: '2026-10',
        dueDate: '2026-10-20',
        amount: 487.3,
        amountPaid: null,
        status: 'pending',
        paymentMethod: null,
        paymentLink: null,
        notes: null,
      },
    ];
    const out = formatObligationsList(obligations);
    expect(out).toContain('DAS');
    expect(out).toContain('outubro/2026');
    expect(out).toContain('20/10/2026');
    expect(out).toContain('em aberto');
    expect(out).toContain('487');
  });

  it('amount null não renderiza phrase de valor', () => {
    const obligations: ObligationSnapshot[] = [
      {
        id: 'ob1',
        type: 'dctfweb',
        category: 'federal',
        description: null,
        competencia: '2026-10',
        dueDate: '2026-10-15',
        amount: null,
        amountPaid: null,
        status: 'pending',
        paymentMethod: null,
        paymentLink: null,
        notes: null,
      },
    ];
    const out = formatObligationsList(obligations);
    expect(out).not.toMatch(/R\$/);
  });

  it('lista vazia retorna string vazia', () => {
    expect(formatObligationsList([])).toBe('');
  });
});

describe('formatDocumentsList', () => {
  it('formata documento com competencia + reference_date', () => {
    const docs: DocumentSnapshot[] = [
      {
        id: 'd1',
        type: 'nf_venda',
        category: 'fiscal',
        description: 'NFe 12345',
        competencia: '2026-10',
        referenceDate: '2026-10-10',
        status: 'received',
        receivedAt: null,
        processedAt: null,
        notes: null,
      },
    ];
    const out = formatDocumentsList(docs);
    expect(out).toContain('nf_venda');
    expect(out).toContain('outubro/2026');
    expect(out).toContain('10/10/2026');
    expect(out).toContain('NFe 12345');
    expect(out).toContain('recebido');
  });

  it('lista vazia retorna string vazia', () => {
    expect(formatDocumentsList([])).toBe('');
  });
});
