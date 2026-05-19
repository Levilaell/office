# Societário — Resumo executivo da descoberta

> Sprint Fase 2.0-discovery. Documento pra Levi conversar com sócio.
> Outros documentos do sprint detalham cada ponto.

## O que descobri

- **15 obrigações societárias** mapeadas, cobrindo o que escritório de 4–15 pessoas vê na prática (alterações contratuais, abertura/baixa, MEI, encerramento, atualização cadastral, certificado).
- **20 portais governamentais** catalogados — federais, 6 Juntas Comerciais estaduais, 4 prefeituras maiores, certificadoras. Distinção crítica: **apenas 6 têm API REST oficial ou padrão (Receita pós-Junta via DBE, eSocial, NFS-e ABRASF, ConectaJusbr, consulta CNPJ, Integra Contador)**; resto é portal web autenticado.
- **Matriz de decisão** com 45 linhas (obrigação × portal):
  - 14 (31%) **Automatizar** — dominante: Receita pós-Junta + consultas read-only
  - 24 (53%) **Assistir humano** — dominante: Junta Comercial + Prefeitura + portais sem API
  - 7 (16%) **Fora de escopo** — transformação societária, distrato complexo, atos físicos do cliente
- **Padrão dominante: copiloto humano.** Plataforma prepara dossiê (minuta + checklist + certidões + DBE), humano protocola. Confirma o posicionamento "amplifica equipe, não substitui".

## Recomendação inicial pra Fase 2

**Foco primário:** 3 templates de partida no MVP — alteração de capital, atualização cadastral CNPJ, alteração de sede intramunicipal. Cobrem alta frequência e demonstram o padrão "Assistir humano" + "Automatizar Receita pós-Junta" no mesmo fluxo.

**Estratégia técnica (4 ADRs do sprint):**
- ADR-023: agentes em 4 papéis — Coordenador conversacional + **Orquestrador de processo** (novo, agente persistente acordado por eventos) + Especialistas (Documental, Operacional, Jurídico) + **Portal Adapters** (análogo ao ChannelAdapter).
- ADR-024: schema `legal_processes` + `process_steps` + extensões pontuais a `documents`/`obligations`. Reuso de audit_log, approvals existentes.
- ADR-022: **BullMQ + cron + state em tabela** como workflow engine inicial. Sem Temporal. Schema sobrevive migração futura — decisão revisitável ao fim da Fase 2.
- ADR-021 (RPA): **não justificado.** Único caso de automação via portal web é polling público sem auth. HTTP simples basta.

**Timing:** 5 sprints (2.1 → 2.5), 11 semanas, ~2.75 meses. 30% mais longo que estimativa original de 2 meses do `escopo-produto.md`. Justificativa: Orquestrador, workflow engine, Portal Adapters não existiam na Fase 1.

**Cobertura geográfica inicial: SP** (suposição — primeira Junta = JUCESP). Outras Juntas viram trabalho recorrente após validar o padrão.

## O que decidi sozinho (e que vocês podem mudar)

1. **Foco em 3 templates iniciais (alteração de capital, atualização CNPJ, alteração de sede).** Razão: cobrem alta frequência, dão sequência didática (simples → médio). Vocês podem trocar — perguntas A2 e D23 (cf. `societario-perguntas-socio.md`) definem ordem real.

2. **Primeiro estado/Junta = SP (JUCESP).** Razão: maior densidade econômica nacional, padrão "Via Rápida Empresa" relativamente estável. Vocês podem trocar se a base de clientes for majoritariamente outra UF.

3. **Receita pós-Junta marcada como "Automatizar" (7 linhas da matriz).** Razão: API/DBE existe, processo é mecânico, prazo legal de 30 dias é fonte clássica de multa. **Mas isso pressupõe que vocês confiariam em comunicação automática à Receita assim que NIRE deferir.** Pergunta E29 valida — se preferirem humano sempre antes da Receita, essas 7 linhas migram pra "Assistir humano".

4. **Tier de autonomia inicial: sugestivo em TODOS os agentes do Societário.** Razão: mais conservador que Atendimento (default sugestivo lá também), justificado pela natureza regulatória. Vocês podem afrouxar caso a caso após validar.

5. **Adoção de BullMQ + cron (sem Temporal).** Razão: templates iniciais simples, equipe pequena, schema sobrevive migração futura. Se vocês souberem de algum requisito real de workflow complexo (paralelismo, fan-out, saga) já na Fase 2, falar agora — afeta Sprint 2.2.

6. **Transformação societária, distrato com débitos pendentes, e ato presencial do cliente no eCAC = fora de escopo.** Razão: baixa frequência + alta complexidade jurídica. Vocês podem reabrir se for parte significativa do faturamento (pergunta E36).

## Onde preciso de você

Top 5 perguntas críticas (resto em `societario-perguntas-socio.md` — total 42):

1. **Quantas alterações contratuais o escritório protocola por mês? Qual tipo predomina?** (A1, A2) — dimensiona volume real e define ordem de templates.
2. **Em qual estado fica a maioria dos clientes? Qual Junta predomina?** (B9, B13) — define ordem de Portal Adapters.
3. **Vocês confiariam em comunicação automática à Receita pós-deferimento da Junta? Ou preferem humano antes?** (E29) — afeta 7 linhas da matriz; muda 16% das classificações se a resposta for "humano antes".
4. **Qual obrigação societária dá MAIS dor de cabeça operacional hoje?** (A6) — pode mudar o primeiro template do MVP.
5. **Qual obrigação seria perfeita se viesse "pronta pra um clique humano final"?** (D23) — confirma se "Assistir humano" da matriz tem aderência real.

Tempo estimado: **30–60 min de conversa estruturada com sócio.** Pode até ser via WhatsApp se ele não tiver tempo de sentar.

## Riscos que estou vendo

1. **Cobertura geográfica fragmentada.** Cada Junta Comercial é portal próprio. Implementar SP não cobre MG, RJ, SC, RS, PR. Volume de trabalho recorrente por nova UF é real. Atenuação: lista de adapters como roadmap explícito.

2. **Mudanças em portais governamentais.** Junta muda layout (já aconteceu — registros públicos relatam refactor JUCESP 2022, JUCERJA mais instável). Polling baseado em HTML quebra periodicamente. Atenuação: testes de regressão automáticos + alerta supervisor; mas é fonte de manutenção contínua.

3. **Especialista Jurídico (Opus 4.7) caro por turno.** Acionado raramente, mas se ativado em loop por algum bug, custo dispara rápido. Atenuação: budget hard cap e Supervisor que mata loops.

4. **Processo de longa duração testado em demo é desafio.** Encerramento real demora 30–180 dias — não dá pra demonstrar ponta a ponta em call comercial. Atenuação: modo demo com timestamps comprimidos (Sprint 2.5).

5. **Receita pós-Junta automática como assumi.** Se sócio rejeitar (E29), 7 linhas da matriz mudam de bucket. Implementação ainda é viável como "Assistir humano" mas perde valor relativo. Pergunta crítica.

6. **Sem input do sócio até agora.** Toda a matriz é palpite informado, não dado real. Sprint 2.1 não deve abrir sem pelo menos as 11 perguntas críticas respondidas — risco de codificar template errado.

## Próximo passo recomendado

**Agendar 1 sessão de 60 min com sócio pra responder pelo menos as 11 perguntas críticas listadas em `societario-perguntas-socio.md` (marcadas como "Críticas" no documento).** Itens A1, A2, A5, A6, B9, B13, C14, C17, D21, D23, E29.

Após essa sessão:
- Se respostas confirmam o desenho atual → abrir Sprint 2.1 (Fundações)
- Se respostas mudam ordem de templates ou estado primário → ajustar Sprint 2.1/2.2/2.3 com 1–2 dias de revisão antes de abrir
- Se respostas revelam algo grande que não foi mapeado (ex: 60% dos clientes em segmento que não cabe na matriz) → revisitar este sprint discovery antes de continuar

**Não abrir Sprint 2.1 sem essa conversa.** Risco de codificar template errado é maior que custo de adiar 1 semana.

---

## Anexos (documentos do sprint)

- `docs/discovery/societario-obrigacoes.md` — catálogo de 15 obrigações
- `docs/discovery/societario-portais.md` — mapeamento de 20 portais
- `docs/discovery/societario-matriz-decisao.md` — matriz de 45 linhas + padrões observados
- `docs/discovery/societario-perguntas-socio.md` — 42 perguntas estruturadas
- `docs/discovery/societario-sprints-plan.md` — 5 sprints da Fase 2 (11 semanas)
- `docs/discovery/societario-rpa-nao-justificado.md` — por que ADR-021 não foi criado
- `docs/adrs/022-workflow-engine.md` — BullMQ + cron na Fase 2
- `docs/adrs/023-topologia-agentes-societario.md` — Coordenador + Orquestrador + Especialistas + Adapters
- `docs/adrs/024-schema-legal-processes.md` — esboço de schema
