# Architecture Decision Records

Decisões arquiteturais da Plataforma Contábil em ordem cronológica. Formato: contexto → decisão → alternativas → consequências.

## Aceitos

- [ADR-001](ADR-001-monorepo-pnpm-turborepo.md) — pnpm workspaces + Turborepo como gerenciador de monorepo
- [ADR-002](ADR-002-package-boundaries.md) — Boundaries entre packages e regra de acesso a dados
- [ADR-003](ADR-003-comunicacao-inter-servicos.md) — Padrão de comunicação entre apps/web e apps/agent-runtime
- [ADR-004](ADR-004-auth-clerk-organizations.md) — Autenticação via Clerk com Organizations + Third-Party Auth do Supabase
- [ADR-005](ADR-005-multi-tenancy-uuid-mapping.md) — Multi-tenancy com tenant_id UUID interno + clerk_org_id mapping
- [ADR-006](ADR-006-audit-log-insert-only.md) — audit_log INSERT-only e campos mandatórios
- [ADR-007](ADR-007-clerk-webhook-onboarding-sincrono.md) — Sincronização Clerk → DB via webhook + onboarding síncrono
- [ADR-008](ADR-008-llm-tier-abstraction.md) — Abstração de tier de LLM com override por env
- [ADR-009](ADR-009-socket-io-no-agent-runtime.md) — Socket.io server vive em `apps/agent-runtime` (substitui detalhe do ADR-003)
- [ADR-010](010-orquestracao-agentes.md) — Modelo de orquestração de agentes em 3 camadas + supervisor
- [ADR-011](011-ux-quatro-superficies.md) — UX em quatro superfícies complementares (inbox, conversa, painel, escritório 2D)
- [ADR-012](012-supabase-cloud-migration.md) — Supabase Cloud como ambiente de desenvolvimento
- [ADR-013](013-redis-nativo-dev.md) — Redis nativo no WSL como backend de filas em dev
- [ADR-014](014-escopo-atendimento-fase-1.md) — Escopo do Departamento de Atendimento na Fase 1 (operacional + comercial leve)
- [ADR-015](015-channel-adapter.md) — Abstração ChannelAdapter para canais de comunicação
- [ADR-016](016-coordenador-atendimento-roteamento.md) — Coordenador de Atendimento como camada de roteamento de departamento
- [ADR-017](017-modo-shadow-tiers-autonomia.md) — Modo shadow e tiers de autonomia em conversa síncrona

## Convenção

- Numeração sequencial, zero-padding até 3 dígitos
- Status: `aceito`, `superseded by ADR-XXX`, `depreciado`
- Datas referem-se à decisão, não à implementação
- ADRs nunca são editados retroativamente — superseded por outro ADR quando a decisão muda
