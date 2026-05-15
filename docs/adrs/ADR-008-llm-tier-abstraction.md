# ADR-008: Abstração de tier de LLM com override por env

Data: 2026-05-15
Status: aceito

## Contexto

Modelos da Anthropic mudam de versão com frequência (Sonnet 4 → 4.5 → 4.6; Opus 4 → 4.7; Haiku 4.5 → ...). Amarrar código diretamente a nome de versão (`claude-sonnet-4-6`) cria dívida silenciosa: cada upgrade vira find-replace em múltiplos lugares e o risco de algum agente ficar pra trás é real. Além disso, a escolha do modelo é semanticamente uma decisão de produto (custo vs qualidade vs latência), não de engenharia. Diferentes tenants podem, no futuro, ter preferências diferentes.

## Decisão

Abstração semântica em `packages/shared-config`:

```ts
type AgentTier = 'triage' | 'default' | 'critical';
```

Mapping default tier → modelo concreto via `DEFAULT_TIER_TO_MODEL`:
- `triage` → `claude-haiku-4-5-20251001`
- `default` → `claude-sonnet-4-6`
- `critical` → `claude-opus-4-7`

Env vars opcionais `LLM_MODEL_TRIAGE`, `LLM_MODEL_DEFAULT`, `LLM_MODEL_CRITICAL` sobrescrevem o default sem rebuild. Função `resolveModelForTier(tier, env)` retorna um `LlmModelId` (string branded). Pricing constants vivem em `shared-llm/pricing.ts`, keyed por ID concreto do modelo; cálculo de custo recebe o ID resolvido, não o tier.

Agentes declaram tier no prompt definition, nunca modelo. O `model` field do `audit_log` (ver ADR-006) registra sempre o ID concreto resolvido, pra que debugging de comportamento específico seja possível.

## Alternativas consideradas

- **Enum por nome de modelo:** amarra a versão. Upgrade é doloroso e propenso a esquecer um caller.
- **Cada caller escolhe modelo manualmente:** inconsistência entre agentes; sem ponto único pra ajustar custo. Falha em escala.
- **Auto-cascade (tentar Haiku → Sonnet → Opus baseado em confidence):** desejável no futuro, mas é evolução desta abstração, não substituição. Sem feature ainda. Quando vier, o tier vira "tier inicial" e o cascade respeita um teto.

## Consequências

Positivas:
- Upgrade de modelo = 1 env var ou 1 linha no mapping default. Zero código de agente muda.
- Tier expressa intenção de negócio (custo vs qualidade). Revisão de tier por agente vira decisão de produto, não bug de engenharia.
- Pricing centralizado simplifica controle de custo (ver `.claude/rules/llm-cost.md`).
- Override por env permite A/B test ou rollback rápido sem deploy.

Negativas:
- Pricing constants precisam ser mantidas atualizadas conforme Anthropic muda preços. Mitigação: docs.claude.com/pricing como source of truth, revisão mensal.
- Abstração esconde modelo concreto na leitura do código. Debugging de comportamento específico de modelo exige consultar `audit_log.model`, que já registra o ID resolvido.
