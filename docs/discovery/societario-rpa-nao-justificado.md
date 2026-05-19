# Societário — Por que ADR-021 (RPA Strategy) NÃO foi criado

> Sprint Fase 2.0-discovery, Tarefa 6a.
> Documenta a decisão consciente de NÃO produzir ADR-021 nesta fase.

## Pergunta original

O sprint prompt previa que, se a matriz da Tarefa 3 tivesse casos significativos (5+) de "Automatizar via portal web sem API", valeria abrir ADR-021 comparando estratégias de RPA (Playwright em container, serviços brasileiros como BotCity, abordagem híbrida).

## Distribuição real da matriz

Dos 45 itens da matriz `societario-matriz-decisao.md`:

- **Automatizar:** 14 itens (31,1%)
- **Assistir humano:** 24 itens (53,3%)
- **Fora de escopo:** 7 itens (15,6%)

Detalhamento dos 14 "Automatizar":

| Sub-categoria | Itens | Via |
|---|---|---|
| API oficial federal (Receita pós-Junta via DBE) | 7 | API/integração formal |
| API oficial geral (consulta CNPJ, ConectaJusbr) | 2 | API REST/HTTP |
| Operação interna (cálculo, calendário, geração de documento) | 4 | Sem portal externo |
| Polling read-only em portal público (status de processo na Junta) | 1 | HTTP simples, sem auth, sem captcha |

**Casos que exigem RPA real (portal web autenticado com cookie/session/captcha):** zero.

## Por que isso significa "RPA não se justifica na Fase 2"

RPA tem custo arquitetural relevante:

1. **Infraestrutura adicional** — containers Playwright com browser headless, ou serviço externo (BotCity etc).
2. **Manutenção em cada mudança de portal** — UX da Junta muda; selectors quebram; alertas + fix.
3. **Detecção e tratamento de captcha** — terceirizar serviço (R$ 50–500/mês) ou pivotar pra humano.
4. **Custo cognitivo** — toda nova obrigação no roadmap precisa decidir "tem API? tem RPA? tem só portal manual?".

Esse custo é justificável quando o ganho de automação compensa. Com 1 caso da matriz envolvendo polling público (HTTP sem auth, sem captcha — pode usar `fetch` direto sem browser), e nenhum caso de portal autenticado caindo em "Automatizar", o ganho não compensa.

## Quando reabrir esta decisão

Criar ADR-021 quando alguma das condições for satisfeita:

1. **Sócio reportar** que automação de portal autenticado específico (ex: protocolo automático em JUCESP via web) traz ganho operacional real. Pré-condição: medir tempo gasto hoje × volume × valor cobrado.
2. **Matriz da Fase 3+ (DP)** mostrar 5+ casos de "Automatizar via portal autenticado" — eSocial via portal web em casos onde a API lote não cobre, por exemplo.
3. **Tipo de cliente do escritório mudar** — se entrar em vertical onde Junta de UF específica é gargalo e o sócio confirma volume.
4. **Mudança de produto** — se a plataforma virar provedora de "abertura de empresa automática end-to-end", o cenário muda: aí RPA pra Junta vira gargalo de produto, não otimização.

## Alternativas leves (sem RPA) que cobrem o caso atual

Pra o único caso identificado (polling de status na Junta):

- **HTTP simples** com `fetch` e parsing de HTML público — funciona até a Junta mudar layout. Aceitável risco baixo.
- **Brasil API ou serviços terceiros** que indexam status de NIRE — terceiriza manutenção.
- **Webhook do próprio Redesim/DREI** se existir (verificar com sócio se ERP contábil que ele usa hoje já tem callback).

Nenhum desses exige ADR de RPA strategy.

## Conclusão

ADR-021 fica em "não criado" nesta fase. Esta decisão é **revisitável** — primeira vez que matriz futura ou input do sócio mostrar 5+ casos de portal autenticado justificando, abre.

Stack mantido na Fase 2: BullMQ + cron + HTTP simples (axios/undici/fetch) cobrem TODOS os casos de "Automatizar" da matriz atual. Playwright não entra.

## Vínculo

- `docs/discovery/societario-matriz-decisao.md` — matriz fonte da decisão
- Distribuição final: 14 Auto / 24 Assistir / 7 Fora — nenhum dos 14 Auto exige RPA
