# ADR-004: Autenticação via Clerk com Organizations + Third-Party Auth Native do Supabase

Data: 2026-05-15
Status: aceito

## Contexto

A plataforma é multi-tenant: cada escritório contábil é um tenant com múltiplos usuários internos, e potencialmente com clientes finais (as empresas atendidas pelo escritório) tendo acesso futuro como consumidores. Precisamos de um provider de auth que ofereça nativamente conceito de Organization, com componentes prebuilt pra acelerar onboarding, e que integre com Supabase pra que RLS resolva o tenant via JWT claim sem manutenção manual de sessão.

A integração precisa ser feita pelo caminho atualmente suportado por Supabase + Clerk (Third-Party Auth Native, lançada em abril/2025). O caminho legado via JWT template foi descontinuado: obriga compartilhar secret e fetch extra de token por request.

## Decisão

Clerk com Organizations habilitado como provider único de autenticação. Conceitualmente, `Clerk Organization = Tenant`; o mapeamento físico vive na tabela `tenants` (ver ADR-005). Integração com Supabase via Third-Party Auth Native: Supabase valida tokens Clerk via JWKS público, sem compartilhamento de segredo. Roles da aplicação (`owner_tenant`, `manager`, `operator`, `end_client`, `ai_supervisor`) são persistidos em `publicMetadata` do membership, porque custom roles em Organizations do Clerk é feature paga e o Free tier não cobre.

## Alternativas consideradas

- **Auth0:** caro pro estágio atual; Organizations existem mas a integração com o SDK e a UI prebuilt são menos coesas que no Clerk.
- **Supabase Auth puro:** perderia Organizations nativas, componentes prebuilt, MFA out-of-box. Construir essas peças à mão é tempo que não temos.
- **WorkOS:** Free tier mais agressivo (1M MAU), mas viés B2B SSO/enterprise e menos componentes prebuilt; ganho marginal pra fase atual.
- **JWT template legado da Clerk pra Supabase:** deprecated em 1 abril 2025. Exige compartilhamento de JWT secret e novo fetch de token por request. Caminho morto.
- **Auth caseiro:** prazo curto e risco regulatório (LGPD) inaceitáveis.

## Consequências

Positivas:
- Componentes prebuilt (`<SignIn />`, `<CreateOrganization />`) com localização em PT-BR aceleram a primeira sprint.
- Organizations nativas mapeiam direto pro modelo multi-tenant.
- Supabase valida tokens via JWKS público — sem segredo compartilhado, sem fetch extra de token por request.
- Free tier (50K MAU, 100 MAO) cobre todo o período de validação e crescimento inicial sem custo.

Negativas:
- Custom roles em Organizations é feature paga; mitigamos com `publicMetadata` no Free, ao custo de não ter validação de role na borda do Clerk.
- Vendor lock-in razoável; mitigado pela tabela `tenants` mantendo `clerk_org_id` como mapping (ADR-005). Switch futuro de provider é refactor de webhook + claim, não migração de PK.
- Custo por Monthly Active Organization após 100 (US$ 1/MAO no Pro) vira linha relevante no MRR quando crescer.
