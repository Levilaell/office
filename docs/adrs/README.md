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

## Convenção

- Numeração sequencial, zero-padding até 3 dígitos
- Status: `aceito`, `superseded by ADR-XXX`, `depreciado`
- Datas referem-se à decisão, não à implementação
- ADRs nunca são editados retroativamente — superseded por outro ADR quando a decisão muda
