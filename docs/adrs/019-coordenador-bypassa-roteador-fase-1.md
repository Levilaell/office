# ADR-019: Coordenador de Atendimento subscreve `message.received` direto na Fase 1

Data: 2026-05-19
Status: aceito

## Contexto

ADR-016 estabeleceu arquitetura em 3 camadas: **Roteador global** → **Coordenadores de departamento** → **Especialistas**. A justificativa central foi "validar arquitetura de 3 camadas em produção desde a Fase 1 evita refactor traumático na Fase 2".

Na implementação do Sprint 1.2 (Coordenador de Atendimento), a decisão tomada em runtime foi diferente: o Coordenador subscreve `message.received` direto do bus, sem passar pelo Roteador global. Justificativa do executor: na Fase 1 só existe o departamento de Atendimento como destino, então o Roteador classificando "departamento = Atendimento" é redundância pura — adiciona latência (+1-2s) e custo (~USD 0.0008/mensagem) sem decisão real.

A divergência foi registrada como TD-019 e mantida. Este ADR formaliza a decisão (positiva ou negativa) e estabelece critério explícito de quando o bypass deixa de ser aceitável.

A questão é genuína: validar arquitetura cedo previne refactor caro; mas validar em condições artificiais (Roteador com 1 destino) pode dar falso sinal de robustez. Há trade-off real.

## Decisão

**Aceitar o bypass como estado válido da Fase 1**, com critério de reabertura explícito.

Na Fase 1, eventos `message.received` chegam ao Coordenador de Atendimento direto via subscriber Redis pub/sub. O Roteador global existe (Fase 0, classificando triagens internas), mas NÃO está no caminho de mensagens de cliente final entrando por canais externos.

**Critério de reabertura (qualquer um dos dois aciona):**

1. **Trigger funcional:** quando o segundo departamento começar a operar (Sprint da Fase 2 — Societário). Antes do primeiro agente real do Societário ir pra produção, o Roteador entra no caminho como pré-requisito.

2. **Trigger de complexidade:** se aparecer necessidade de roteamento heurístico em Atendimento (ex: certas palavras-chave devem pular o Coordenador e ir direto pra humano, ou regra de "fora de horário comercial → resposta automática sem agente"), o Roteador entra antes da Fase 2.

Quando o critério for acionado, refactor segue um padrão estabelecido (descrito em "Consequências" abaixo).

## Alternativas consideradas

**A) Forçar Roteador no caminho desde a Fase 1, como manda ADR-016 originalmente.** Vantagem: arquitetura validada em produção desde já, refactor zero na Fase 2. Rejeitada porque:
- Validação seria parcialmente artificial — Roteador com 1 destino real testa pipeline mas não testa decisão de roteamento de verdade
- Latência extra de 1-2s em produção pra validar caminho de código sem valor de negócio na Fase 1 é trade-off ruim
- Custo extra (~USD 0.0008 por mensagem) acumula mensalmente em volume, sem ganho proporcional
- Refactor da Fase 2 não é traumático se o padrão for documentado (e este ADR documenta)

**B) Remover Roteador global completamente, manter só Coordenadores por departamento.** Rejeitada porque:
- Quando segundo departamento entrar, sem Roteador, mensagem de cliente teria que ser endereçada explicitamente — quem faz isso? Cliente final não sabe diferenciar Atendimento de Societário
- Roteador existe pra absorver ambiguidade de input humano; remover é jogar fora a camada que justamente trata o caso real
- Quebra ADR-016 estruturalmente, não só na Fase 1

**C) Bypass aceito sem ADR, só TD.** Rejeitada porque:
- TD descreve dívida; ADR registra decisão. São coisas diferentes.
- Sem ADR, próximo desenvolvedor (humano ou IA) que ler o código e cruzar com ADR-016 vai questionar legitimamente. Decisão fica frouxa.
- Você (Levi) explicitamente delegou revisão arquitetural ao processo — sem ADR, o critério de reabertura fica implícito.

## Consequências

**Positivas:**
- Fase 1 opera com latência e custo otimizados (sem hop redundante)
- Pipeline de Atendimento valida 2 das 3 camadas do ADR-016: Coordenador (Sprint 1.2) → Especialistas (Sprint 1.3-1.4). Padrão de orquestração entre camadas adjacentes está exercitado.
- Trigger de reabertura é objetivo (segundo departamento entra = Roteador entra). Não depende de julgamento subjetivo.

**Negativas:**
- Camada Roteador não é exercitada em produção com tráfego real de clientes finais até a Fase 2. Risco de descobrir só lá problemas de design (ex: classificação de departamento ambígua, latência inaceitável).
- Padrão de "bypass quando há único destino" pode virar tentação em outros lugares da plataforma. Mitigação: este ADR estabelece que bypass é exceção justificada por contagem de destinos = 1, não preferência geral por "simplicidade".

**Restrições de implementação:**

- O subscriber atual do Coordenador (`apps/agent-runtime/src/workers/atendimento-coordenador.ts`) escuta `message.received` direto. NÃO refatorar pra escutar `message.routed` enquanto este ADR estiver `aceito`.
- Quando o critério de reabertura for acionado, o refactor segue este padrão:
  1. Roteador (Fase 0) ganha novo destino no enum (Societário, Pessoal, etc) — prompt do Roteador atualizado, bateria de eval expandida
  2. Roteador publica `message.routed` com `destination_department` em vez de só `triage.classified`
  3. Coordenadores (incluindo o de Atendimento) trocam subscription de `message.received` pra `message.routed` filtrado por `destination_department == '<seu_departamento>'`
  4. Mudança é coordenada, não incremental — todos os coordenadores migram no mesmo sprint pra evitar estado inconsistente (alguns escutando `message.received`, outros `message.routed`)
- Este ADR é superseded automaticamente quando o trigger de reabertura for acionado. Status passa pra `superseded` e um ADR novo (provavelmente ADR-0XX da Fase 2) documenta a nova topologia.

**Critério de monitoramento na Fase 1:**

- Latência de Coordenador (do `message.received` até `coordenador.classified` no audit_log) deve ficar abaixo de 4s p50. Se subir acima disso por causa de Coordenador crescendo (prompt mais longo, mais tools), reavaliar — mas neste caso a solução é otimizar Coordenador, não meter Roteador no meio.
- Custo de Coordenador por mensagem (Sonnet 4) é métrica de produto. Se ultrapassar limites do ADR-008 (LLM tier abstraction) e cascade Haiku→Sonnet virar necessidade, reabrir este ADR também — porque cascade implica decisão de routing antes do Coordenador.
