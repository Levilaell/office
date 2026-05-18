// =============================================================================
// Parser de horário sugerido pelo cliente.
//
// Heurística pra Fase 1 — detectar QUE o cliente sugeriu um horário e,
// BEST EFFORT, transformar em Date. Falhas são toleráveis — humano vê a
// conversation e confirma. Registrar TD pra parser robusto no Sprint 1.5+.
//
// Implementação: tokeniza por whitespace+pontuação (evita Unicode word
// boundary do regex que falha com ç/ã), checa membership contra Set, mais
// regex tight pra horários explícitos.
// =============================================================================

const WEEKDAY_TOKENS = new Set<string>([
  'segunda',
  'segunda-feira',
  'seg',
  'terça',
  'terça-feira',
  'terca',
  'terca-feira',
  'ter',
  'quarta',
  'quarta-feira',
  'qua',
  'quinta',
  'quinta-feira',
  'qui',
  'sexta',
  'sexta-feira',
  'sex',
  'sábado',
  'sabado',
  'sab',
  'domingo',
  'dom',
  'amanhã',
  'amanha',
  'hoje',
]);

const TIME_OF_DAY_TOKENS = new Set<string>([
  'manhã',
  'manha',
  'tarde',
  'noite',
]);

const WEEK_PHRASES: ReadonlyArray<string> = [
  'final de semana',
  'fim de semana',
  'fds',
  'esta semana',
  'semana que vem',
  'próxima semana',
  'proxima semana',
];

/**
 * Horários explícitos com marcador (h, :, "às"). Não cai em "30 anos".
 */
const TIME_REGEX =
  /(?:^|[^A-Za-zÀ-ÿ0-9])(?:[àa]s?\s+\d{1,2}(?:[h:]\d{2})?|\d{1,2}h(?:\d{2})?|\d{1,2}:\d{2})(?:$|[^A-Za-zÀ-ÿ0-9])/iu;

const tokenize = (text: string): string[] => {
  return text
    .toLowerCase()
    .replace(/[?!.,;:()]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);
};

export const hasScheduleHint = (text: string): boolean => {
  const words = tokenize(text);
  for (const word of words) {
    if (WEEKDAY_TOKENS.has(word)) return true;
    if (TIME_OF_DAY_TOKENS.has(word)) return true;
  }
  const joined = words.join(' ');
  for (const phrase of WEEK_PHRASES) {
    if (joined.includes(phrase)) return true;
  }
  if (TIME_REGEX.test(text)) return true;
  return false;
};

/**
 * Parse best-effort. Retorna `{ scheduledAt, notes }`:
 * - notes: trim + slice 200 chars
 * - scheduledAt: null por enquanto — parser pra Date é TD pro Sprint 1.5+
 *   (precisaria mapear "terça da próxima semana" pra Date concreto com tz
 *   America/Sao_Paulo, lidar com "à tarde" sem hora).
 *
 * Operador humano confirma o horário exato com o cliente.
 */
export const parseScheduleSuggestion = (
  text: string,
): { scheduledAt: Date | null; notes: string } => {
  return {
    scheduledAt: null,
    notes: text.trim().slice(0, 200),
  };
};
