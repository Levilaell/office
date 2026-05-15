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

## Agente Roteador

- Único agente sempre presente em todo tenant. Camada 1 do modelo de orquestração: nenhuma decisão de departamento sai sem passar por ele.
- `agent_key='router'`, `role='router'`, `department='platform'`, `tier='triage'` (Haiku 4.5 — econômico e suficiente pra classificação).
- `autonomy_tier='autonomo'` propositalmente: classificar mensagem em departamento é decisão interna do sistema, não uma ação externa que possa causar impacto regulatório.
- Seedado automaticamente em duas portas: webhook `organization.created` e API síncrona `/api/onboarding/complete-org`. Idempotente via upsert `(tenant_id, agent_key)`; reentregas não duplicam.
- Recebe mensagens externas (POST `/api/triagem`) e classifica em um dos 6 departamentos (`atendimento`, `societario`, `pessoal`, `contabil`, `fiscal`, `financeiro_interno`). Saída é estritamente JSON validado por Zod; falha de schema marca o run como `failed`.
- Quando o segundo agente entrar (coordenador de departamento), o roteador despacha via evento — publica `task.assigned` no canal `tenant:{id}` com `department` no payload, e o coordenador subscreve. Roteador NÃO chama coordenador diretamente.
- Script de retroatividade: `pnpm seed:agents` cria roteador em tenants que existiam antes da feature.
