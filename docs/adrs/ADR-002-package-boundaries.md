# ADR-002: Boundaries entre packages e regra de acesso a dados

Data: 2026-05-15
Status: aceito

## Contexto

Cinco packages compartilhados (`shared-types`, `shared-config`, `shared-db`, `shared-prompts`, `shared-domain`) consumidos por três apps. Sem regras de fronteira explícitas, há risco de: lógica de domínio duplicada em apps diferentes com regras levemente divergentes; queries diretas ao banco espalhadas; refactor de schema quebrando consumidores inesperados. Isso viola o princípio 2 (estado canônico compartilhado).

## Decisão

Grafo de dependência estrito:

```
shared-types       → zero deps internas
shared-config      → zero deps internas
shared-db          → depende de shared-types
shared-prompts     → depende de shared-types, shared-config
shared-domain      → depende de shared-types, shared-db, shared-prompts
```

`shared-prompts` depende de `shared-config` porque `PromptDefinition` carrega `tier: AgentTier`, e tier é configuração de plataforma, não primitivo de domínio (ver ADR de tiers de LLM, a ser escrito).

Apps importam: `shared-domain`, `shared-prompts` (quando aplicável), `shared-config`, `shared-types`.

**Regra crítica:** apps NÃO importam `shared-db` direto. Acesso a dados sempre via funções de `shared-domain`. ESLint rule `no-restricted-imports` enforça.

## Alternativas consideradas

- **Estrutura plana (shared único):** acoplamento total, refactor inseguro.
- **Apps importam shared-db diretamente:** com o tempo, mesma operação aparece em dois apps com regras de negócio levemente diferentes. Violação direta do princípio de estado canônico.

## Consequências

Positivas:
- Operações de domínio têm uma única definição.
- Refactor de schema (`shared-db`) só afeta `shared-domain`; apps continuam estáveis.
- Type-safety end-to-end via re-exports controlados em `shared-types`.

Negativas:
- `shared-domain` cresce com o tempo.
- Mitigação: subdividir por subdomínio (`shared-domain/accounting`, `shared-domain/payroll`, etc) quando passar de ~5k linhas.
