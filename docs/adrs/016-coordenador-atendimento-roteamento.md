# ADR-016: Coordenador de Atendimento como camada de roteamento de departamento

Data: 2026-05-18
Status: aceito

## Contexto

A Fase 0 estabeleceu (ADR-010) orquestração em 3 camadas: **Roteador global** → **Coordenadores de departamento** → **Especialistas**. O Roteador atual roda como "hello world" classificando mensagens em categorias amplas.

A Fase 1 introduz o primeiro coordenador real: o **Coordenador de Atendimento**. Surgem perguntas estruturais:

1. O Roteador global classifica em "departamento de destino"? Ou em "intent operacional vs comercial"?
2. O Coordenador de Atendimento recebe input já roteado, ou ele próprio classifica do zero?
3. Em que momento o Roteador global é necessário, dado que na Fase 1 só existe Atendimento como destino?
4. Como cada nova fase (Societário, Pessoal etc) introduz coordenadores sem reescrever o Roteador?

## Decisão

**Separação clara de responsabilidades:**

**Roteador global:**
- Classifica mensagem nova em **departamento de destino** (Atendimento, Societário, Pessoal, Contábil, Fiscal, Financeiro Interno) ou **plataforma** (cobrança da Levi Lael, configuração, suporte interno)
- Modelo: Haiku 4.5 (classificação rasa, alta vazão, baixo custo)
- Output: evento `message.routed` com `destination_department` + confidence + reasoning
- **NÃO** classifica intent fino. Não conhece taxonomia de departamento.

**Coordenador de Atendimento (e futuros coordenadores):**
- Subscreve eventos `message.routed` filtrados por `destination_department == 'atendimento'`
- Classifica **intent fino dentro do departamento** (operacional.status_obrigacao, comercial.lead_novo, etc)
- Decide se responde direto (intents sociais simples), delega especialista, ou escala humano
- Modelo: Sonnet 4 (julgamento contextual, não classificação rasa)
- Mantém contexto da conversa (últimas N mensagens da `conversations`)
- Output: handoff pra especialista via evento, OU draft de resposta direta, OU escalação humana

**Na Fase 1, com Atendimento como único departamento:**
- Roteador global continua existindo e operando
- Toda mensagem passa Roteador → Coordenador, sequencialmente
- Custo extra de Roteador na Fase 1 é aceito (Haiku, ~USD 0.0008/run)
- Razão: validar arquitetura de 3 camadas em produção desde a Fase 1 evita refactor traumático na Fase 2 quando segundo coordenador entrar

**Adicionar departamento novo na Fase 2+:**
- Cria novo coordenador, registra como subscriber do bus de eventos
- Roteador global ganha mais um destino no enum (atualizar prompt + eval battery)
- Zero mudança no Coordenador de Atendimento ou em qualquer agente existente

## Alternativas consideradas

**A) Pular Roteador global na Fase 1, conectar webhook direto no Coordenador:** mais barato e simples agora. Rejeitada porque introduz mudança estrutural na Fase 2 que afeta produção. Validar arquitetura de roteamento global cedo é seguro.

**B) Roteador global classifica intent fino também:** elimina uma camada, mas força Roteador a conhecer taxonomia de todos os departamentos. Vira deus-objeto. Prompts gigantes, eval explosiva, mudança em qualquer departamento toca o Roteador. Rejeitada.

**C) Coordenador classifica do zero, sem Roteador:** funciona com um departamento. Quebra quando há 6 — toda mensagem passaria por todos os coordenadores simultaneamente (broadcast caro) ou um coordenador "supercoordenador" emergiria (recriando o Roteador). Rejeitada.

**D) Roteador determinístico (regras, sem LLM):** algumas regras óbvias podem ser determinísticas (palavra-chave clara), mas maioria das mensagens humanas precisa interpretação. Tentar regras puras vira árvore de decisão frágil. Pode complementar (fast-path determinístico) mas não substituir. Aceito como otimização futura, não bloqueia Fase 1.

## Consequências

**Positivas:**
- Adicionar departamento na Fase 2+ é incremento, não mudança
- Cada coordenador é responsável por sua própria taxonomia de intent — equipes diferentes podem evoluir prompts independentemente
- Roteador global pode evoluir pra fast-path determinístico depois sem afetar coordenadores
- Custo por mensagem distribuído entre dois modelos (Haiku + Sonnet), permitindo otimização local

**Negativas:**
- Latência adicional: duas chamadas LLM em sequência antes de qualquer resposta. Estimativa: +1-2s vs arquitetura de uma camada. Aceito porque cliente final espera 3-5s em chat de atendimento mesmo com humano.
- Custo adicional: ~USD 0.0008 por mensagem (Roteador), além do Coordenador. ~10x volume vs custo crítico, ainda baixo.
- Duas etapas = duas oportunidades de erro. Eval precisa cobrir as duas em conjunto, não isoladamente.

**Restrições de implementação:**
- Roteador NUNCA chama Coordenador diretamente. Comunicação via bus de eventos (BullMQ), assíncrona, com trace_id propagado.
- Coordenador roda em **toda mensagem inbound**, mesmo se conversa já tem intent. Intent pode mudar no meio da conversa. Otimização (não reclassificar se intent estável por N turnos) é refinamento futuro.
- Roteador e Coordenador compartilham o mesmo `conversations.intent_current` apenas pra UI — internamente operam independentes.
