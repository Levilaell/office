# ADR-012: Supabase Cloud como ambiente de desenvolvimento

Data: 2026-05-15
Status: aceito

## Contexto

Setup original previa Supabase rodando localmente via `supabase start` (containers Docker) durante desenvolvimento, e cloud apenas em produção. Em 2026-05-15, durante validação ponta a ponta do hello-world (Sprint 0.3d), o ambiente local quebrou:

- Docker Desktop + WSL2 (Ubuntu 24.04, Windows 11 build 26200) não estavam expondo portas dos containers Supabase pro WSL via `127.0.0.1`. Sintoma: `curl http://127.0.0.1:54321` retornava `000` (connection refused) mesmo com `docker ps` mostrando todos os 11 containers do Supabase healthy.
- Tentativas de correção via WSL Integration toggle no Docker Desktop e via `networkingMode=mirrored` no `.wslconfig` não pegaram, apesar de WSL 2.4.13 e Windows 11 build suportarem ambos os recursos.
- Causa raiz não identificada — possivelmente bug específico de build do Windows ou estado corrompido do Hyper-V.

Continuar batendo em troubleshooting de WSL/Docker era custo de oportunidade alto, com plataforma já funcionando em todos os outros aspectos (LLM, Clerk auth, agent runtime, etc).

## Decisão

Usar **Supabase Cloud (free tier, região São Paulo)** como banco de desenvolvimento. O ambiente local com `supabase start` fica disponível como fallback mas não é exigido pra dev.

Configuração:

- 1 projeto Supabase Cloud por desenvolvedor (não compartilhado)
- Migrations aplicadas via `pnpm exec supabase db push --linked`
- Third-Party Auth Clerk configurado no projeto cloud (ADR-004)
- Service role key e anon key em `.env.local` de cada app

## Alternativas consideradas

1. **Continuar troubleshooting WSL/Docker.** Rejeitada: custo de tempo alto, sem garantia de resolver, e qualquer dev novo do time bateria no mesmo problema.
2. **Supabase nativo no WSL (sem Docker).** Tecnicamente possível, mas reproduz Postgres + GoTrue + PostgREST + Storage + Realtime manualmente. Inviável de manter alinhado com versões oficiais.
3. **Docker dentro do WSL nativo (sem Docker Desktop).** Resolveria networking, mas perde features do Desktop e exige reconfiguração.
4. **Cloud com projeto compartilhado entre devs.** Rejeitada: viola isolamento, complica seed/reset, e free tier tem limites estreitos.

## Consequências

**Positivas:**

- Dev e produção usam o mesmo backend gerenciado (Supabase). Migrations validadas em ambiente real.
- Elimina dependência de Docker Desktop pra Supabase. Setup do dev simplificado.
- Realtime do Supabase funciona desde o dia 1 (no local, exigia configuração extra).
- TPA Clerk testado de verdade em ambiente real.

**Negativas:**

- Latência rede maior em dev (~50-100ms por query) vs local. Aceitável.
- Dep de internet pra desenvolver. Aceitável (todos os outros serviços já são cloud — Clerk, Anthropic, Langfuse).
- Secrets cloud em `.env.local` (anon + service role). Mitigado por gitignore + rotação periódica.
- `supabase db diff --linked` exige Docker pra shadow DB local. Workaround: `db push` direto (sem diff) ou rodar diff só ocasionalmente.
- Multi-dev exige 1 projeto por pessoa (impacto: provisioning + custo zero no free tier, mas processo manual).

## Implicações no roadmap

- Produção: continua sendo Supabase Cloud, agora com mesma stack que dev. Sem mudança.
- CI: precisa ter projeto Supabase dedicado pra testes integration (ou usar `supabase start` em CI, onde Linux+Docker funciona nativamente).
- Onboarding de novo dev: criar projeto Supabase próprio + rodar `supabase link` + `db push`. Documentar em `docs/development.md`.
