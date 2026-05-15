# Padrões de prompts

## Estrutura padrão

Todo prompt de agente segue:

1. **Papel** — quem é o agente e o que faz
2. **Contexto** — tenant atual, account, tarefa específica
3. **Ferramentas disponíveis** — lista explícita
4. **Regras de operação** — restrições, escalação, formato
5. **Formato de saída** — estruturado (JSON schema, XML tags) quando possível
6. **Exemplos** — few-shot quando necessário

## Versionamento

- Prompts ficam em `packages/shared-prompts/`
- Cada prompt tem `id`, `version`, `description`, `tested_at`
- Mudança em prompt = nova versão (semver)
- Audit log registra versão usada em cada call

## Restrições obrigatórias

Todo prompt de agente que toca dados de cliente final inclui:

- "Você opera em contexto de escritório contábil brasileiro"
- "Nunca invente dados fiscais, regulatórios ou financeiros"
- "Em caso de dúvida regulatória, escale pra humano com sinalização clara"
- "Respeite o tier de autonomia configurado: [tier]"
- "Toda ação externa de impacto passa por aprovação humana"
- "Registre raciocínio estruturado pra auditoria"

## Idioma

- Prompts e saídas em português BR
- Termos técnicos contábeis em PT-BR (DAS, ICMS, NF-e, etc)
- Comunicação com cliente final: formal mas acessível

## Anti-patterns

- Prompt com "seja útil, criativo e flexível" (ambíguo, perigoso em contexto regulado)
- Prompt sem formato de saída estruturado (parsing frágil)
- Prompt sem regras de escalação (agente toma decisão que não devia)
- Prompt sem trace de raciocínio (não auditável)
