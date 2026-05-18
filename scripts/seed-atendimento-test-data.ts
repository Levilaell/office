/**
 * Seed de dados de teste pro Sprint 1.3 — Especialista Operacional.
 *
 * Cria no primeiro tenant (mais antigo) um cenário operacional plausível:
 *   - 1 account "Padaria Teste LTDA" (CNPJ fictício, Simples Nacional)
 *   - 1 entity matriz
 *   - 3 obligations futuras (DAS, INSS, DCTFWeb outubro/2026)
 *   - 2 documents (NFe recebida, comprovante processado)
 *
 * Uso:
 *   pnpm seed:atendimento-test-data
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
import { createServiceRoleClient } from '@office/shared-domain';

const envCandidates = [
  resolve(process.cwd(), '.env.local'),
  resolve(process.cwd(), 'apps/web/.env.local'),
  resolve(process.cwd(), 'apps/agent-runtime/.env'),
];
for (const path of envCandidates) {
  if (existsSync(path)) loadEnv({ path, override: false });
}

const TEST_CNPJ = '12.345.678/0001-90';
const TEST_RAZAO_SOCIAL = 'Padaria Teste LTDA';
const TEST_NOME_FANTASIA = 'Padaria Boa';

const isoDate = (d: Date): string => d.toISOString().slice(0, 10);
const daysFromNow = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return isoDate(d);
};
const monthOf = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 7);
};

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

  // 1. Pega o primeiro tenant (mais antigo).
  const { data: tenants, error: tErr } = await supabase
    .from('tenants')
    .select('id, name')
    .order('created_at', { ascending: true })
    .limit(1);
  if (tErr) {
    console.error(`Erro listando tenants: ${tErr.message}`);
    process.exit(1);
  }
  if (!tenants || tenants.length === 0) {
    console.log('Nenhum tenant encontrado — onboarde um escritório primeiro.');
    return;
  }
  const tenant = tenants[0];
  if (!tenant) {
    console.log('Tenant não disponível.');
    return;
  }
  console.log(`Tenant alvo: ${tenant.id} (${tenant.name})`);

  // 2. Upsert account (idempotente via UNIQUE tenant_id+cnpj)
  const { data: existingAcc } = await supabase
    .from('accounts')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('cnpj', TEST_CNPJ)
    .maybeSingle();

  let account: { id: string } | null = existingAcc ?? null;
  if (!account) {
    const { data: created, error: accErr } = await supabase
      .from('accounts')
      .insert({
        tenant_id: tenant.id,
        cnpj: TEST_CNPJ,
        razao_social: TEST_RAZAO_SOCIAL,
        nome_fantasia: TEST_NOME_FANTASIA,
        regime_tributario: 'simples_nacional',
        status: 'active',
      })
      .select()
      .single();
    if (accErr) {
      console.error(`Erro criando account: ${accErr.message}`);
      process.exit(1);
    }
    account = created;
    console.log(`account criada: ${account?.id}`);
  } else {
    console.log(`account já existe: ${account.id} — não recriando`);
  }
  if (!account) throw new Error('account inválida');

  // 3. Entity matriz (idempotente via lookup)
  const { data: existingMatriz } = await supabase
    .from('entities')
    .select('id')
    .eq('account_id', account.id)
    .eq('type', 'matriz')
    .maybeSingle();
  if (!existingMatriz) {
    const { error: entErr } = await supabase.from('entities').insert({
      tenant_id: tenant.id,
      account_id: account.id,
      type: 'matriz',
      inscricao_estadual: 'IE-TESTE-001',
      inscricao_municipal: 'IM-TESTE-001',
    });
    if (entErr) {
      console.error(`Erro criando entity matriz: ${entErr.message}`);
      process.exit(1);
    }
    console.log('entity matriz criada');
  } else {
    console.log(`entity matriz já existe: ${existingMatriz.id}`);
  }

  // 4. Obligations — 3 futuras
  const obligationsSeed = [
    {
      type: 'das',
      category: 'federal',
      description: 'DAS Simples Nacional - referente ao mês atual',
      competencia: monthOf(0),
      due_date: daysFromNow(10),
      amount: 487.3,
      status: 'pending',
      payment_method: 'darf_eletronico',
    },
    {
      type: 'inss',
      category: 'trabalhista',
      description: 'INSS - referente ao mês atual',
      competencia: monthOf(0),
      due_date: daysFromNow(20),
      amount: 1230.0,
      status: 'pending',
      payment_method: 'darf_eletronico',
    },
    {
      type: 'dctfweb',
      category: 'federal',
      description: 'DCTFWeb - referente ao mês atual',
      competencia: monthOf(0),
      due_date: daysFromNow(25),
      amount: null,
      status: 'pending',
    },
  ];

  for (const ob of obligationsSeed) {
    const { data: existing } = await supabase
      .from('obligations')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('account_id', account.id)
      .eq('type', ob.type)
      .eq('competencia', ob.competencia)
      .maybeSingle();
    if (existing) {
      console.log(`obligation ${ob.type}/${ob.competencia} já existe (${existing.id})`);
      continue;
    }
    const { data: created, error: obErr } = await supabase
      .from('obligations')
      .insert({
        tenant_id: tenant.id,
        account_id: account.id,
        ...ob,
      })
      .select('id')
      .single();
    if (obErr) {
      console.error(`Erro criando obligation ${ob.type}: ${obErr.message}`);
      process.exit(1);
    }
    console.log(`obligation criada: ${created?.id} (${ob.type})`);
  }

  // 5. Documents — 2 recentes
  const documentsSeed = [
    {
      type: 'nf_venda',
      category: 'fiscal',
      description: 'NFe de venda - cliente ABC',
      competencia: monthOf(0),
      reference_date: daysFromNow(-5),
      status: 'received',
      received_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      source: 'manual_upload',
    },
    {
      type: 'comprovante_pagamento',
      category: 'financeiro',
      description: 'Comprovante de DAS de competência anterior',
      competencia: monthOf(-30),
      reference_date: daysFromNow(-15),
      status: 'processed',
      received_at: new Date(Date.now() - 15 * 86400000).toISOString(),
      processed_at: new Date(Date.now() - 14 * 86400000).toISOString(),
      source: 'whatsapp',
    },
  ];

  for (const doc of documentsSeed) {
    const { data: existing } = await supabase
      .from('documents')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('account_id', account.id)
      .eq('type', doc.type)
      .eq('competencia', doc.competencia)
      .maybeSingle();
    if (existing) {
      console.log(`document ${doc.type}/${doc.competencia} já existe (${existing.id})`);
      continue;
    }
    const { data: created, error: docErr } = await supabase
      .from('documents')
      .insert({
        tenant_id: tenant.id,
        account_id: account.id,
        ...doc,
      })
      .select('id')
      .single();
    if (docErr) {
      console.error(`Erro criando document ${doc.type}: ${docErr.message}`);
      process.exit(1);
    }
    console.log(`document criado: ${created?.id} (${doc.type})`);
  }

  console.log('seed completed.');
};

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Erro fatal: ${message}`);
  process.exit(1);
});
