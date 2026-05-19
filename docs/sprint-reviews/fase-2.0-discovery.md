# Sprint Fase 2.0-discovery — Self-review

Data de execução: 2026-05-19
Branch: `main` (commits diretos — sprint discovery sem PR conforme política `.claude/rules/pr-policy.md`)
Sprint anterior: Sprint Fase 2-prep (TDs prioritários + suite RLS + Roteador no caminho)
Próximo: Sprint Fase 2.1 (Fundações Societário) — **bloqueado por conversa com sócio**, ver Tarefa 7

## Documentos gerados

Todos novos. Zero arquivo de código tocado (sprint é discovery puro).

- `docs/discovery/societario-obrigacoes.md` — 15 obrigações catalogadas
- `docs/discovery/societario-portais.md` — 20 portais mapeados
- `docs/discovery/societario-matriz-decisao.md` — 45 linhas obrigação × portal
- `docs/adrs/023-topologia-agentes-societario.md` — topologia híbrida
- `docs/adrs/024-schema-legal-processes.md` — schema esboçado
- `docs/adrs/022-workflow-engine.md` — BullMQ + cron na Fase 2
- `docs/discovery/societario-rpa-nao-justificado.md` — análise de não justificação ADR-021
- `docs/discovery/societario-perguntas-socio.md` — 42 perguntas categorizadas
- `docs/discovery/societario-sprints-plan.md` — 5 sprints, 11 semanas
- `docs/discovery/societario-resumo-executivo.md` — 2 páginas pra Levi → sócio
- `docs/adrs/README.md` — atualizado com 022/023/024 + nota sobre 020-021

## Hashes em main

```
8344e71 (HEAD pré-sprint — obs do coordenador)
↓
278a73c docs(discovery): catálogo de obrigações societárias                    (Tarefa 1)
7a927d3 docs(discovery): mapeamento de portais governamentais                  (Tarefa 2)
95edad6 docs(discovery): matriz de decisão automatizar/assistir/fora-escopo    (Tarefa 3)
abd6d12 docs(adr): ADR-023 topologia de agentes do Societário                  (Tarefa 4)
9908eb6 docs(adr): ADR-024 esboço de schema de processos legais                (Tarefa 5)
e3f47fb docs(adr): ADR-022 workflow engine + análise de não-justificação 021   (Tarefa 6)
99b07ab docs(discovery): perguntas pro sócio sobre Societário                  (Tarefa 7)
192fe2e docs(discovery): plano de sprints da Fase 2                            (Tarefa 8)
06510c3 docs(discovery): resumo executivo do Societário                        (Tarefa 9)
↓
(self-review + push pendentes)
```

## Distribuição final da matriz

| Bucket | Linhas | % |
|---|---|---|
| Automatizar | 14 | 31,1% |
| Assistir humano | 24 | 53,3% |
| Fora de escopo | 7 | 15,6% |
| **Total** | **45** | **100%** |

**Stop rule do sprint (>60% "Fora de escopo") NÃO disparou** (15,6%, longe do limite).

**Padrão dominante confirmado:** copiloto humano. Alinhado ao posicionamento da plataforma.

## ADRs criados

| ADR | Status | Decisão |
|---|---|---|
| ADR-022 | aceito (revisitar fim Fase 2) | BullMQ + cron + state em tabela como workflow engine inicial |
| ADR-023 | aceito (condicional — pré-Sprint 2.1) | Topologia híbrida: Coordenador + Orquestrador + Especialistas + Portal Adapters |
| ADR-024 | aceito (conceitual — migração na Sprint 2.1) | `legal_processes` + `process_steps` + extensões pontuais |
| ADR-021 | **não criado** | RPA não justificado — único caso de portal sem API é polling público sem auth |

ADR-020 fica como gap intencional na numeração — sem decisão arquitetural a registrar entre 019 e 022.

## Padrões observados

1. **Junta Comercial cai consistentemente em "Assistir humano"** — sem API geral, fragmentação por UF, cert. dos sócios na assinatura impede automação total.
2. **Receita Federal pós-Junta é o "doce"** — DBE existe, processo mecânico, prazo legal 30 dias = multa clássica. Primeiro candidato real a automação.
3. **Read-only é fácil** — consultas (CNPJ, ConectaJusbr, status Junta) são API ou web público estável.
4. **Prefeituras e Sefaz estaduais são fragmentadas** — começar por SP, expandir conforme demanda.
5. **MEI tem fluxo próprio (Portal Empreendedor)** — Captcha humano impede automação total; processo simples basta "Assistir humano".
6. **Certidões negativas são pré-flight universal** — quase toda obrigação grande exige; agente que pré-flighta evita retrabalho.
7. **Geração de documento é IA pura** — minutas, dossiês, petições. Sem portal externo. Núcleo do valor "Assistir humano".
8. **Procuração eletrônica é gargalo cross-departamento** — pré-condição pra Atendimento, Societário, DP, Fiscal.
9. **"Fora de escopo" concentra em transformação societária, distrato com débitos pendentes, eCAC do cliente** — combinação baixa frequência + alta complexidade jurídica.
10. **Calendário de obrigações é determinístico** — não precisa IA pra disparar alerta.

## Decisões tomadas sozinho (com baixa confiança ou dependência do sócio)

Capturadas explicitamente no resumo executivo (`societario-resumo-executivo.md` §"O que decidi sozinho"). Resumo:

| Decisão | Razão | Gatilho de revisão |
|---|---|---|
| 3 templates iniciais: alteração de capital, atualização CNPJ, alteração de sede | Cobrem alta frequência, sequência didática | Pergunta A2, D23 do sócio |
| Primeiro estado/Junta = SP (JUCESP) | Densidade econômica nacional | Pergunta B9, B13 |
| Receita pós-Junta como "Automatizar" (7 linhas) | DBE existe, prazo legal = multa | Pergunta E29 — pode mudar 16% da matriz |
| Tier inicial: sugestivo em TODOS os agentes Societário | Mais conservador que Atendimento, natureza regulatória | Validar com sócio (D21) |
| BullMQ + cron, sem Temporal | Templates simples, equipe pequena, migração futura barata | Métricas fim Fase 2 (ADR-022) |
| Transformação societária + distrato complexo + eCAC físico = fora de escopo | Frequência baixa + complexidade jurídica | Pergunta E36 |

Linhas com "Confiança: Média" na matriz (17 linhas) entraram como perguntas na Tarefa 7 (Bloco E). Linhas com "Confiança: Baixa" foram **zero** — critério adotado foi marcar Baixa apenas quando classificação depende de dado concreto do sócio; tudo classificável por critério objetivo público virou Alta ou Média.

## Riscos críticos pra Fase 2

1. **Sem input do sócio até agora.** Toda a matriz é palpite informado. Sprint 2.1 não deve abrir sem as 11 perguntas críticas respondidas.
2. **Cobertura geográfica fragmentada.** Cada Junta = portal próprio. Implementar SP não cobre MG/RJ/SC/RS/PR. Trabalho recorrente.
3. **Mudanças em portais governamentais.** Layout muda, parsers quebram. Fonte de manutenção contínua.
4. **Especialista Jurídico (Opus 4.7) caro por turno.** Loop = custo dispara. Mitigação: budget cap + Supervisor.
5. **Demo de processo longa duração é desafio.** Encerramento real = 30–180 dias. Mitigação: timestamps comprimidos.
6. **Receita pós-Junta automática é suposição.** Pergunta E29 valida — se sócio rejeitar, 7 linhas migram.

## Sugestão pra próximo passo

**Agendar 1 sessão de 60 min com sócio pra responder as 11 perguntas críticas listadas no resumo executivo.**

11 perguntas críticas (de `societario-perguntas-socio.md`):
- A1, A2, A5, A6 — volume real + dor primária
- B9, B13 — geografia / Junta principal
- C14, C17 — cert. digital + ERP atual
- D21, D23 — fronteira de produto (NÃO confiaria / clique humano final)
- E29 — Receita pós-Junta automática (afeta 16% da matriz)

Após sessão:
- Respostas confirmam desenho → abrir Sprint 2.1 sem mudanças
- Respostas mudam priorização → revisar 2.1/2.2 (1-2 dias) antes de abrir
- Respostas revelam gap grande → revisitar este sprint discovery antes

**Não abrir Sprint 2.1 sem essa conversa.** Risco de template errado supera custo de adiar 1 semana.

## Surpresas e aprendizados

1. **Receita pós-Junta tem `category='societaria'` em obligations já hoje.** Schema da Fase 1 (TD-030 cobre catalogação) já reservou espaço; reuso é trivial. Reduz fricção de migração na Sprint 2.1.

2. **Matriz se classificou predominantemente em "Assistir humano" sem que eu forçasse.** Distribuição emergiu naturalmente da combinação "portal sem API + sensibilidade regulatória". Confirma posicionamento "amplifica equipe humana" não como floreio de marketing mas como decisão arquitetural validada pelos dados públicos.

3. **Brasileiro de contabilidade tem fragmentação geográfica brutal.** Não dá pra ter "API da Junta Comercial" — cada estado é mundo próprio. Implica que toda nova UF é trabalho real, e que pricing do produto Societário pode ser função de "estados que vocês operam" (decisão comercial futura).

4. **Orquestrador como agente novo não tem análogo na Fase 1.** Coordenador de Atendimento é turn-a-turn (responde rápido). Orquestrador é "agente acordado por evento" — dorme dias, acorda, decide próximo passo. Custo de LLM controlado naturalmente; semântica diferente exige documentação cuidadosa pra equipe entender.

5. **BullMQ + cron resolve workflow de longa duração sem Temporal.** Reli `escopo-produto.md` que reservava Temporal pra Fase 2+ e percebi que o "+" pode ser Fase 2 inteira sem custo de adiar. Conservador, revisitável, schema sobrevive migração.

6. **Não fui forçado a inventar números do sócio.** Marquei `[estimativa]` consistentemente. Perguntas pro sócio cobrem os gaps. Honestidade epistêmica preservada.

## Sprint não tocou código

Sprint discovery não tem `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build` próprios. Última validação do ambiente foi o Sprint Fase 2-prep (commit `ca89070`). Estado atual do repo em main: limpo até este sprint (apenas adições de docs).

Vou rodar validação básica antes do push final pra confirmar que nada quebrou por contaminação acidental (improvável mas barato verificar).

## Conclusão

Sprint Fase 2.0-discovery entrega 10 documentos novos (8 discovery + 3 ADRs novos + 1 doc de não-justificação + atualização do README) em 9 commits sequenciais. Matriz de decisão (45 linhas) é o eixo central; resumo executivo (2 páginas) é o output principal pra Levi → sócio.

Conclusão de produto: Societário tem espaço claro como **departamento copiloto** — 53% das combinações são "Assistir humano", 31% "Automatizar" (predominantemente Receita pós-Junta e consultas read-only), 16% "Fora de escopo". Alinhado ao posicionamento da plataforma.

Conclusão arquitetural: topologia híbrida com Orquestrador novo + Portal Adapters + workflow engine BullMQ + schema esboçado. 3 ADRs aceitos, 1 não justificado, 5 sprints planejados em 11 semanas.

Próximo passo: **agendar conversa de 60 min com sócio** antes de abrir Sprint 2.1.
