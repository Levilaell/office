# ADR-018: shared-domain pode depender de shared-events

Data: 2026-05-18
Status: aceito

## Contexto

Durante o Sprint 1.0-prep (refactor de triagem) e Sprint 1.0 aligned (foundations de Atendimento), surgiu um padrão que merece formalização: funções de domínio que **iniciam operações assíncronas** precisam enfileirar trabalho no bus de eventos. Especificamente:

- `packages/shared-domain/src/triagem/index.ts` chama `enqueueAgentTask` de `@office/shared-events`
- `packages/shared-domain/src/conversations/index.ts` publica `message.received` em `@office/shared-events`

Isso cria a dependência `shared-domain` → `shared-events` no grafo de packages.

Em arquiteturas mais ortodoxas (hexagonal, clean architecture, ports-and-adapters), "domínio" é a camada mais interna e não depende de infra. Bus de eventos é infra. A pergunta legítima é: essa dependência viola separação de camadas?

Há também o ponto operacional: hoje, qualquer mudança em `shared-events` (renomear evento, adicionar campo a payload Zod) potencialmente força rebuild de `shared-domain` e dos consumidores dele. Acoplamento real, não teórico.

## Decisão

**`shared-domain` pode depender de `shared-events`.** Não é violação de camada — é reflexo de que "iniciar triagem" e "registrar mensagem inbound" são operações de domínio que **incluem** publicação de evento como parte da definição da operação, não como detalhe de infra terceirizado.

Restrições que mantêm o acoplamento sob controle:

1. **Direção única.** `shared-events` NUNCA importa de `shared-domain`. Eventos são primitivos (schemas Zod + funções de enqueue/publish/subscribe), agnósticos de qualquer modelo de domínio.

2. **Schemas de evento em `shared-events`**, não em `shared-domain`. Quando `shared-domain` precisa publicar `message.received`, ele consome o schema/tipo de `shared-events` — não define lá. Isso mantém eventos como contrato compartilhado, não como propriedade de um domínio específico.

3. **`shared-events` não pode crescer pra ter lógica de negócio.** Continua sendo apenas: schemas Zod de eventos, factory de queues BullMQ, helpers de pub/sub Redis, tipagem de envelopes. Se algum dia surgir tentação de colocar regra de negócio em `shared-events` (ex: "se evento X, faça Y"), isso vai pra `shared-domain` ou pra um agente.

4. **Funções de domínio que enfileiram declaram isso na assinatura.** Nome reflete: `enqueueTriagem`, não `triagem`; `appendMessage` (que internamente publica) explicita o efeito colateral no comentário/JSDoc. Caller sabe que está iniciando algo assíncrono.

5. **Testes de domínio mockam `shared-events` quando relevante.** Fake do BullMQ enqueue em testes de `triagem` e `conversations` (já é o padrão em `fake-supabase.ts` — replicar pra eventos).

## Alternativas consideradas

**A) Manter "domínio puro": `shared-domain` não conhece `shared-events`.** Mover funções como `enqueueTriagem` pra fora — talvez `packages/shared-application/` (camada de aplicação) ou `apps/web/src/lib/`. Rejeitada:

- Volta o problema que o Sprint 1.0-prep resolveu: triagem em `apps/web/lib` precisava ser duplicada pra webhooks de canal não-Next
- Criar `shared-application` adiciona package vazio só pra acomodar 2-3 funções — overhead alto pra ganho conceitual
- Em projeto pragmático, "domínio" e "aplicação" se confundem na prática; separar formal não rende

**B) Domain emite "evento de domínio" abstrato e adapter externo traduz pra BullMQ.** Padrão de "domain events" clean. Rejeitada:

- Adiciona camada de tradução pra problema que ainda nem dói
- BullMQ é estável; trocar provider de fila é trabalho que justifica refactor quando acontecer, não over-engineering preventivo
- Já temos abstração suficiente: schemas Zod definem contrato, `enqueueAgentTask` esconde detalhes de BullMQ

**C) Inverter dependência via callback/injection.** `shared-domain` exporta função que recebe `enqueueFn` como argumento, caller injeta de `shared-events`. Rejeitada:

- Toda call-site precisa importar `shared-events` e passar a função — empurra o problema sem resolver
- Testes ganham pouco (já dá pra mockar import); produção ganha nada
- Verbose sem benefício prático

**D) Status quo: `shared-domain` depende de `shared-events` mas sem regra escrita.** Rejeitada porque sem ADR isso vira fonte de discussão recorrente em PR review, e padrão informal sempre escorrega ("se shared-domain pode importar shared-events, por que não shared-llm? por que não shared-db?" — e shared-domain já importa shared-db, então a próxima pergunta é onde fica a linha).

## Consequências

**Positivas:**

- Lógica de domínio que precisa enfileirar fica num único lugar (`shared-domain`), reutilizável por web routes, webhooks, workers
- Sem package intermediário "shared-application" vazio
- Padrão consistente: qualquer função de domínio que tenha efeito colateral assíncrono mora aqui e declara isso na assinatura
- Triagem e Atendimento já seguem esse padrão; Sprints 1.2+ herdam direto

**Negativas:**

- Acoplamento real: mudança em schema de evento força rebuild de `shared-domain` e seus consumidores. Mitigação: schemas Zod versionados; mudança breaking precisa PR explícito mexendo nos dois packages
- Domínio menos "puro" em sentido acadêmico. Aceito conscientemente — pragmatismo vence pureza nesse projeto
- Risco de `shared-events` virar dump de helpers de aplicação. Mitigação: regra 3 acima (sem lógica de negócio em events)

**Restrições de manutenção:**

- ESLint não impede a dependência (ela é permitida). Não precisa regra nova de boundaries
- Code review deve sinalizar se alguém tentar colocar regra de negócio em `shared-events` (anti-pattern)
- Se algum dia a dependência for invertida (events começar a precisar de tipos de domain), é red flag — pausar e reabrir este ADR
- Nova função em `shared-domain` que publique evento deve seguir o padrão de `enqueueTriagem` / `appendMessage`: nome reflete efeito, JSDoc/comentário menciona evento publicado
