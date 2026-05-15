# Multi-tenancy

## Princípios

- Toda tabela de domínio carrega `tenant_id` (UUID, FK pra `tenants`)
- RLS (Row-Level Security) habilitado em toda tabela de domínio
- Política RLS padrão: `tenant_id = auth.jwt() -> 'o' ->> 'id'` (Clerk Org)
- Nunca confiar em filtro de tenant_id vindo do cliente; sempre vir do contexto auth

## Hierarquia

platform → tenants (escritórios) → accounts (empresas que o escritório atende) → entities

- `tenant_id` é o nível principal de isolamento
- `account_id` é sub-nível dentro do tenant (escritório atende várias empresas)
- Operações cruzando accounts dentro do mesmo tenant: permitido com policies específicas
- Operações cruzando tenants: proibido exceto em queries de plataforma (com role de superadmin)

## Implementação Supabase

- Integração via Third-Party Auth Native (NÃO o JWT template legado, deprecated em abril/2025)
- Supabase valida tokens Clerk via JWKS público; sem compartilhar JWT secret
- Cliente Supabase configurado com `accessToken` async que retorna o token Clerk

## Claims do JWT (Clerk session v2)

- `auth.jwt() ->> 'sub'` — Clerk user ID
- `auth.jwt() -> 'o' ->> 'id'` — Clerk organization ID (objeto aninhado)
- `auth.jwt() -> 'o' ->> 'rol'` — role do user na org (`admin` ou `basic_member`)
- O claim `org_id` plano NÃO existe na session v2; sempre usar o caminho aninhado

## Helper SQL

- `public.current_tenant_id()` (STABLE) resolve o tenant interno (UUID) a partir do clerk_org_id
- Postgres reserva o schema `auth` — helpers ficam em `public`
- Policies RLS usam `tenant_id = public.current_tenant_id()` direto, sem subquery inline

## Para queries de plataforma

- Service role bypass RLS, server-side apenas
- NUNCA expor service_role key via NEXT_PUBLIC_*; CI deveria grepar isso

## Testes obrigatórios

- Pra qualquer feature que toque dados: teste com 2 tenants diferentes verificando isolamento
- Suite de testes de RLS rodando em CI em toda PR
- Nunca skipar esses testes

## Common pitfalls

- API route que esquece de validar tenant_id no input → vazamento
- Query com service_role esquecendo de adicionar filtro manual → vazamento
- JOIN entre tabelas onde uma não tem RLS → vazamento via tabela vulnerável
- Cache compartilhado entre tenants → use prefixo tenant_id em chaves Redis
