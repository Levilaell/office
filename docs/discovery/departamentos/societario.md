# Departamento Societário — Mapa resumido (padronizado pra comparativo)

> Sprint Mapa de Departamentos, Tarefa 5a.
> Documento padronizado igual aos outros. **Não substitui** a discovery profunda
> em `docs/discovery/societario-*` — extrai e adapta na linguagem padrão.
> Fonte primária: `docs/discovery/societario-resumo-executivo.md`.

## (a) O que esse departamento faz no dia a dia

### Constituição
1. **Abertura de empresa** — viabilidade municipal, DBE, contrato social, registro na Junta, CNPJ, IE estadual, CCM municipal, alvará
2. **Formalização MEI** — Portal do Empreendedor, gera CCMEI
3. **Abertura de filial** — averbação na Junta da matriz + registro na Junta destino + CNPJ filial + alvará destino

### Alterações contratuais (núcleo do dia a dia)
4. **Alteração de capital social** — protocolo na Junta + atualização Receita pós-deferimento
5. **Alteração de sócios** (entrada, saída, cessão, sucessão) — Junta + Receita + DARF de ganho de capital quando aplicável
6. **Alteração de sede** — intra-municipal ou interestadual (afeta IE, CCM)
7. **Alteração de CNAE** — análise prévia de impacto tributário + Junta + Receita + Sefaz/Prefeitura

### Atualização cadastral
8. **Atualização cadastral CNPJ** (via DBE) — quando dados na Receita estão desatualizados
9. **Procuração eletrônica eCAC** — ato do próprio cliente; escritório só orienta

### Certificado digital
10. **Orientação e renovação de certificado digital** — comparativo, agendamento, monitoramento de vencimento

### Encerramento
11. **Distrato / encerramento** — CNDs, distrato na Junta, baixa CNPJ na Receita, encerramento de obrigações em DP, Fiscal, estadual e municipal
12. **Baixa de filial** — Junta, Receita, Sefaz/Prefeitura

### Eventos esporádicos complexos
13. **Transformação societária** (LTDA ↔ SA, EIRELI → LTDA) — baixa frequência, alta complexidade
14. **MEI — alteração e desenquadramento** — Portal do Empreendedor + às vezes abertura de ME em paralelo

### Monitoramento e suporte
15. Acompanhamento de prazos e status (consulta CNPJ, consulta NIRE, ConectaJusbr pra passivos)

**Total: 15 obrigações.** Detalhe completo em `docs/discovery/societario-obrigacoes.md`.

## (b) Por que dói pro escritório

**Cada obrigação é um percurso multi-portal.** Abertura passa por Redesim (viabilidade + DBE) → Junta Comercial → Receita Federal → Prefeitura (CCM) → Sefaz (IE). Cada portal tem auth própria, requer cert. digital, e cada estado/município tem peculiaridade. Equipe se perde no fluxo.

**Junta Comercial é heterogênea por UF.** SP, RJ, MG, RS, SC, PR — cada uma com portal próprio, layout próprio, estabilidade própria. JUCESP relativamente padrão; outras instáveis. Não há "API da Junta Comercial" — cada estado é mundo próprio.

**Prazo na Receita pós-Junta gera multa.** 30 dias pra comunicar atualização à Receita após deferimento da Junta. Equipe esquece, cliente paga multa. Calendário no caos.

**Certificado digital é gargalo cross-departamento.** Toda obrigação grande exige cert. A1 ou A3 dos sócios. Renovação anual é fonte de incidente — vencimento esquecido trava processo em andamento.

**Cliente "sumido" trava processo.** Coletar assinatura digital do sócio exige presença do cliente. Cliente desaparece por semanas — processo fica em standby. Escritório não cobra paralelo (depende do cliente).

**Captcha humano e 2FA SMS.** Portal do Empreendedor (MEI), eCAC, alguns portais Sefaz exigem captcha em cada login. Inviabiliza automação total — humano sempre presente. Detalhe em `docs/discovery/societario-portais.md`.

## (c) O que dá pra automatizar (matriz resumida — 45 linhas no detalhe)

Matriz completa em `docs/discovery/societario-matriz-decisao.md`. Distribuição final:

| Bucket | Linhas | % |
|---|---|---|
| **Automatizar** | 14 | 31% |
| **Assistir humano** | 24 | 53% |
| **Fora de escopo** | 7 | 16% |

**% Automatizável** = 31% + 26.5% = **57.5%**.

Padrões dominantes (vide `societario-matriz-decisao.md` para tabela completa):

| Padrão | Bucket | Razão |
|---|---|---|
| **Junta Comercial — qualquer ato** | Assistir humano | Sem API geral, varia por UF, cert. dos sócios na assinatura |
| **Receita Federal pós-Junta (DBE)** | Automatizar | API existe, processo mecânico, prazo legal 30 dias = multa |
| **Consultas públicas (CNPJ, NIRE, ConectaJusbr)** | Automatizar | Read-only, API/web público estável |
| **Prefeitura (CCM, alvará)** | Assistir humano | Portal próprio por município, sem API uniforme |
| **Sefaz estadual (IE)** | Assistir humano | Portal autenticado por UF, cert. dos sócios |
| **MEI (Portal do Empreendedor)** | Assistir humano | Captcha frequente, dados pessoais |
| **eCAC (procuração eletrônica)** | Fora de escopo (ato do cliente) | Ato do próprio cliente com cert. dele |
| **Geração de minuta/dossiê/petição** | Automatizar (interno) | Sem portal externo, IA pura, núcleo do valor "Assistir humano" |
| **Calendário de obrigações** | Automatizar (interno) | Determinístico, sem IA |
| **Transformação societária / distrato complexo** | Fora de escopo | Baixa frequência + alta complexidade jurídica |

## (d) O que NÃO dá pra automatizar e por quê

1. **Assinatura digital pelo sócio** — ato do cliente com cert. dele.
2. **Captcha humano em MEI e eCAC** — gargalo intransponível.
3. **Atos físicos em Junta/Prefeitura** quando exigidos (alguns ainda exigem entrega presencial).
4. **Negociação jurídica complexa em transformação societária** — advogado humano.
5. **Validação biométrica em emissão de certificado digital** — presencial obrigatório.
6. **Acordo de cessão de quotas com cláusulas atípicas** — exige advogado tributarista e societário.
7. **Recurso contra indeferimento na Junta** — peça jurídica formal.

## (e) Como esse departamento conversa com os outros

- **Atendimento** recebe pedido do cliente ("preciso alterar capital") → handoff pro Societário (Coordenador Societário, Fase 2.1)
- **Societário** processa alteração de CNAE → consulta **Fiscal** pra avaliar impacto tributário (pode desenquadrar do Simples)
- **Societário** processa admissão de sócio → **Pessoal** define vínculo (CLT, pró-labore, cotista)
- **Societário** processa encerramento → **Pessoal** apura rescisão de funcionários + **Fiscal** encerra obrigações + **Contábil** fecha competência
- **Societário** processa abertura de empresa → **Financeiro Interno** cadastra cliente novo no fluxo de faturamento

Esboço de fluxo (alteração de capital):

```
Cliente envia mensagem: "quero aumentar capital de R$ 100k pra R$ 500k"
  → Atendimento recebe e classifica (Roteador → societario)
  → Coordenador Societário classifica intent (iniciar_processo)
  → Especialista Documental redige minuta
  → Orquestrador abre processo legal_processes + process_steps
  → Coleta assinaturas (notifica cliente via Atendimento)
  → Protocola na Junta (humano — sugestivo)
  → Aguarda deferimento (polling read-only do NIRE)
  → Confirma deferimento
  → Atualiza Receita via DBE pós-Junta (automático após confiança)
  → Notifica cliente: "concluído"
```

## (f) Como o agente desse departamento se encaixaria

Decisões já registradas em ADRs (sprint discovery anterior):

- **Topologia (ADR-023):** Coordenador conversacional (turn-a-turn) + **Orquestrador** (agente persistente acordado por evento — processo de longa duração) + Especialistas (Documental, Operacional, Jurídico) + Portal Adapters.
- **Workflow engine (ADR-022):** BullMQ + cron + state em tabela. Sem Temporal. Revisitável no fim da Fase 2.
- **Schema (ADR-024):** tabelas `legal_processes` + `process_steps` + extensões a `documents`/`obligations`.
- **RPA (ADR-021 não criado):** único caso de portal sem API é polling público da Junta — HTTP simples basta.
- **Tier inicial:** sugestivo em **todos os agentes**. Mais conservador que Atendimento, justificado pela natureza regulatória.

**Volume típico:** **baixo**. Cada cliente do escritório tem 1-2 atos societários por ano [estimativa]; escritório com 30-100 clientes = **30-200 processos/ano**, distribuídos no tempo. **Processos individuais são longos** (5 a 180 dias) — agente fica acordando por cron pra dar continuidade.

**Chamadas LLM por operação:** **baixas em rotina, médias em exceção** (interpretação de cláusula, análise de impacto tributário). Estimativa: **2-10 LLM por processo simples, 10-30 por processo complexo** [estimativa].

**Risco regulatório:** **médio-alto**. Erro em ato societário pode invalidar registro, expor sócios, gerar nulidade do ato. Mas o caminho "Assistir humano" protege — humano sempre protocola.

## (g) Tamanho do impacto comercial

[estimativas baseadas em material público; perguntas no `societario-perguntas-socio.md`]

- **Tempo do escritório consumido por Societário**: **5-15% do tempo total** [estimativa]. Esporádico mas demorado por processo.
- **% da receita vinda de Societário**: **5-15% do faturamento** [estimativa]. Tipicamente cobrado por ato (R$ 800-R$ 5.000 conforme complexidade).
- **Dias "pegando fogo"**: distribuído (não há prazo mensal cíclico). Prazo de 30 dias pós-Junta na Receita é cíclico em escala individual.
- **Sensibilidade a erro**: alta — ato societário errado é juridicamente nulo, exige refazer, expõe sócios.
- **Diferencial competitivo**: escritórios que entregam Societário **rápido e completo** ganham clientes. Tempo médio de abertura no Brasil é semanas; quem entrega em dias se destaca.

### Estimativa de implementação (do plano de sprints Fase 2)

5 sprints × 2-3 semanas ≈ **11 semanas = ~2.75 meses**. Cobertura inicial: 3 templates (alteração de capital, atualização CNPJ, alteração de sede) + Receita pós-Junta + JUCESP. Outros templates e Juntas são trabalho recorrente posterior.

**Plano detalhado:** `docs/discovery/societario-sprints-plan.md`.

**Bloqueio atual:** Sprint 2.1 não deve abrir sem o sócio responder pelo menos as 11 perguntas críticas (`docs/discovery/societario-perguntas-socio.md`).

---

## Síntese (pra alimentar o mapa comparativo)

- Volume: **Baixo** (esporádico, 1-2 por cliente/ano)
- Dor escritório: **Média** (incomoda quando entra, mas não consome equipe diariamente)
- Risco regulatório: **Médio-Alto** (ato societário nulo é grave, mas humano sempre protocola)
- % Automatizável: **57.5%** (dominante "Assistir humano")
- Complexidade técnica: **Alta** (Orquestrador novo + Portal Adapters + workflow engine + schema dedicado)
- Tempo de implementação: **11 semanas ≈ 2.75 meses, 5 sprints** [estimativa do plano]
- Risco de venda: **Médio-Baixo** — escritório terceriza muito hoje, paga por isso, valoriza rapidez
- **Bloqueio crítico:** conversa de 60 min com sócio sobre 11 perguntas críticas antes de abrir Sprint 2.1
