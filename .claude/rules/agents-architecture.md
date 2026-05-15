# Arquitetura de Agentes

## Definição de agente

Todo agente tem:
- Identidade (id, nome, departamento)
- Papel (descrição clara do que faz e não faz)
- Ferramentas disponíveis (whitelist)
- Escopo de permissões (que dados pode ler/escrever)
- Prompts versionados (id de versão, hash do prompt)
- Métricas (latência, custo, taxa de sucesso, taxa de escalação)
- Budget (max tokens por run, max turnos, max custo $)
- Tier de autonomia configurado pelo tenant

## Comunicação

- Agentes NÃO se chamam diretamente
- Comunicação via bus de eventos (BullMQ/Redis)
- Eventos têm schema validado (Zod)
- Cada evento carrega trace_id pra correlação

## Handoffs

Quando agente A precisa que agente B continue:
1. A publica evento `handoff_requested` com payload estruturado
2. Supervisor decide se aceita ou rejeita
3. B subscreve eventos do seu tipo e processa
4. Contexto transferido inclui: motivo, dados relevantes, restrições, prazo

## Memória

3 camadas:
1. **Task memory** — efêmera, vive na execução atual
2. **Conversation memory** — média duração, persiste enquanto sessão de cliente está ativa
3. **Semantic memory** — longa duração, vetor (pgvector), particionado por tenant

Sempre escrever em memória semântica: decisões importantes, precedentes, padrões observados.

## Loops e segurança

- Máximo de turnos por agente por task: configurável (default 10)
- Detecção de loop: mesma ação repetida 3+ vezes = escalar pro supervisor
- Timeout por agente run: configurável (default 5 minutos)
- Custo por run: budget configurado; se ultrapassa, parar e escalar

## Modelo de LLM por uso

- Triagem, classificação simples: Haiku 4.5
- Maioria das tarefas: Sonnet 4
- Decisões críticas, raciocínio complexo, refactor de prompts: Opus 4.7
- Cascade: tentar modelo menor primeiro, escalar se confidence baixa

## Aprovação humana

Por tier de autonomia configurado pelo tenant:
- Manual: agente sugere, humano executa
- Sugestivo: agente prepara, humano aprova antes de executar
- Semi-autônomo: agente executa baixo risco, escala alto risco
- Autônomo: agente executa tudo no escopo

Ações de impacto regulatório SEMPRE passam por aprovação, independente do tier.
