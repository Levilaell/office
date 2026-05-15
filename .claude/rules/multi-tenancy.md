# Multi-tenancy

## Princípios

- Toda tabela de domínio carrega `tenant_id` (UUID, FK pra `tenants`)
- RLS (Row-Level Security) habilitado em toda tabela de domínio
- Política RLS padrão: `tenant_id = auth.jwt() -> 'org_id'` (Clerk Org)
- Nunca confiar em filtro de tenant_id vindo do cliente; sempre vir do contexto auth

## Hierarquia

platform → tenants (escritórios) → accounts (empresas que o escritório atende) → entities

- `tenant_id` é o nível principal de isolamento
- `account_id` é sub-nível dentro do tenant (escritório atende várias empresas)
- Operações cruzando accounts dentro do mesmo tenant: permitido com policies específicas
- Operações cruzando tenants: proibido exceto em queries de plataforma (com role de superadmin)

## Implementação Supabase

- Cliente Supabase configurado com JWT do Clerk
- JWT carrega `org_id` (= tenant_id) e `org_role`
- Policies usam `auth.jwt() ->> 'org_id'` pra filtrar
- Para queries de plataforma: usar service_role key (server-side apenas, nunca exposto)

## Testes obrigatórios

- Pra qualquer feature que toque dados: teste com 2 tenants diferentes verificando isolamento
- Suite de testes de RLS rodando em CI em toda PR
- Nunca skipar esses testes

## Common pitfalls

- API route que esquece de validar tenant_id no input → vazamento
- Query com service_role esquecendo de adicionar filtro manual → vazamento
- JOIN entre tabelas onde uma não tem RLS → vazamento via tabela vulnerável
- Cache compartilhado entre tenants → use prefixo tenant_id em chaves Redis
