/**
 * Seed retroativo de agentes pra todos os tenants existentes.
 *
 * Uso:
 *   pnpm seed:agents
 *
 * Idempotente — pode rodar várias vezes sem duplicar.
 *
 * Requer no ambiente:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createServiceRoleClient,
  getAgentsByTenant,
  seedDefaultAgentsForTenant,
} from '@office/shared-domain';

const envCandidates = [
  resolve(process.cwd(), '.env.local'),
  resolve(process.cwd(), 'apps/web/.env.local'),
  resolve(process.cwd(), 'apps/agent-runtime/.env'),
];
for (const path of envCandidates) {
  if (existsSync(path)) loadEnv({ path, override: false });
}

const main = async (): Promise<void> => {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error(
      'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios. Configure no .env.local.',
    );
    process.exit(1);
  }

  const supabase = createServiceRoleClient({ url, serviceRoleKey });

  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('id, name')
    .order('created_at', { ascending: true });
  if (error) {
    console.error(`Erro listando tenants: ${error.message}`);
    process.exit(1);
  }
  if (!tenants || tenants.length === 0) {
    console.log('Nenhum tenant encontrado.');
    return;
  }

  console.log(`Encontrados ${tenants.length} tenant(s). Iniciando seed...`);

  for (const tenant of tenants) {
    const before = await getAgentsByTenant(supabase, tenant.id);
    const beforeKeys = new Set(before.map((a) => a.agent_key));
    process.stdout.write(`seeding tenant ${tenant.id} (${tenant.name})... `);
    try {
      await seedDefaultAgentsForTenant(supabase, tenant.id);
      const after = await getAgentsByTenant(supabase, tenant.id);
      const created = after.filter((a) => !beforeKeys.has(a.agent_key));
      if (created.length === 0) {
        console.log('already seeded');
      } else {
        console.log(`done (${created.length} novos)`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`FALHOU: ${message}`);
    }
  }
};

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Erro fatal: ${message}`);
  process.exit(1);
});
