export type ApprovalPriority = 'low' | 'medium' | 'high' | 'urgent';

export type ApprovalDepartment =
  | 'atendimento'
  | 'societario'
  | 'pessoal'
  | 'fiscal'
  | 'contabil'
  | 'financeiro_interno';

export type MockApproval = {
  id: string;
  agentName: string;
  agentDepartment: ApprovalDepartment;
  actionType: string;
  actionLabel: string;
  description: string;
  proposal: Record<string, unknown>;
  context: Record<string, unknown>;
  priority: ApprovalPriority;
  createdAt: string;
  expiresAt?: string;
  accountName?: string;
};

export const PRIORITY_ORDER: ApprovalPriority[] = ['urgent', 'high', 'medium', 'low'];

export const PRIORITY_COLORS: Record<ApprovalPriority, { badge: string; label: string }> = {
  urgent: { badge: 'bg-red-500/15 text-red-400 border-red-500/30', label: 'Urgente' },
  high: { badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30', label: 'Alta' },
  medium: { badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', label: 'Média' },
  low: { badge: 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30', label: 'Baixa' },
};

export const DEPT_LABELS: Record<
  ApprovalDepartment,
  { label: string; color: string; emoji: string }
> = {
  atendimento: { label: 'Atendimento', color: 'bg-green-500/15 text-green-400', emoji: '💬' },
  societario: { label: 'Societário', color: 'bg-purple-500/15 text-purple-400', emoji: '🏢' },
  pessoal: { label: 'Pessoal', color: 'bg-amber-500/15 text-amber-400', emoji: '👥' },
  fiscal: { label: 'Fiscal', color: 'bg-red-500/15 text-red-400', emoji: '🧾' },
  contabil: { label: 'Contábil', color: 'bg-orange-500/15 text-orange-400', emoji: '📊' },
  financeiro_interno: {
    label: 'Financeiro Interno',
    color: 'bg-blue-500/15 text-blue-400',
    emoji: '💰',
  },
};

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const hoursFromNow = (h: number) => new Date(Date.now() + h * 60 * 60_000).toISOString();

export const MOCK_APPROVALS: MockApproval[] = [
  {
    id: '1',
    agentName: 'Coord. Fiscal',
    agentDepartment: 'fiscal',
    actionType: 'submit_obligation',
    actionLabel: 'Transmitir DCTFWeb',
    description:
      'Transmissão da DCTFWeb de competência 05/2026 com valores apurados pelo agente Apurador.',
    proposal: {
      obrigacao: 'DCTFWeb',
      competencia: '2026-05',
      valor_total: 12450.32,
      destinatario: 'Receita Federal',
    },
    context: {
      cliente: 'Padaria do João Ltda',
      cnpj: '12.345.678/0001-99',
      regime: 'lucro_presumido',
    },
    accountName: 'Padaria do João Ltda',
    priority: 'urgent',
    createdAt: minutesAgo(8),
    expiresAt: hoursFromNow(4),
  },
  {
    id: '2',
    agentName: 'Coord. Pessoal',
    agentDepartment: 'pessoal',
    actionType: 'send_email',
    actionLabel: 'Enviar contracheque por email',
    description:
      'Envio dos contracheques de maio/2026 para 12 funcionários da empresa cliente.',
    proposal: {
      destinatarios: 12,
      periodo: '2026-05',
      template: 'contracheque_padrao_v3',
    },
    context: {
      cliente: 'TechCorp Soluções Ltda',
      cnpj: '45.678.910/0001-22',
    },
    accountName: 'TechCorp Soluções Ltda',
    priority: 'medium',
    createdAt: minutesAgo(35),
  },
  {
    id: '3',
    agentName: 'Atendente de Triagem',
    agentDepartment: 'atendimento',
    actionType: 'reply_message',
    actionLabel: 'Responder mensagem do cliente',
    description:
      'Resposta automática a pedido de segunda via de DAS — agente classificou como rotina sem ambiguidade.',
    proposal: {
      mensagem:
        'Olá! Segue em anexo a segunda via da DAS de maio. Qualquer dúvida estou à disposição.',
      anexos: ['DAS_05_2026.pdf'],
    },
    context: {
      cliente: 'MEI Carlos Ferreira',
      canal: 'WhatsApp',
      mensagem_original: 'Boa tarde, consegue me mandar a DAS desse mês?',
    },
    accountName: 'MEI Carlos Ferreira',
    priority: 'low',
    createdAt: minutesAgo(120),
  },
  {
    id: '4',
    agentName: 'Coord. Societário',
    agentDepartment: 'societario',
    actionType: 'register_alteration',
    actionLabel: 'Registrar alteração contratual na JUCESP',
    description:
      'Protocolo de alteração de quadro societário e capital social. Ação regulatória — exige aprovação independente do tier.',
    proposal: {
      tipo: 'alteracao_contratual',
      junta: 'JUCESP',
      protocolo_estimado: '2026-05-16',
      socios_alterados: ['João Silva', 'Maria Souza'],
      novo_capital_social: 250000,
    },
    context: {
      cliente: 'Inovações Tech ME',
      cnpj: '98.765.432/0001-11',
      processo_id: 'soc_2026_0042',
    },
    accountName: 'Inovações Tech ME',
    priority: 'high',
    createdAt: minutesAgo(180),
    expiresAt: hoursFromNow(48),
  },
  {
    id: '5',
    agentName: 'Apurador Contábil',
    agentDepartment: 'contabil',
    actionType: 'close_period',
    actionLabel: 'Fechar competência 04/2026',
    description:
      'Encerramento de competência com lançamentos conciliados. Saldos consistentes com extrato bancário e folha.',
    proposal: {
      competencia: '2026-04',
      lancamentos: 142,
      receita_bruta: 87320.5,
      despesas_totais: 64210.18,
    },
    context: {
      cliente: 'Construtora Bom Lar Ltda',
      regime: 'lucro_real',
      ultima_conciliacao: '2026-05-12',
    },
    accountName: 'Construtora Bom Lar Ltda',
    priority: 'medium',
    createdAt: minutesAgo(25 * 60),
  },
  {
    id: '6',
    agentName: 'Coord. Financeiro Interno',
    agentDepartment: 'financeiro_interno',
    actionType: 'send_invoice',
    actionLabel: 'Enviar fatura mensal ao cliente',
    description:
      'Cobrança mensal da mensalidade do escritório. Valor padrão sem variações no contrato.',
    proposal: {
      destinatario: 'financeiro@padariadojoao.com.br',
      valor: 980,
      vencimento: '2026-05-25',
      meio: 'boleto + pix',
    },
    context: {
      cliente: 'Padaria do João Ltda',
      contrato_id: 'CTR-0042',
    },
    accountName: 'Padaria do João Ltda',
    priority: 'low',
    createdAt: minutesAgo(4 * 60),
  },
];
