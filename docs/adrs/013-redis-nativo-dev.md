# ADR-013: Redis nativo no WSL como backend de filas em dev

Data: 2026-05-15
Status: aceito

## Contexto

Redis é usado pelo BullMQ (filas de jobs) e pelo bus de eventos pub/sub (ADR-003). Setup original tinha Redis como container Docker via `docker-compose.yml` (`office-redis`, imagem `redis:7.4-alpine`).

Durante a migração da Sprint 0.3d (relacionada à ADR-012), o mesmo problema de WSL ↔ Docker networking que afetou o Supabase também afetou o Redis: o agent-runtime tentava conectar em `redis://localhost:6379` e dava `ETIMEDOUT`. Container rodando, porta exposta corretamente (`0.0.0.0:6379->6379/tcp`), mas inacessível do WSL.

## Decisão

Usar **redis-server nativo no Ubuntu WSL** (`apt install redis-server`) como backend de filas em ambiente de desenvolvimento. Container Docker fica obsoleto pra dev.

Setup:

```bash
sudo apt install redis-server
sudo service redis-server start
redis-cli ping  # PONG
```

`REDIS_URL` continua `redis://localhost:6379` — sem mudança no código ou nas envs.

## Alternativas consideradas

1. **Manter Redis em Docker container.** Bloqueado pelo mesmo problema de networking WSL.
2. **Upstash Redis Cloud (free tier).** Funcionaria, mas adiciona dep externa pra um serviço que pode rodar local trivialmente. Útil em CI e produção, não em dev.
3. **Redis embarcado em Node (ioredis-mock).** Pra dev funciona, mas comportamento diverge do Redis real em casos sutis (pub/sub timing, blocking commands). Risco alto pra plataforma que depende fortemente de BullMQ.

## Consequências

**Positivas:**

- Setup em 30 segundos via `apt`. Independente de Docker Desktop.
- Confiabilidade — instalado no SO, sobe junto com WSL via systemd.
- Latência mínima — mesmo processo no mesmo host.
- Compatível com qualquer máquina dev (Linux, macOS via brew, WSL).

**Negativas:**

- Mais um serviço pra rodar antes do `pnpm dev` (mitigado por `systemctl enable redis-server`).
- Divergência leve entre dev (redis local) e produção (Redis managed — Upstash/Railway). Não esperado causar bugs reais; protocolo Redis é estável entre versões.
- Sem TLS/auth em dev (Redis nativo escuta 127.0.0.1 sem senha). Aceitável pra localhost; produção usa connection string com `rediss://` + senha.

## Documentação

Novo dev:

```bash
# Ubuntu/WSL
sudo apt update && sudo apt install -y redis-server
sudo service redis-server start
sudo systemctl enable redis-server  # opcional, sobe junto com WSL

# macOS
brew install redis
brew services start redis
```

Pra produção (a definir): Upstash Redis Cloud com tier escalável conforme volume, ou Railway Redis se for o caso de manter tudo no mesmo PaaS. Decisão fica pra ADR futura quando provisionar produção.
