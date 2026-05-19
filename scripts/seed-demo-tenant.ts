/**
 * Seed do tenant demo pra apresentação comercial — Sprint 1.6.
 *
 * Cria uma Clerk organization real via API REST + tenant linkado +
 * accounts/obligations/documents/agents seedados. O `CLERK_DEMO_OWNER_USER_ID`
 * é membro/admin da org criada — pode ser o seu user pessoal.
 *
 * Uso:
 *   CLERK_DEMO_OWNER_USER_ID=user_xxxxx pnpm seed:demo-tenant
 *
 * Idempotente: se já existir Clerk org com o nome exato, faz lookup e
 * retorna o id existente em vez de recriar.
 *
 * Requer no ambiente:
 *   CLERK_SECRET_KEY
 *   CLERK_DEMO_OWNER_USER_ID
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Pra apagar (limpeza entre apresentações):
 *   archive via UPDATE tenants SET status='archived' + DELETE Clerk org via
 *   painel Clerk. Cleanup automatizado fica como TD.
 */
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createServiceRoleClient,
  createTenant,
  markTenantOnboardingPending,
  seedDefaultAgentsForTenant,
  completeTenantOnboarding,
} from '@office/shared-domain';
import { validateSupabaseEnv } from './validate-supabase-env';

const envCandidates = [
  resolve(process.cwd(), '.env.local'),
  resolve(process.cwd(), 'apps/web/.env.local'),
  resolve(process.cwd(), 'apps/agent-runtime/.env'),
];
for (const path of envCandidates) {
  if (existsSync(path)) loadEnv({ path, override: false });
}

const DEMO_ORG_NAME = 'Demo — Levi Lael';

type ClerkOrganization = {
  id: string;
  name: string;
  slug?: string;
};

const clerkFetch = async (
  path: string,
  init: RequestInit,
  secretKey: string,
): Promise<Response> =>
  fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
  });

const findClerkOrgByName = async (
  name: string,
  secretKey: string,
): Promise<ClerkOrganization | null> => {
  const r = await clerkFetch(
    `/organizations?query=${encodeURIComponent(name)}&limit=20`,
    { method: 'GET' },
    secretKey,
  );
  if (!r.ok) {
    throw new Error(`Clerk list orgs ${r.status}: ${await r.text()}`);
  }
  const body = (await r.json()) as { data: ClerkOrganization[] } | ClerkOrganization[];
  const list = Array.isArray(body) ? body : body.data;
  return list.find((o) => o.name === name) ?? null;
};

const createClerkOrg = async (
  name: string,
  createdBy: string,
  secretKey: string,
): Promise<ClerkOrganization> => {
  const r = await clerkFetch(
    '/organizations',
    {
      method: 'POST',
      body: JSON.stringify({ name, created_by: createdBy }),
    },
    secretKey,
  );
  if (!r.ok) {
    throw new Error(`Clerk create org ${r.status}: ${await r.text()}`);
  }
  return (await r.json()) as ClerkOrganization;
};

const main = async (): Promise<void> => {
  const { url, serviceRoleKey } = validateSupabaseEnv();
  const secretKey = process.env.CLERK_SECRET_KEY;
  const ownerUserId = process.env.CLERK_DEMO_OWNER_USER_ID;
  if (!secretKey) {
    console.error('CLERK_SECRET_KEY ausente no env.');
    process.exit(1);
  }
  if (!ownerUserId) {
    console.error(
      'CLERK_DEMO_OWNER_USER_ID ausente no env. Use o seu user_xxxx do Clerk.',
    );
    process.exit(1);
  }
  if (!ownerUserId.startsWith('user_')) {
    console.error(
      `CLERK_DEMO_OWNER_USER_ID parece inválido: "${ownerUserId}". Deve começar com "user_".`,
    );
    process.exit(1);
  }

  console.log(`Procurando Clerk org "${DEMO_ORG_NAME}"...`);
  let clerkOrg = await findClerkOrgByName(DEMO_ORG_NAME, secretKey);
  if (clerkOrg) {
    console.log(`Encontrada: ${clerkOrg.id}`);
  } else {
    console.log('Não encontrada — criando...');
    clerkOrg = await createClerkOrg(DEMO_ORG_NAME, ownerUserId, secretKey);
    console.log(`Criada: ${clerkOrg.id}`);
  }

  const supabase = createServiceRoleClient({ url, serviceRoleKey });

  // Onboard tenant via mesmo fluxo do /api/onboarding/complete-org.
  const { tenant, created } = await createTenant(supabase, {
    clerkOrgId: clerkOrg.id,
    name: clerkOrg.name,
  });
  console.log(
    created ? `Tenant criado: ${tenant.id}` : `Tenant já existia: ${tenant.id}`,
  );
  await seedDefaultAgentsForTenant(supabase, tenant.id);
  if (created) {
    // Marca pendente; logo abaixo a gente completa com defaults razoáveis
    // pra demo (sem precisar passar pelo wizard).
    await markTenantOnboardingPending(supabase, tenant.id);
  }

  // Defaults razoáveis pra apresentação — bot_name "Demo", horário comercial
  // padrão. Wizard não precisa rodar pra demo.
  await completeTenantOnboarding(supabase, tenant.id, {
    bot_name: 'Demo Levi Lael',
    signature: 'Equipe Demo',
    business_hours: {
      start: '08:00',
      end: '18:00',
      timezone: 'America/Sao_Paulo',
      days: [1, 2, 3, 4, 5],
    },
  });

  // Seed dados de teste — mesmas funções dos outros scripts.
  await seedDemoAccount(supabase, tenant.id);

  console.log('\nDemo tenant pronto.');
  console.log(`  clerk_org_id: ${clerkOrg.id}`);
  console.log(`  tenant_id:    ${tenant.id}`);
  console.log(`\nNo Clerk Org Switcher, selecione "${DEMO_ORG_NAME}".`);
  console.log(
    '\nPra disparar cenários: acesse /demo ou clique em "Disparar cenário (demo)" no /dashboard/escritorio.',
  );
};

const TEST_CNPJ = '11.222.333/0001-44';
const TEST_RAZAO = 'Padaria Demo LTDA';

type SupabaseClient = ReturnType<typeof createServiceRoleClient>;

const seedDemoAccount = async (
  supabase: SupabaseClient,
  tenantId: string,
): Promise<void> => {
  const existing = await supabase
    .from('accounts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('cnpj', TEST_CNPJ)
    .maybeSingle();
  let accountId: string | null = existing.data?.id ?? null;
  if (!accountId) {
    const created = await supabase
      .from('accounts')
      .insert({
        tenant_id: tenantId,
        cnpj: TEST_CNPJ,
        razao_social: TEST_RAZAO,
        nome_fantasia: 'Padaria Demo',
        regime_tributario: 'simples_nacional',
        status: 'active',
      })
      .select('id')
      .single();
    if (created.error) throw created.error;
    accountId = created.data.id;
    console.log(`Account criada: ${accountId}`);
  } else {
    console.log(`Account já existia: ${accountId}`);
  }

  const daysFromNow = (n: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  // Idempotente via lookup por (account_id, kind, due_date).
  const obligations = [
    { kind: 'das', due_date: daysFromNow(7), status: 'pending' },
    { kind: 'inss', due_date: daysFromNow(14), status: 'pending' },
    { kind: 'dctfweb', due_date: daysFromNow(21), status: 'pending' },
  ];
  for (const o of obligations) {
    const exists = await supabase
      .from('obligations')
      .select('id')
      .eq('account_id', accountId)
      .eq('kind', o.kind)
      .eq('due_date', o.due_date)
      .maybeSingle();
    if (exists.data) continue;
    const ins = await supabase.from('obligations').insert({
      tenant_id: tenantId,
      account_id: accountId,
      ...o,
    });
    if (ins.error) {
      console.warn(`Obligation ${o.kind} ${o.due_date} falhou: ${ins.error.message}`);
    } else {
      console.log(`Obligation seedada: ${o.kind} due ${o.due_date}`);
    }
  }
};

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
