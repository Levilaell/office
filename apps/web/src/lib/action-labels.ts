// Mapeamento de action_type (snake_case canônico que o agente emite) pro
// label PT-BR mostrado pro humano no inbox. Mantém a lista enxuta — o
// fallback humaniza o snake_case se aparecer algo novo, evitando a UI
// quebrar com "transmit_obligation" cru.

const ACTION_LABELS: Record<string, string> = {
  submit_obligation: 'Transmitir obrigação',
  send_email: 'Enviar email',
  reply_message: 'Responder mensagem',
  register_alteration: 'Registrar alteração societária',
  close_period: 'Fechar competência',
  send_invoice: 'Enviar fatura',
  reconcile_account: 'Conciliar conta',
  issue_payment: 'Emitir pagamento',
  approve_document: 'Aprovar documento',
  upload_document: 'Anexar documento',
  schedule_meeting: 'Agendar reunião',
};

export function humanizeAction(actionType: string): string {
  if (!actionType) return 'Ação';
  return actionType
    .split('_')
    .map((part, idx) =>
      idx === 0 && part.length > 0
        ? part.charAt(0).toUpperCase() + part.slice(1)
        : part,
    )
    .join(' ')
    .trim();
}

export function getActionLabel(actionType: string): string {
  const mapped = ACTION_LABELS[actionType];
  if (mapped) return mapped;
  return humanizeAction(actionType);
}
