// Metadados de UI por departamento — label PT-BR, classe Tailwind de
// cor e emoji. Departamento vem do agent.department (string livre no DB
// mas com enum em shared-types). Fallback cobre o caso desconhecido.

export type DepartmentMeta = {
  key: string;
  label: string;
  color: string;
  emoji: string;
};

const ATENDIMENTO: DepartmentMeta = {
  key: 'atendimento',
  label: 'Atendimento',
  color: 'bg-green-500/15 text-green-400',
  emoji: '💬',
};
const SOCIETARIO: DepartmentMeta = {
  key: 'societario',
  label: 'Societário',
  color: 'bg-purple-500/15 text-purple-400',
  emoji: '🏢',
};
const PESSOAL: DepartmentMeta = {
  key: 'pessoal',
  label: 'Pessoal',
  color: 'bg-amber-500/15 text-amber-400',
  emoji: '👥',
};
const FISCAL: DepartmentMeta = {
  key: 'fiscal',
  label: 'Fiscal',
  color: 'bg-red-500/15 text-red-400',
  emoji: '🧾',
};
const CONTABIL: DepartmentMeta = {
  key: 'contabil',
  label: 'Contábil',
  color: 'bg-orange-500/15 text-orange-400',
  emoji: '📊',
};
const FINANCEIRO_INTERNO: DepartmentMeta = {
  key: 'financeiro_interno',
  label: 'Financeiro Interno',
  color: 'bg-blue-500/15 text-blue-400',
  emoji: '💰',
};
const PLATFORM: DepartmentMeta = {
  key: 'platform',
  label: 'Plataforma',
  color: 'bg-neutral-500/15 text-neutral-400',
  emoji: '⚙️',
};

export const UNKNOWN_DEPARTMENT: DepartmentMeta = {
  key: 'unknown',
  label: 'Sem departamento',
  color: 'bg-neutral-500/15 text-neutral-400',
  emoji: '❔',
};

const DEPARTMENT_META: Record<string, DepartmentMeta> = {
  atendimento: ATENDIMENTO,
  societario: SOCIETARIO,
  pessoal: PESSOAL,
  fiscal: FISCAL,
  contabil: CONTABIL,
  financeiro_interno: FINANCEIRO_INTERNO,
  platform: PLATFORM,
};

export function getDepartmentMeta(department: string | null | undefined): DepartmentMeta {
  if (!department) return UNKNOWN_DEPARTMENT;
  return DEPARTMENT_META[department] ?? UNKNOWN_DEPARTMENT;
}

export const DEPARTMENT_FILTER_OPTIONS: ReadonlyArray<DepartmentMeta> = [
  ATENDIMENTO,
  SOCIETARIO,
  PESSOAL,
  FISCAL,
  CONTABIL,
  FINANCEIRO_INTERNO,
];
