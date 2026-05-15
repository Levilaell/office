# Controle de custo de LLM

## Princípios

- Custo de LLM é métrica de produto, não engenharia. Monitorar como receita.
- Custo por tenant deve ser inferior a 20% do MRR do tenant
- Alertas automáticos quando tenant ultrapassar threshold

## Práticas obrigatórias

### Cache

- Prompts repetidos com mesmo contexto: usar prompt caching da Anthropic (>=1024 tokens de prefixo estático)
- Resultados determinísticos de classificação: cache em Redis por hash do input
- TTL configurável por tipo de resultado

### Cascade de modelos

Sempre tentar nessa ordem:
1. Haiku 4.5 com prompt simples
2. Se confidence < threshold: Sonnet 4
3. Se ainda incerto ou tarefa crítica: Opus 4.7

Marcar no audit log qual modelo foi usado.

### Budget enforcement

- Cada agente tem budget em USD por run
- Pre-flight check: estimar tokens antes de chamar
- Hard stop quando atingir 90% do budget
- Métricas por tenant agregadas em real time

### Prompt optimization

- Reescrever prompts longos antes de assumir que precisa de modelo maior
- Usar few-shot apenas quando necessário (mede ganho)
- Remover instruções redundantes
- Prompts versionados: A/B test antes de promover

### Streaming

- UI usa streaming sempre que possível pra UX percebida
- Streaming não reduz custo, mas melhora time-to-first-token

## Anti-patterns

- Loop com LLM no meio sem budget cap
- Prompt gigante carregando contexto que não muda (use cache)
- Re-classificar mesma coisa toda hora (cache)
- Opus pra tarefa simples
