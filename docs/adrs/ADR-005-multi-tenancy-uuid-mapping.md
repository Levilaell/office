# ADR-005: Multi-tenancy com tenant_id UUID interno + clerk_org_id mapping

Data: 2026-05-15
Status: aceito

## Contexto

Toda tabela de domínio carrega chave de isolamento entre tenants e RLS resolve o tenant a partir do JWT do request. O ID natural vindo do Clerk tem formato `org_xxx` — string específica do provider. Amarrar PK de dezenas de tabelas ao formato do vendor cria dívida silenciosa: trocar de provider de auth no futuro (improvável mas não impossível) viraria migration coordenada de PK em todo schema. O schema não deve carregar esse acoplamento.

## Decisão

Toda tabela de domínio usa `tenant_id UUID`, gerado pelo Postgres via `gen_random_uuid()`. A tabela `tenants` tem uma coluna `clerk_org_id TEXT UNIQUE` que mantém o mapping pro ID externo do provider de auth. RLS resolve o UUID interno via helper SQL `public.current_tenant_id()` (STABLE), que lê `auth.jwt() -> 'o' ->> 'id'` (claim aninhado da Clerk session v2 — o claim plano `org_id` não existe nesse formato) e faz lookup na tabela `tenants`. Policies usam `tenant_id = public.current_tenant_id()` direto, sem subquery inline em cada policy.

O claim do JWT é populado pelo webhook do Clerk (ver ADR-007), que cria/atualiza `tenants` em resposta a eventos `organization.created/updated/deleted`.

## Alternativas consideradas

- **Usar `clerk_org_id` direto como tenant_id (TEXT em todo schema):** mais simples, evita join. Mas amarra schema ao vendor; trocar provider exige rewrite de PK em dezenas de tabelas + migração de dados. Custo de futuro alto demais pro ganho de hoje.
- **JWT template customizado com `tenant_id` interno embutido no token:** seria elegante, mas Clerk deprecou JWT templates pra Supabase em abril/2025. Caminho não-suportado.
- **Cache em Redis do mapping `clerk_org_id → tenant_id`:** otimização prematura. `current_tenant_id()` é STABLE, então o Postgres reusa o resultado dentro da mesma query, e o lookup é em coluna UNIQUE indexada.

## Consequências

Positivas:
- Schema independente do vendor de auth.
- Switch futuro de provider = trocar implementação do webhook e o JWT claim lido pelo helper. Zero migração de PK.
- `current_tenant_id()` STABLE permite plan caching pelo Postgres dentro da query.
- Path do JWT claim documentado evita o erro recorrente de assumir `'org_id'` plano (que não existe na session v2 do Clerk).

Negativas:
- Resolução indireta (`clerk_org_id → UUID`) em toda policy RLS. Mitigado pela função STABLE + índice em `clerk_org_id`.
- Webhook precisa estar funcional pra criação de tenant ser consistente; sincronização tratada no ADR-007.
