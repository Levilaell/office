/**
 * Seed de leads de teste pra UI/demo (Sprint 1.4).
 *
 * Uso:
 *   pnpm seed:leads-test-data
 *
 * Cria 3 leads em estados diferentes pra exercitar a página
 * /dashboard/atendimento/leads sem precisar disparar mensagens reais:
 *  - 1 lead em `qualifying` com slots parciais
 *  - 1 lead em `qualified` aguardando agendamento
 *  - 1 lead em `lost`
 *
 * Idempotente: marcador em `source_metadata.seed_marker = 'sprint-1.4-test'`.
 * Re-runs não duplicam — leads com o marcador são pulados se já existem.
 *
 * Requer no ambiente:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   SEED_LEADS_TENANT_ID  — opcional. Default: primeiro tenant ativo.
 */
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServiceRoleClient } from '@office/shared-domain';
import type { LeadInsert } from '@office/shared-domain';
import { validateSupabaseEnv } from './validate-supabase-env';

const envCandidates = [
  resolve(process.cwd(), '.env.local'),
  resolve(process.cwd(), 'apps/web/.env.local'),
  resolve(process.cwd(), 'apps/agent-runtime/.env'),
];
for (const path of envCandidates) {
  if (existsSync(path)) loadEnv({ path, override: false });
}

const SEED_MARKER = 'sprint-1.4-test';

const main = async (): Promise<void> => {
  const { url, serviceRoleKey } = validateSupabaseEnv();
  const supabase = createServiceRoleClient({ url, serviceRoleKey });

  let tenantId = process.env.SEED_LEADS_TENANT_ID;
  if (!tenantId) {
    const { data: tenants, error } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1);
    if (error) {
      console.error(`✗ Erro buscando tenants: ${error.message}`);
      process.exit(1);
    }
    const first = tenants?.[0];
    if (!first) {
      console.error('✗ Nenhum tenant ativo encontrado. Crie um via onboarding antes.');
      process.exit(1);
    }
    tenantId = first.id;
    console.log(`Usando tenant ativo: ${first.name} (${tenantId})`);
  }

  // Idempotência: busca leads com o marcador. Se algum existe, considera
  // que o seed já rodou.
  const existing = await supabase
    .from('leads')
    .select('id, status, qualification_data')
    .eq('tenant_id', tenantId)
    .contains('source_metadata', { seed_marker: SEED_MARKER });
  if (existing.error) {
    console.error(`✗ Erro consultando leads existentes: ${existing.error.message}`);
    process.exit(1);
  }
  if (existing.data && existing.data.length > 0) {
    console.log(
      `✔ Seed já aplicado — ${existing.data.length} leads de teste encontrados:`,
    );
    for (const lead of existing.data) {
      const name =
        (lead.qualification_data as Record<string, unknown>)?.contact_name ??
        '(sem nome)';
      console.log(`  - ${name} [${lead.status}]`);
    }
    console.log(
      '  Use rolagem se quiser recriar: delete leads com source_metadata.seed_marker = sprint-1.4-test',
    );
    return;
  }

  const now = new Date();
  const isoNow = now.toISOString();
  const isoYesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const leads: LeadInsert[] = [
    // 1. Em qualificação — slots parciais
    {
      tenant_id: tenantId,
      source: 'whatsapp_evolution',
      source_metadata: {
        seed_marker: SEED_MARKER,
        triggered_by: 'seed:leads-test-data',
      },
      status: 'qualifying',
      qualification_data: {
        contact_name: 'João Silva',
        has_existing_company: true,
        company_size_estimate: 'small',
        // faltam current_regime, main_pain, decision_timeline
      },
      notes: 'Lead chegou via WhatsApp pedindo orçamento. Aguardando resposta.',
    },
    // 2. Qualificado aguardando horário pra call
    {
      tenant_id: tenantId,
      source: 'email_imap',
      source_metadata: {
        seed_marker: SEED_MARKER,
        triggered_by: 'seed:leads-test-data',
      },
      status: 'qualified',
      qualification_data: {
        contact_name: 'Maria Oliveira',
        has_existing_company: true,
        company_size_estimate: 'medium',
        current_regime: 'lucro_presumido',
        main_pain:
          'meu contador atual não responde, queria mudar urgente antes do fechamento do mês',
        decision_timeline: 'urgent',
        industry_segment: 'comércio varejista',
        monthly_revenue_estimate: 180000,
      },
      qualified_at: isoYesterday,
      estimated_value_monthly: 2500,
      notes: 'Cliente muito qualificado, urgência alta. Priorizar agendamento.',
    },
    // 3. Lost — fechou com concorrente
    {
      tenant_id: tenantId,
      source: 'simulated_webhook',
      source_metadata: {
        seed_marker: SEED_MARKER,
        triggered_by: 'seed:leads-test-data',
      },
      status: 'lost',
      qualification_data: {
        contact_name: 'Pedro Santos',
        has_existing_company: false,
        company_size_estimate: 'mei',
        main_pain: 'vou abrir um MEI mês que vem',
        decision_timeline: 'this_month',
      },
      lost_reason: 'cliente fechou com concorrente que ofereceu preço mais baixo',
    },
  ];

  const { data: inserted, error: insertError } = await supabase
    .from('leads')
    .insert(leads)
    .select('id, status, qualification_data');
  if (insertError) {
    console.error(`✗ Erro inserindo leads: ${insertError.message}`);
    process.exit(1);
  }

  console.log(`✔ Inseridos ${inserted?.length ?? 0} leads de teste:`);
  for (const lead of inserted ?? []) {
    const name =
      (lead.qualification_data as Record<string, unknown>)?.contact_name ??
      '(sem nome)';
    console.log(`  - ${name} [${lead.status}] id=${lead.id}`);
  }
  console.log(
    `\n  Acesse /dashboard/atendimento/leads na web pra ver. Created at: ${isoNow}`,
  );
};

main().catch((err) => {
  console.error('✗ Erro inesperado:', err);
  process.exit(1);
});
