// Sprint 1.6 — tradutor de erros HTTP comuns pra mensagens decentes em
// PT-BR. Usado por callers que precisam mostrar erro pro operador.
//
// Estratégia: mapear códigos conhecidos pra mensagens curtas + actionable;
// devolver o body.error/reason quando vier (já é texto humano em vários
// endpoints); fallback genérico pra status sem regra.

export type HttpErrorBody = {
  error?: string;
  reason?: string;
  message?: string;
  issues?: Record<string, unknown>;
};

const KNOWN_API_ERRORS: Record<string, string> = {
  unauthorized: 'Você precisa estar logado pra fazer isso.',
  permission_denied:
    'Sem permissão pra essa ação. Pede pro admin do escritório.',
  user_not_provisioned:
    'Conta ainda não está totalmente configurada. Recarrega a página.',
  tenant_not_found: 'Escritório não encontrado.',
  approval_already_resolved:
    'Esse rascunho já foi decidido por alguém em outra aba ou expirou.',
  channel_send_failed:
    'Falha ao enviar pelo canal. Verifique o status em /atendimento/canais.',
  draft_already_decided: 'Esse rascunho já foi decidido.',
  invalid_body: 'Dados inválidos enviados ao servidor.',
};

const STATUS_FALLBACK: Record<number, string> = {
  400: 'Dados inválidos.',
  401: 'Sessão expirou. Faz login de novo.',
  403: 'Sem permissão pra essa ação.',
  404: 'Não encontramos isso.',
  409: 'Conflito — alguém já mudou esse estado.',
  429: 'Muitas tentativas seguidas. Espera um momento.',
  500: 'Algo deu errado no servidor. Tenta de novo em alguns segundos.',
  502: 'Falha na conexão com serviço externo.',
  503: 'Serviço indisponível.',
};

export function humanErrorMessage(
  status: number,
  body: HttpErrorBody | null | undefined = null,
): string {
  if (body) {
    const errKey = body.error?.trim().toLowerCase();
    if (errKey && KNOWN_API_ERRORS[errKey]) {
      const detail = body.reason ?? body.message;
      return detail
        ? `${KNOWN_API_ERRORS[errKey]} (${detail})`
        : KNOWN_API_ERRORS[errKey];
    }
    if (body.reason) return body.reason;
    if (body.error) return body.error;
    if (body.message) return body.message;
  }
  return STATUS_FALLBACK[status] ?? `Erro ${status}`;
}

/**
 * Conveniência pra parsing seguro de body JSON em respostas de erro.
 * Nunca lança — retorna null se body não é JSON.
 */
export async function parseHttpErrorBody(
  response: Response,
): Promise<HttpErrorBody | null> {
  try {
    const json = (await response.json()) as HttpErrorBody;
    if (json && typeof json === 'object') return json;
    return null;
  } catch {
    return null;
  }
}
