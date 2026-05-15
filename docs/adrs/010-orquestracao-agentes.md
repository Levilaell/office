# ADR-010: Modelo de orquestração de agentes em 3 camadas + supervisor

Data: 2026-05-15
Status: aceito

## Contexto

A plataforma terá dezenas de agentes distribuídos em 6 departamentos (atendimento, societario, pessoal, contabil, fiscal, financeiro_interno). Sem um modelo explícito de orquestração, três coisas degradam rápido: (1) agentes começam a chamar uns aos outros direto, criando spaghetti de dependências e violando ADR-003; (2) escalonamento humano vira ad-hoc, com cada agente reimplementando detecção de loop e budget; (3) custo dispara porque toda decisão acaba indo no modelo mais caro disponível.

`.claude/rules/agents-architecture.md` já documentava o roteador global e o conceito de supervisor. ADR-003 fixou BullMQ como bus entre serviços. ADR-008 fixou os 3 tiers de LLM (triage/default/critical). Este ADR formaliza como esses elementos se compõem numa hierarquia única — decisão já implícita nas regras + ADRs anteriores, agora explicitada porque vai ser load-bearing pra fases 1 em diante e qualquer dev novo precisa entender o mental model antes de codar um departamento.

## Decisão

Orquestração em três camadas + um supervisor transversal:

**Camada 1 — Roteador global.** Único agente sempre presente em todo tenant (`agent_key='router'`, `department='platform'`, `tier='triage'` — Haiku 4.5). Recebe entrada externa via `POST /api/triagem`, classifica em um dos 6 departamentos e emite `task.created.global`. Não executa, não decide produto — só roteia. Detalhes em `.claude/rules/agents-architecture.md` (não duplicado aqui).

**Camada 2 — Coordenadores por departamento.** Um coordenador por departamento ativo no tenant, tier `default` (Sonnet 4). Implementado como subgraph LangGraph com supervisor pattern interno: o coordenador é o root node, especialistas são child nodes, e a transição entre eles acontece in-process via state do graph (sem ida ao Redis). Subscreve `task.assigned` com `department=<seu>` e mantém o ciclo do task até resolução ou escalação.

**Camada 3 — Especialistas.** Nodes dentro do subgraph do coordenador. Tier variável conforme natureza: `triage` pra classificação/parsing simples, `default` pra raciocínio padrão, `critical` (Opus 4.7) pra decisões com impacto regulatório. Cada especialista declara ferramentas (whitelist), escopo de dados, prompt versionado e budget próprio.

**Supervisor global.** Processo transversal que observa via tap no Redis pub/sub: detecta loops (mesma ação 3+ vezes — limite de `.claude/rules/agents-architecture.md`), budget esgotado (ADR-008 + `llm-cost.md`) e timeouts. Quando dispara, emite `approval.created` com prioridade alta e remove o agente do ciclo. Não é um LLM permanente em execução — é deterministic monitor que só invoca LLM se a escalação exigir resumo pra humano.

### Comunicação

| De → Para | Canal | Justificativa |
|---|---|---|
| Externo → Roteador | HTTP REST | Síncrono, baixa latência, ADR-003 |
| Roteador → Coordenador | BullMQ + Redis pub/sub | Assíncrono, persistente, cross-departamento |
| Coordenador → Especialista | LangGraph in-process | Mesmo processo, latência zero, state compartilhado |
| Especialista → Coordenador | LangGraph return | Idem |
| Coordenador → Coordenador (raro) | BullMQ via `handoff.requested` | Cross-departamento exige bus persistente |
| Qualquer → Supervisor | Redis pub/sub tap | Observação passiva, não bloqueia caminho feliz |
| Qualquer → Usuário | Socket.io via agent-runtime (ADR-009) | Realtime UI |

### Nomenclatura de eventos

Padrão `tipo.escopo.ação`, já em uso em `packages/shared-events/src/schemas.ts`. Eventos correntes: `task.created.global`, `task.assigned`, `task.status_changed`, `task.completed`, `task.failed`, `subtask.completed`, `handoff.requested`, `agent.state_changed`, `approval.created`, `approval.resolved`. Novos eventos seguem o mesmo padrão e são adicionados ao schema Zod antes de serem publicados.

### Regra crítica

Agentes NÃO se chamam diretamente. Comunicação cross-agente é sempre via bus (entre departamentos) ou via state do subgraph (dentro de departamento). Viola ADR-003 e este ADR. ESLint custom rule + revisão em PR enforça.

## Alternativas consideradas

- **Single supervisor LLM orquestrando tudo.** Um agente master decide a cada turno quem chama. Rejeitada por custo (todo turno passa por modelo caro) e latência (round-trip extra). Escala mal a dezenas de agentes; a janela de contexto vira gargalo. O supervisor aqui é deterministic, não LLM permanente.
- **Eventos puros sem hierarquia (mesh).** Cada agente subscreve o que quer, publica o que quer. Rejeitada por: debug impossível em incidente (quem causou loop?), racing condition entre handlers, e ausência de ponto único pra aplicar budgets/aprovações.
- **Direct agent-to-agent calls (function calls entre agentes).** Rejeitada — viola ADR-003 explicitamente. Acoplamento forte, mock difícil em testes, breaking changes propagam.
- **Temporal pra tudo desde o dia 1.** Determinismo total, replay de execução. Rejeitada pra Fase 0/1 — complexidade operacional (workers, namespaces, versionamento de workflow) não justificada antes da Fase 2. ADR-003 já reservou Temporal pra Fase 2+ em workflows de longa duração.

## Consequências

Positivas:
- Escalável a dezenas de agentes sem virar mesh ingovernável. Adicionar departamento = registrar coordenador + especialistas no kernel.
- Tier de modelo por camada otimiza custo: 80% das execuções do roteador rodam em Haiku, coordenadores raramente escalam pra Opus, especialistas só sobem de tier quando o escopo exige.
- Cada camada tem responsabilidade clara — debug em incidente segue caminho previsível (entrada → roteador → coordenador X → especialista Y).
- Supervisor centralizado evita reimplementação de detecção de loop/budget em cada agente.
- LangGraph subgraph dentro de departamento elimina round-trip de Redis pra cada transição entre especialistas — latência cai em ordens de grandeza vs bus puro.

Negativas:
- Mental model maior pra dev novo entender. Mitigado por este ADR + diagrama em `docs/architecture/` (a criar quando primeiro departamento entrar na Fase 1).
- Dois canais de comunicação (LangGraph in-process vs BullMQ cross-process) exigem disciplina pra não misturar. Mitigado por convenção: in-process é a primeira escolha, bus é exceção justificada (cross-departamento ou trabalho longo).
- Supervisor é ponto único de falha conceitual — se ele cai, escalação humana atrasa. Mitigado por: deterministic monitor (não precisa de LLM saudável), heartbeat em Better Stack, fallback de timeout enforced no próprio worker BullMQ (defesa em profundidade).

## Quando reverter

Se três coisas acontecerem simultaneamente:
1. LangGraph se mostrar inadequado pra subgraphs (versionamento, debug, performance);
2. Coordenadores acumularem state demais e violarem 12-factor;
3. Supervisor deterministic não der conta da complexidade de detecção.

Nesse cenário, considerar adoção de Temporal antes do previsto (era Fase 2) e mover coordenação pra workflows determinísticos. Não é reversão deste ADR — é evolução pra um novo (ADR de orquestração v2).
