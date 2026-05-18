// =============================================================================
// Helper pra resolver display_settings do tenant.
//
// `tenants.display_settings` é JSONB livre por design (sprint 1.2). Esse
// helper aplica fallbacks documentados — `bot_name` vira `tenant.name` se
// não definido; `business_hours` ausente significa "responde a qualquer hora".
//
// Coordenador chama este helper antes de renderizar template, garantindo que
// `bot_name` (obrigatória em todos os templates) sempre tenha valor.
// =============================================================================

import type {
  AuthenticatedClient,
  ServiceRoleClient,
} from '@office/shared-db';

type AnyClient = AuthenticatedClient | ServiceRoleClient;

export type BusinessHours = {
  /** HH:MM 24h, ex: "08:00". */
  start: string;
  end: string;
  /** IANA timezone. Default São Paulo. */
  timezone: string;
  /** ISO weekday: 1=segunda, 7=domingo. */
  days: number[];
};

export type DisplaySettings = {
  bot_name: string;
  signature: string;
  business_hours: BusinessHours | null;
};

const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

const isStringHHMM = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-2]\d:[0-5]\d$/.test(v);

const sanitizeBusinessHours = (raw: unknown): BusinessHours | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isStringHHMM(r.start) || !isStringHHMM(r.end)) return null;
  const tz = typeof r.timezone === 'string' && r.timezone.length > 0
    ? r.timezone
    : DEFAULT_TIMEZONE;
  const days = Array.isArray(r.days)
    ? r.days.filter((d): d is number => typeof d === 'number' && d >= 1 && d <= 7)
    : [1, 2, 3, 4, 5];
  return { start: r.start, end: r.end, timezone: tz, days };
};

export const resolveDisplaySettings = (input: {
  tenantName: string;
  displaySettings: unknown;
}): DisplaySettings => {
  const raw = (input.displaySettings ?? {}) as Record<string, unknown>;
  const botName = typeof raw.bot_name === 'string' && raw.bot_name.trim().length > 0
    ? raw.bot_name
    : input.tenantName;
  const signature = typeof raw.signature === 'string' && raw.signature.trim().length > 0
    ? raw.signature
    : botName;
  return {
    bot_name: botName,
    signature,
    business_hours: sanitizeBusinessHours(raw.business_hours),
  };
};

export const loadDisplaySettings = async (
  supabase: AnyClient,
  tenantId: string,
): Promise<DisplaySettings> => {
  const { data, error } = await supabase
    .from('tenants')
    .select('name, display_settings')
    .eq('id', tenantId)
    .single();
  if (error) throw error;
  return resolveDisplaySettings({
    tenantName: data.name,
    displaySettings: data.display_settings,
  });
};
