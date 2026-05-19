/**
 * Valida que `.env.local` de cada app (web, agent-runtime, workers) tem todas
 * as chaves declaradas em `.env.example` na raiz E detecta drift de valores
 * entre arquivos.
 *
 * Drift é o sintoma diagnosticado pelo Sprint Fase 2-prep (TD-006): os 3 apps
 * mantêm `.env.local` idênticos por convenção mas, na prática, divergem
 * silenciosamente quando alguém atualiza só um deles. Esta função compara, pra
 * cada chave compartilhada por >= 2 apps, se o valor é o mesmo. Falha rápido
 * com mensagem clara.
 *
 * Sai com código 1 se faltar qualquer chave OU se houver drift; 0 se tudo OK.
 *
 * Uso:
 *   pnpm check-env
 *
 * Standalone — NÃO bloqueia `pnpm dev`. Dev experiente pode rodar parcial
 * sem todas as envs. Veja `docs/development.md` pra orientação de quando rodar.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const APPS = ['web', 'agent-runtime', 'workers'] as const;
export type AppName = (typeof APPS)[number];

export interface AppCheckResult {
  app: AppName;
  envLocalPresent: boolean;
  missing: string[];
}

export interface DriftEntry {
  key: string;
  values: { app: AppName; value: string }[];
}

export interface CheckResult {
  ok: boolean;
  apps: AppCheckResult[];
  drift: DriftEntry[];
}

/**
 * Extrai chaves de um `.env.example`. Pega só linhas `^[A-Z_]+=` (top-level),
 * ignora comentários, linhas em branco e referências como `${VAR}`.
 */
export function parseExampleKeys(content: string): string[] {
  const keys: string[] = [];
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=/);
    if (match && match[1]) keys.push(match[1]);
  }
  return Array.from(new Set(keys));
}

/**
 * Faz parse de conteúdo `.env` em Map. Strip de quotes nos values.
 * Comentários e linhas em branco são ignoradas.
 */
export function parseEnvFile(content: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out.set(key, value);
  }
  return out;
}

interface CheckAppInput {
  app: AppName;
  envLocalContent: string | null;
  exampleKeys: string[];
}

export function checkApp(input: CheckAppInput): AppCheckResult {
  if (input.envLocalContent === null) {
    return { app: input.app, envLocalPresent: false, missing: [...input.exampleKeys] };
  }
  const envs = parseEnvFile(input.envLocalContent);
  const missing = input.exampleKeys.filter((k) => {
    const v = envs.get(k);
    return v === undefined || v === '';
  });
  return { app: input.app, envLocalPresent: true, missing };
}

/**
 * Detecta divergência de valor entre `.env.local` dos apps. Pra cada chave
 * que aparece preenchida em >= 2 apps, compara valores. Apps que não têm a
 * chave (ou têm vazia) são ignorados — quem decide se é obrigatória é o
 * `checkApp` (cruzamento com `.env.example`).
 */
export function findDrift(
  apps: { name: AppName; envLocalContent: string | null }[],
): DriftEntry[] {
  const parsed = apps.map((a) => ({
    name: a.name,
    envs: a.envLocalContent === null ? new Map<string, string>() : parseEnvFile(a.envLocalContent),
  }));

  const allKeys = new Set<string>();
  for (const a of parsed) for (const k of a.envs.keys()) allKeys.add(k);

  const drift: DriftEntry[] = [];
  for (const key of allKeys) {
    const present = parsed
      .map((a) => {
        const v = a.envs.get(key);
        return v && v.length > 0 ? { app: a.name, value: v } : null;
      })
      .filter((x): x is { app: AppName; value: string } => x !== null);
    if (present.length < 2) continue;
    const first = present[0]!.value;
    const diverges = present.some((p) => p.value !== first);
    if (diverges) {
      drift.push({ key, values: present });
    }
  }
  return drift.sort((a, b) => a.key.localeCompare(b.key));
}

export interface CheckInput {
  exampleContent: string;
  apps: { name: AppName; envLocalContent: string | null }[];
}

export function check(input: CheckInput): CheckResult {
  const exampleKeys = parseExampleKeys(input.exampleContent);
  const apps = input.apps.map((a) =>
    checkApp({ app: a.name, envLocalContent: a.envLocalContent, exampleKeys })
  );
  const drift = findDrift(input.apps);
  const allFilled = apps.every((a) => a.envLocalPresent && a.missing.length === 0);
  return {
    ok: allFilled && drift.length === 0,
    apps,
    drift,
  };
}

export function formatReport(result: CheckResult): string {
  if (result.ok) return '✓ envs OK';
  const lines: string[] = [];
  for (const app of result.apps) {
    if (!app.envLocalPresent) {
      lines.push(`✗ apps/${app.app}/.env.local ausente`);
      lines.push(`  faltam todas as ${app.missing.length} chaves:`);
      for (const k of app.missing) lines.push(`  - ${k}`);
      continue;
    }
    if (app.missing.length === 0) continue;
    lines.push(`✗ apps/${app.app}/.env.local sem as chaves:`);
    for (const k of app.missing) lines.push(`  - ${k}`);
  }
  if (result.drift.length > 0) {
    lines.push(
      `✗ drift de valor entre apps (mesma chave, valores diferentes — TD-006):`,
    );
    for (const entry of result.drift) {
      lines.push(`  - ${entry.key}:`);
      for (const v of entry.values) {
        // Trunca valor pra evitar despejar secret em log de CI.
        const snippet =
          v.value.length > 40 ? `${v.value.slice(0, 37)}...` : v.value;
        lines.push(`      apps/${v.app}/.env.local = "${snippet}"`);
      }
    }
  }
  return lines.join('\n');
}

function readOrNull(path: string): string | null {
  return existsSync(path) ? readFileSync(path, 'utf-8') : null;
}

export interface RunFromDiskResult extends CheckResult {
  exampleFound: boolean;
}

export function runFromDisk(rootDir: string): RunFromDiskResult {
  const examplePath = resolve(rootDir, '.env.example');
  if (!existsSync(examplePath)) {
    return { ok: false, exampleFound: false, apps: [], drift: [] };
  }
  const exampleContent = readFileSync(examplePath, 'utf-8');
  const apps = APPS.map((name) => ({
    name,
    envLocalContent: readOrNull(resolve(rootDir, 'apps', name, '.env.local')),
  }));
  return { ...check({ exampleContent, apps }), exampleFound: true };
}

function main(): never {
  const result = runFromDisk(process.cwd());
  if (!result.exampleFound) {
    console.error(`✗ .env.example não encontrado em ${process.cwd()}`);
    process.exit(1);
  }
  if (result.ok) {
    console.log(formatReport(result));
    process.exit(0);
  }
  console.error(formatReport(result));
  process.exit(1);
}

const isMain =
  typeof process.argv[1] === 'string' && process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) main();
