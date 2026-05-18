// =============================================================================
// Formatadores pra renderizar dados estruturados em texto que cabe no prompt
// do Especialista Operacional.
//
// Mantém formatação consistente (datas BR, moeda BR) e separa lógica de
// apresentação da lógica do agente. Cada formatter é função pura,
// trivialmente testável.
// =============================================================================

import type {
  AccountSnapshot,
  DocumentSnapshot,
  ObligationSnapshot,
} from '@office/shared-domain';

const REGIME_LABEL: Record<string, string> = {
  simples_nacional: 'Simples Nacional',
  lucro_presumido: 'Lucro Presumido',
  lucro_real: 'Lucro Real',
  mei: 'MEI',
};

const STATUS_OBRIGACAO_LABEL: Record<string, string> = {
  pending: 'em aberto',
  paid: 'pago',
  overdue: 'vencido',
  cancelled: 'cancelado',
  in_dispute: 'em discussão',
};

const STATUS_DOC_LABEL: Record<string, string> = {
  pending: 'pendente',
  received: 'recebido',
  processed: 'processado',
  rejected: 'rejeitado',
  archived: 'arquivado',
};

/** Tenta formatar 'YYYY-MM-DD' em 'DD/MM/YYYY'. Se falhar, retorna original. */
export const formatBrDate = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
};

/** Tenta formatar 'YYYY-MM' em 'mês/ano' (PT-BR). */
export const formatBrCompetencia = (competencia: string): string => {
  const m = /^(\d{4})-(\d{2})$/.exec(competencia);
  if (!m) return competencia;
  const year = m[1];
  const month = m[2];
  const months = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ];
  const idx = parseInt(month ?? '0', 10) - 1;
  if (idx < 0 || idx > 11) return competencia;
  return `${months[idx]}/${year}`;
};

export const formatBrCurrency = (amount: number | null): string => {
  if (amount === null || amount === undefined) return '';
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

export const formatAccountSummary = (snapshot: AccountSnapshot | null): string => {
  if (!snapshot) {
    return '(account não encontrada — escalar humano)';
  }
  const regime = snapshot.regimeTributario
    ? REGIME_LABEL[snapshot.regimeTributario] ?? snapshot.regimeTributario
    : 'não informado';
  const lines = [
    `- Razão Social: ${snapshot.razaoSocial}`,
    `- CNPJ: ${snapshot.cnpj}`,
    `- Regime Tributário: ${regime}`,
    `- Status: ${snapshot.status}`,
  ];
  if (snapshot.entities.length > 0) {
    const matriz = snapshot.entities.find((e) => e.type === 'matriz');
    const filiais = snapshot.entities.filter((e) => e.type === 'filial');
    if (matriz || filiais.length > 0) {
      const parts: string[] = [];
      if (matriz) parts.push('1 matriz');
      if (filiais.length > 0) parts.push(`${filiais.length} filial(is)`);
      lines.push(`- Entidades: ${parts.join(' + ')}`);
    }
  }
  return lines.join('\n');
};

export const formatObligationsList = (
  obligations: ObligationSnapshot[],
): string => {
  if (obligations.length === 0) return '';
  return obligations
    .map((o) => {
      const status = STATUS_OBRIGACAO_LABEL[o.status] ?? o.status;
      const amount =
        o.amount !== null ? ` — valor ${formatBrCurrency(o.amount)}` : '';
      const competencia = formatBrCompetencia(o.competencia);
      const due = formatBrDate(o.dueDate);
      return `- [${o.id}] ${o.type.toUpperCase()} (${competencia}): vencimento em ${due}${amount}. Status: ${status}.`;
    })
    .join('\n');
};

export const formatDocumentsList = (documents: DocumentSnapshot[]): string => {
  if (documents.length === 0) return '';
  return documents
    .map((d) => {
      const status = STATUS_DOC_LABEL[d.status] ?? d.status;
      const ref = d.referenceDate ? ` em ${formatBrDate(d.referenceDate)}` : '';
      const desc = d.description ? ` — ${d.description}` : '';
      const comp = d.competencia ? ` (${formatBrCompetencia(d.competencia)})` : '';
      return `- [${d.id}] ${d.type}${comp}${ref}${desc}. Status: ${status}.`;
    })
    .join('\n');
};

/**
 * Decide o label do status pra T06 a partir do snapshot. Centralizado pra
 * agente não precisar mapear isso no prompt.
 */
export const renderObligationStatusLabel = (
  obligation: ObligationSnapshot,
): string => STATUS_OBRIGACAO_LABEL[obligation.status] ?? obligation.status;
