/**
 * Demo reset — orquestra todos os seeds em ordem pra rodar demo do produto.
 *
 * Uso:
 *   pnpm demo:reset
 *
 * Roda em sequência:
 *   1. seed:agents             (cria roteador + agentes default em tenants)
 *   2. seed:atendimento-test-data  (account "Padaria" + obligations + documents)
 *   3. seed:leads-test-data    (3 leads de teste pra UI)
 *
 * NÃO mata processos. NÃO toca em channel_session.
 * Se quiser canal de e-mail real, rode `pnpm seed:email-channel` à parte.
 *
 * Pré-requisito: projeto Supabase Cloud linkado (`supabase link --project-ref <ref>`)
 * e `.env.local` configurado nos 3 apps. Esse script valida env vars antes de
 * disparar qualquer seed.
 */

import { spawn } from 'node:child_process';
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateSupabaseEnv } from './validate-supabase-env';

const envCandidates = [
  resolve(process.cwd(), '.env.local'),
  resolve(process.cwd(), 'apps/web/.env.local'),
  resolve(process.cwd(), 'apps/agent-runtime/.env'),
];
for (const path of envCandidates) {
  if (existsSync(path)) loadEnv({ path, override: false });
}

type SeedStep = {
  name: string;
  command: string;
  description: string;
};

const STEPS: ReadonlyArray<SeedStep> = [
  {
    name: 'seed:agents',
    command: 'pnpm seed:agents',
    description: 'Roteador + agentes default em tenants existentes',
  },
  {
    name: 'seed:atendimento-test-data',
    command: 'pnpm seed:atendimento-test-data',
    description: 'Account "Padaria" + obligations + documents (Sprint 1.3)',
  },
  {
    name: 'seed:leads-test-data',
    command: 'pnpm seed:leads-test-data',
    description: '3 leads de teste em estados diferentes (Sprint 1.4)',
  },
];

const runStep = (step: SeedStep): Promise<void> =>
  new Promise((resolvePromise, rejectPromise) => {
    console.log(`\n▶ ${step.name}: ${step.description}`);
    console.log(`  $ ${step.command}`);
    const child = spawn(step.command, {
      shell: true,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', rejectPromise);
    child.on('exit', (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`${step.name} exited with code ${code}`));
    });
  });

const main = async (): Promise<void> => {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Demo reset — seeds Cloud-only');
  console.log('═══════════════════════════════════════════════════════════');

  // Falha rápido se SUPABASE_URL parece dashboard ou está faltando.
  const { url } = validateSupabaseEnv();
  console.log(`  Supabase: ${url}`);

  for (const step of STEPS) {
    try {
      await runStep(step);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\n✗ Falhou: ${step.name} — ${message}`);
      console.error('  Demo reset interrompido. Resolva o erro e rode novamente.');
      process.exit(1);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ✅ Demo reset concluído');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Próximos passos:');
  console.log('    1. `pnpm dev`  (sobe web/agent-runtime/workers)');
  console.log('    2. http://localhost:3000/dashboard/escritorio');
  console.log('    3. http://localhost:3000/dashboard/atendimento/leads');
  console.log('    4. http://localhost:3000/dashboard/atendimento/inbox (Sprint 1.5)');
  console.log('  Pra exercitar fluxo inbound real:');
  console.log('    POST http://localhost:3000/api/inbound/simulate');
  console.log('═══════════════════════════════════════════════════════════');
};

void main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\nfatal: ${message}`);
  process.exit(1);
});
