# Setup de desenvolvimento

Guia pra subir o projeto do zero numa máquina nova. Pra contexto arquitetural, ver `CLAUDE.md` e `docs/adrs/`.

## Ambiente padrão: Supabase Cloud + Redis nativo

ADR-012 e ADR-013 definem: **ambiente de dev é Cloud-first**.

- Supabase: projeto cloud linkado via `supabase link --project-ref <ref>`. Toda migration vai com `pnpm exec supabase db push --linked`. Toda regeração de types vai com `pnpm db:types` (já configurado pra `--linked`). Pra regerar contra Supabase local em Docker, usa `pnpm db:types:local`.
- Redis: instalado nativo no SO (apt/brew), não em container.
- Docker NÃO é requisito de dev. Se você roda `pnpm db:start` (Supabase local em Docker), é opcional — útil pra teste isolado de schema ou pra rodar `db:diff` (que exige shadow DB).
- Seeds e scripts assumem `SUPABASE_URL` apontando pro endpoint REST do projeto cloud (`<ref>.supabase.co`). Se colar URL de dashboard por engano, todos os seeds falham rápido com mensagem clara.

## Pré-requisitos

- **Node 20+** (declarado em `package.json` → `engines.node`).
- **pnpm 10.33+** (fixado em `package.json` → `packageManager`). Instalar via `corepack enable && corepack prepare pnpm@latest --activate` ou `npm i -g pnpm`.
- **WSL2 Ubuntu 22.04+** se em Windows. Linux nativo e macOS funcionam direto.
- Contas em:
  - [Anthropic Console](https://console.anthropic.com) — API key
  - [Langfuse Cloud](https://cloud.langfuse.com) — tracing de LLM
  - [Clerk](https://dashboard.clerk.com) — auth + Organizations habilitado
  - [Supabase](https://supabase.com) — Cloud free tier (ADR-012)

**Não precisa de Docker** pra desenvolver. Supabase é Cloud (ADR-012) e Redis roda nativo no SO (ADR-013).

## Setup inicial

```bash
git clone git@github.com:levilael/office.git
cd office
pnpm install
```

### Configurar envs

Cada app lê de seu próprio `.env.local`. A fonte canônica é o `.env.example` da raiz; copiar pra cada app:

```bash
cp .env.example apps/web/.env.local
cp .env.example apps/agent-runtime/.env.local
cp .env.example apps/workers/.env.local
```

Preencher os valores em cada cópia (todos com o mesmo conteúdo — tech debt conhecido, fonte única em backlog).

Para que servem as 15 vars está comentado no próprio `.env.example`. Resumo das pegadinhas:

- `INTERNAL_SERVICE_TOKEN` — gerar com `openssl rand -hex 32` e usar o **mesmo valor** nos 3 apps.
- `SUPABASE_*` — pegar do dashboard Supabase Cloud (Project Settings → API). `SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_URL` têm o mesmo valor; idem pra anon key. `SERVICE_ROLE_KEY` nunca expor no client.
- `CLERK_DOMAIN` — em Clerk Dashboard → API Keys → "Frontend API" (sem `https://`).
- `LANGFUSE_HOST` — `https://cloud.langfuse.com` (UE) ou `https://us.cloud.langfuse.com` (US), conforme escolha do projeto.

## Subir infra local

### Redis nativo (ADR-013)

```bash
# Ubuntu/WSL
sudo apt update && sudo apt install -y redis-server
sudo service redis-server start
sudo systemctl enable redis-server   # opcional, sobe junto com WSL

# macOS
brew install redis
brew services start redis

# validar
redis-cli ping   # → PONG
```

### Supabase Cloud (ADR-012)

1. Criar projeto novo em [supabase.com/dashboard](https://supabase.com/dashboard) na região **São Paulo** (sa-east-1). Plano free.
2. Copiar `Project URL` e `anon`/`service_role` keys → `.env.local` dos 3 apps.
3. Linkar o projeto local com o cloud:

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref <project-ref-do-dashboard>
pnpm exec supabase db push --linked
```

O `db push --linked` aplica todas as migrations de `supabase/migrations/` no projeto cloud. Idempotente.

4. Configurar Third-Party Auth do Clerk no projeto Supabase Cloud:
   - Dashboard Supabase → Authentication → Sign In/Up → Third Party Auth
   - Adicionar Clerk como provider, colar `CLERK_DOMAIN` (sem `https://`)
   - Salvar e aguardar Supabase validar o JWKS (~30s)

**1 projeto por dev** — não compartilhar. Free tier cobre todos os devs.

## Rodar

```bash
pnpm dev
```

Sobe os 3 apps em paralelo via Turborepo:

- `apps/web` em http://localhost:3000 (Next.js)
- `apps/agent-runtime` em http://localhost:3001 (Hono + Socket.io + workers BullMQ)
- `apps/workers` (IMAP poller + drafts expiration poller a partir do Sprint 1.5)

### Matar processos órfãos

`pnpm dev` ocasionalmente deixa processos pendurados em 3000/3001 quando você mata o terminal de forma rude. Pra liberar:

```bash
lsof -ti:3000,3001 | xargs -r kill -9
```

### Reset de dados de demo

Pra popular o tenant com dados de teste em ordem correta:

```bash
pnpm demo:reset
```

Roda em sequência: `seed:agents` → `seed:atendimento-test-data` → `seed:leads-test-data`. Idempotente, todos. Não toca em `channel_session` (rode `pnpm seed:email-channel` à parte se quiser canal real).

## Validar

### 1. Signup via UI

Abrir http://localhost:3000, fazer signup com Clerk, criar uma Organization no onboarding. O webhook do Clerk cria o `tenant` no Supabase Cloud + um agente roteador (`agent_key='router'`) automaticamente. Se algo falhar, ver tabela `webhook_events` no Supabase Studio.

### 2. Seed do roteador (retroativo)

Se o tenant existia antes da feature de roteador, popular manualmente:

```bash
pnpm seed:agents
```

Idempotente — pode rodar várias vezes.

### 3. Smoke test do `/api/triagem`

Pega o session cookie de um browser logado e dispara:

```bash
curl -X POST http://localhost:3000/api/triagem \
  -H 'cookie: <session do browser>' \
  -H 'content-type: application/json' \
  -d '{"text":"Recebi um boleto de ICMS, qual o vencimento?"}'
# → 202 { "taskId": "...", "traceId": "..." }
```

Acompanhar:

```bash
curl http://localhost:3000/api/tasks/<taskId> -H 'cookie: <session>'
# → { "status":"completed", "result":{"department":"fiscal", ...} }
```

Ou abrir `/dashboard/escritorio` e ver o avatar do roteador mudar de estado em tempo real via Socket.io.

## Gotchas conhecidos

### WSL2 + Docker Desktop networking

Causa raiz do que motivou ADR-012 e ADR-013. Em WSL2 (Ubuntu 24.04 + Windows 11 build 26200), Docker Desktop pode não expor portas dos containers pra `127.0.0.1` do WSL. Sintoma: containers `healthy` mas `curl localhost:porta` retorna `000`. Por isso saímos de Supabase/Redis em Docker. Se for testar Docker pra qualquer outra coisa nesse setup, verifique antes:

```bash
docker run --rm -p 8080:80 nginx &
curl -sf http://127.0.0.1:8080 || echo "WSL ↔ Docker networking quebrado"
```

### Cache do Turborepo travado

Comportamento estranho após mudança de schema/types:

```bash
rm -rf .turbo node_modules apps/*/node_modules packages/*/node_modules
pnpm install
```

### `db push --linked` exige Docker pra shadow DB?

Não. `db push --linked` aplica direto no cloud. O que exige Docker é `db diff --linked` (compara contra shadow DB local). Pra gerar migration nova sem Docker, editar o SQL direto em `supabase/migrations/` seguindo a convenção `YYYYMMDDHHMMSS_descricao.sql` e dar `db push --linked` em seguida.

### CLERK_DOMAIN inválido derruba o boot do Supabase

Se você apontar `CLERK_DOMAIN` pra um domínio que não existe na Clerk, o Supabase Cloud invalida o TPA na hora e auth para de funcionar. Pegar o valor exato em Clerk Dashboard → API Keys → "Frontend API". Sem `https://`.

## Comandos úteis

```bash
pnpm dev              # 3 apps em paralelo
pnpm build            # build geral
pnpm typecheck        # tsc em todo workspace
pnpm lint             # ESLint
pnpm test             # vitest (unit)
pnpm test:integration # tests de RLS (precisa de Supabase ativo)

pnpm exec supabase db push --linked   # aplica migrations no cloud
pnpm exec supabase db diff --linked   # gera migration a partir de mudanças (precisa de Docker pra shadow DB)
pnpm exec supabase gen types typescript --linked > packages/shared-db/src/database.types.ts

pnpm seed:agents                     # cria roteador em tenants existentes (idempotente)
pnpm seed:atendimento-test-data      # 1 account + 3 obligations + 2 documents (Sprint 1.3)
pnpm seed:leads-test-data            # 3 leads em estados diferentes (Sprint 1.4)
pnpm demo:reset                      # orquestra os 3 seeds acima em ordem
```

## Convenções de commit e branches

- Branches em inglês ou kebab-case-pt: `feat/...`, `fix/...`, `chore/...`, `docs/...`, `refactor/...`.
- Commits **conventional** (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).
- Mensagem do commit explica o **porquê** e o sintoma original — o diff já mostra o **o que**.
- Nunca commitar direto em `main`. PR sempre, mesmo solo. `pnpm lint && pnpm typecheck && pnpm test` precisam passar antes de abrir.

Mais detalhes em `CLAUDE.md` e `.claude/rules/`.
