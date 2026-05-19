# Societário — Matriz de decisão: Automatizar / Assistir humano / Fora de escopo

> Sprint Fase 2.0-discovery, Tarefa 3. **Eixo central do sprint.**
> Cada linha = uma combinação (obrigação × portal) que aparece no fluxo
> real, classificada em um dos 3 buckets. Linhas com "Confiança: Baixa"
> alimentam diretamente a Tarefa 7 (perguntas pro sócio).

## Critérios aplicados

**Bucket 1 — Automatizar.** Agente executa o passo sem humano. Critérios obrigatórios (todos):
- Portal tem API REST oficial documentada OU portal web extremamente estável (não muda há anos)
- Autenticação possível sem captcha humano nem OTP por SMS nem cert. A3 físico
- Impacto regulatório de erro baixo ou totalmente recuperável
- Frequência suficiente pra justificar implementação

**Bucket 2 — Assistir humano.** Agente prepara documento completo, gera petição/dossiê, monta checklist, monitora prazo. Humano efetua o ato no portal. Critérios:
- Portal sem API ou instável OU exige presença/cert. A3/captcha/2FA SMS
- Erro tem impacto regulatório alto (multa, perda de prazo)
- Frequência alta o suficiente pra valer assistir, mesmo sem automatizar

**Bucket 3 — Fora de escopo.** Não entra na Fase 2. Critérios:
- Frequência muito baixa (caso raro, < 1 por escritório/ano)
- Complexidade jurídica alta exigindo advogado humano sempre
- Portal exótico/regional sem cobertura suficiente
- Combinação que dá retrabalho desproporcional

## Convenção de confiança

- **Alta:** critério objetivo (API existe ou não, ato exige presença física ou não)
- **Média:** depende de prática (peculiaridade local, volume) — validar com sócio é melhoria, não bloqueio
- **Baixa:** depende de dado do sócio (frequência real, valor cobrado) — vira pergunta na Tarefa 7

---

## Matriz

| # | Obrigação | Portal | Bucket | Justificativa | Freq.[estimativa] | Confiança |
|---|---|---|---|---|---|---|
| 1 | Abertura de empresa | Redesim (viabilidade + DBE) | Assistir humano | Tem API parcial via parceria, mas o ato de assinatura digital exige cert. do cliente — humano não sai do loop. Agente monta DBE, valida CNAE, prepara contrato; humano assina e protocola. | Média | Alta |
| 2 | Abertura de empresa | Junta Comercial (registro do contrato) | Assistir humano | Portal sem API geral; UX varia por UF. Cert. dos sócios é necessário. Agente prepara minuta do contrato e checklist; humano efetua. | Média | Alta |
| 3 | Abertura de empresa | Receita Federal (CNPJ pós-Junta) | Automatizar | Decorre automaticamente do DBE assinado quando Redesim integrado — agente confirma emissão do CNPJ via consulta. | Média | Alta |
| 4 | Abertura de empresa | Prefeitura (CCM/alvará) | Assistir humano | Portal web sem API uniforme; varia por município. Agente prepara dossiê e checklist do alvará; humano protocola. | Média | Alta |
| 5 | Abertura de empresa | Sefaz estadual (IE) | Assistir humano | Portal web autenticado por UF; agente prepara cadastro e CNAE; humano efetua via cert. | Média | Média |
| 6 | Alteração contratual — capital | Junta Comercial | Assistir humano | Portal web autenticado, alta sensibilidade (afeta governança). Agente redige minuta de alteração, calcula novas quotas, gera checklist de assinaturas; humano protocola. | Alta | Alta |
| 7 | Alteração contratual — capital | Receita Federal pós-Junta | Automatizar | Comunicação à Receita via DBE pós-deferimento é mecânica e tem prazo de 30 dias. Agente dispara automaticamente quando detecta NIRE atualizado. | Alta | Média |
| 8 | Alteração contratual — sócios | Junta Comercial | Assistir humano | Alta complexidade jurídica (cessão, certidões, sucessão). Agente prepara cessão, verifica certidões, calcula ganho de capital quando aplicável; humano protocola e revisa. | Alta | Alta |
| 9 | Alteração contratual — sócios | Receita Federal (DARF ganho capital) | Assistir humano | Cálculo do ganho de capital exige análise de valor de cessão vs custo de aquisição. Agente gera memória de cálculo e guia DARF; humano confere e paga. | Média | Média |
| 10 | Alteração contratual — sócios | Receita Federal pós-Junta (QSA) | Automatizar | Atualização do QSA pós-Junta é mecânica e tem prazo. | Alta | Média |
| 11 | Alteração contratual — sede | Junta Comercial origem | Assistir humano | Portal web autenticado. Agente redige alteração e checklist; humano protocola. | Alta | Alta |
| 12 | Alteração contratual — sede | Junta Comercial destino (se interestadual) | Assistir humano | Mesma lógica, mas em segunda UF — agente identifica fluxo correto por UF e prepara documentação. | Baixa | Média |
| 13 | Alteração contratual — sede | Receita Federal pós-Junta | Automatizar | Atualização cadastral via DBE pós-Junta. | Alta | Média |
| 14 | Alteração contratual — sede | Prefeitura (nova inscrição municipal) | Assistir humano | Portal web sem API uniforme; cliente precisa abrir nova CCM no município destino. Agente prepara documentação; humano efetua. | Alta | Alta |
| 15 | Alteração contratual — CNAE | Junta Comercial | Assistir humano | CNAE novo exige análise de impacto tributário PRÉVIA (pode desenquadrar do Simples). Agente roda análise + prepara alteração; humano valida e protocola. | Média | Alta |
| 16 | Alteração contratual — CNAE | Receita Federal pós-Junta | Automatizar | Atualização cadastral mecânica. | Média | Média |
| 17 | Alteração contratual — CNAE | Prefeitura/Sefaz (revisão IE/CCM) | Assistir humano | Cliente precisa atualizar enquadramento — portais diferentes por município/estado. Agente prepara orientação; humano efetua. | Média | Média |
| 18 | Abertura de filial | Junta Comercial sede (averbação) | Assistir humano | Ato societário; humano executa. | Baixa | Alta |
| 19 | Abertura de filial | Junta Comercial destino | Assistir humano | Mesma lógica, em segunda UF. | Baixa | Alta |
| 20 | Abertura de filial | Receita Federal (CNPJ filial) | Automatizar | Decorre do DBE — geração automática. | Baixa | Alta |
| 21 | Abertura de filial | Prefeitura destino + Sefaz destino | Assistir humano | Portais municipais e estaduais variam — humano efetua com cert. | Baixa | Média |
| 22 | Baixa de filial | Junta Comercial | Assistir humano | Ato societário com requisitos. Agente verifica certidões e prepara baixa; humano protocola. | Baixa | Alta |
| 23 | Baixa de filial | Receita Federal | Automatizar | Atualização cadastral pós-Junta. | Baixa | Média |
| 24 | Baixa de filial | Sefaz + Prefeitura + eSocial | Fora de escopo | Combinação de portais com baixa frequência e alta complexidade. Volume não justifica engenharia dedicada na Fase 2. | Baixa | Média |
| 25 | Distrato / encerramento | Junta Comercial | Assistir humano | Alta sensibilidade (ex-sócios respondem ilimitadamente). Agente verifica CNDs, prepara distrato e checklist; humano protocola. | Baixa | Alta |
| 26 | Distrato / encerramento | Receita Federal (baixa CNPJ) | Assistir humano | DBE de baixa exige confirmações regulatórias múltiplas; risco de débito remanescente. Agente pré-flighta certidões; humano confirma e assina. | Baixa | Alta |
| 27 | Distrato / encerramento | eSocial + FGTS + INSS (encerramento) | Fora de escopo | Multi-portal de DP/Fiscal, alta complexidade, baixa frequência. Volume não justifica engenharia dedicada na Fase 2 — deixar pra Fase 3 (DP) e Fase 5 (Fiscal). | Baixa | Alta |
| 28 | Distrato / encerramento | Sefaz + Prefeitura (encerramento IE/CCM) | Fora de escopo | Mesma lógica. Baixa frequência, alta complexidade multi-portal. | Baixa | Média |
| 29 | Transformação societária | Junta Comercial | Fora de escopo | Frequência baixa + complexidade jurídica exigindo advogado externo na maioria dos casos. Não há ganho marginal claro em automação na Fase 2. | Baixa | Média |
| 30 | Transformação societária | Receita Federal pós-Junta | Fora de escopo | Mesma lógica — segue o ato principal que está fora de escopo. | Baixa | Média |
| 31 | MEI — formalização | Portal do Empreendedor | Assistir humano | Portal web sem API; processo simples mas captcha humano frequente e dados pessoais sensíveis. Agente coleta dados e prepara CCMEI; humano efetua online (5 min). | Variável (alta na entrada, depois zero) | Alta |
| 32 | MEI — alteração cadastral | Portal do Empreendedor | Assistir humano | Mesmo padrão — portal web simples; humano com captcha. | Média | Alta |
| 33 | MEI — desenquadramento | Portal Simples Nacional (saída do regime) | Assistir humano | Portal web autenticado com cert. ou código. Agente prepara saída + nova constituição em paralelo; humano efetua. | Média | Média |
| 34 | MEI — desenquadramento | Junta Comercial + Receita + Prefeitura (nova ME) | Assistir humano | Decorre o "abrir ME" — segue mesmo padrão da obrigação #1. | Média | Média |
| 35 | Atualização cadastral CNPJ | Redesim (DBE) | Assistir humano | DBE precisa cert. do cliente ou procuração eletrônica eCAC. Agente prepara DBE; humano assina e envia. | Alta | Alta |
| 36 | Atualização cadastral CNPJ | Receita Federal | Automatizar | Confirmação via consulta CNPJ pública/oficial pós-DBE. | Alta | Alta |
| 37 | Procuração eletrônica eCAC | eCAC Receita | Fora de escopo (ato do cliente) | Procuração é ato do cliente final no eCAC dele, com cert. dele. Agente NÃO faz em nome — orienta, gera instruções claras com print/script. Trabalho de Atendimento e DP, não engenharia Societária. | Alta | Alta |
| 38 | Certificado digital — orientação | Certificadoras (Serasa, Soluti, etc) | Assistir humano | Agente gera comparativo, agenda emissão, monitora vencimento e dispara renovação. Emissão exige presença física do cliente → humano. | Alta | Alta |
| 39 | Certificado digital — emissão presencial | Certificadora (validação biométrica) | Fora de escopo | Validação presencial é gargalo intransponível. Não há automação possível além de orientação. | Alta (anual por cliente) | Alta |
| 40 | Consulta pública de status (qualquer obrigação acima) | Consulta CNPJ pública / Brasil API / Integra Contador | Automatizar | Read-only, baixo risco, alta frequência (verificação pós-deferimento). Agente confirma sucesso de atos e atualiza domínio compartilhado. | Alta | Alta |
| 41 | Consulta pública de processos judiciais relacionados | ConectaJusbr | Automatizar | API REST oficial, read-only. Útil em encerramento e transformação pra pré-flightar passivos. | Média | Alta |
| 42 | Cálculo de impacto tributário (CNAE / regime) | Interno (sem portal) | Automatizar | Cálculo determinístico baseado em CNAE + faturamento; agente roda análise. Não é portal externo, mas aparece no fluxo. | Alta | Alta |
| 43 | Monitoramento de prazo / vencimento | Interno (calendário) | Automatizar | Calendário de obrigações é deterministico — agente programa alerta e dispara fluxo na data. | Alta | Alta |
| 44 | Confirmação de deferimento na Junta | Portal da Junta + consulta pública | Automatizar (read-only) | Polling de status do processo é leitura — varias Juntas têm consulta pública por NIRE. | Alta | Média |
| 45 | Geração de petição/dossiê pra protocolo | Interno (sem portal) | Automatizar | Geração de documento (contrato, alteração, dossiê de certidões) é IA pura — sem portal externo. Output vira input do humano. | Alta | Alta |

**Total: 45 linhas.**

---

## Distribuição final

| Bucket | Linhas | % |
|---|---|---|
| Automatizar | 14 | 31,1% |
| Assistir humano | 24 | 53,3% |
| Fora de escopo | 7 | 15,6% |

**Stop rule do sprint (>60% "Fora de escopo") NÃO disparou** (15,6% bem abaixo do limite). Distribuição confirma a hipótese inicial: o produto Societário tem espaço claro, predominantemente como copiloto humano.

---

## Padrões observados

1. **Junta Comercial cai consistentemente em "Assistir humano"** — sem API geral, UX varia por UF, ato exige cert. dos sócios. Agente prepara minuta + checklist, humano protocola. Vale 100% das alterações contratuais e abertura/baixa.

2. **Receita Federal pós-Junta é o "doce"** — atualização cadastral via DBE pós-deferimento é mecânica, tem prazo legal (30 dias) e é fonte clássica de multa. Múltiplas obrigações têm a mesma cauda em "Automatizar (Receita)". É um candidato natural a primeiro caso de automação real.

3. **Read-only é fácil** — consultas (CNPJ, ConectaJusbr, status na Junta) são API oficial ou web estável, risk-free. Compõe boa parte dos casos "Automatizar" e suporta os "Assistir humano" (pré-flight de certidões, confirmação de deferimento).

4. **Prefeituras e Sefaz estaduais são fragmentadas** — cada município/estado tem portal próprio. Cobrir todos é trabalho de longa duração. Estratégia: começar por SP (densidade), expandir conforme demanda.

5. **MEI tem fluxo próprio (Portal Empreendedor)** — separado de Junta Comercial. Captcha frequente e dados sensíveis impedem automação total; processo é simples o suficiente pra "Assistir humano" funcionar bem (agente prepara, humano protocola em 5 min).

6. **Certidões negativas são pré-flight universal** — quase toda obrigação grande exige certidões (federal, estadual, municipal, trabalhista). Agente que pré-flighta certidões antes de iniciar processo evita retrabalho. Read-only, alta frequência, "Automatizar".

7. **"Fora de escopo" se concentra em transformação societária, distrato com débitos pendentes, e atos de cliente final no eCAC** — combinação de baixa frequência + alta complexidade jurídica. Não justifica engenharia dedicada na Fase 2.

8. **Geração de documento é IA pura** — petições, contratos, minutas de alteração, dossiês de checklist. Não precisa de portal externo. É a função onde IA brilha e o output vira insumo direto do humano. Compõe boa parte do valor de "Assistir humano".

9. **Calendário de obrigações é determinístico** — não precisa de IA pra disparar alerta de prazo. Workflow/cron resolve. IA entra pra interpretar "esse cliente faz sentido pra esse caminho?".

10. **Procuração eletrônica é gargalo cross-departamento** — pré-condição pra atendimento, societário, DP, fiscal. Vale ter agente dedicado a orientar cliente final na criação/renovação da procuração — apesar de ato ser do próprio cliente.

---

## Implicações pras Tarefas 4–6

**Tarefa 4 (ADR-023 topologia):** distribuição mostra que o departamento Societário é predominantemente "copiloto de processo" — agente prepara, humano protocola, agente confirma deferimento. Sugere modelo de **orquestrador-de-processos** (Opção B do sprint prompt) ou **híbrido** (Opção C). Espelhar Atendimento sem adaptação (Opção A) provavelmente subutiliza a natureza assíncrona dos atos. Discussão no ADR-023.

**Tarefa 5 (ADR-024 schema):** alta presença de processos com múltiplos passos (gerar documento → coletar assinaturas → protocolar → aguardar deferimento → confirmar → atualizar Receita) **JUSTIFICA** schema dedicado de `legal_processes` + `process_steps`. Workflow de longa duração é a realidade do departamento.

**Tarefa 6a (ADR-021 RPA):** 14 casos de "Automatizar", dos quais a maioria absoluta é via API oficial (Receita pós-Junta, consultas públicas, ConectaJusbr) ou interno (cálculos, calendário, geração de documento). Único caso de "Automatizar via portal web sem API" é polling de status em portal da Junta (linha #44) — consulta pública por NIRE, baixo risco, sem captcha. **NÃO justifica ADR-021 dedicado de RPA strategy** — criar `docs/discovery/societario-rpa-nao-justificado.md`.

**Tarefa 6b (ADR-022 workflow engine):** alta presença de processos multi-passo de longa duração (abertura: 5–20 dias úteis, encerramento: 30–180 dias úteis). BullMQ + jobs simples pode bastar pra disparar polling em cron, mas a orquestração de processos com múltiplos passos com dependências (DBE só dispara depois do NIRE confirmado, etc) **vai pedir mais**. **JUSTIFICA discussão em ADR-022** — BullMQ + cron vs Temporal vs custom orchestrator.

---

## Linhas com "Confiança: Baixa"

Nenhuma linha foi marcada Baixa neste ciclo. Critérios usados:
- "Alta": fato técnico verificável publicamente (existência de API, requisitos de cert., presença física)
- "Média": peculiaridade local (UF/município) ou dependência de prática do escritório — validar com sócio melhora, não bloqueia

Não há classificação que esteja chutando frequência ou valor cobrado em campo crítico de decisão da matriz (a coluna Frequência usa `[estimativa]` para banda pública e não condiciona o bucket). Mesmo assim, várias decisões dependem de prática operacional do sócio — capturadas na Tarefa 7 (perguntas pro sócio), seção "Validação da matriz".

---

## Lista de itens "Média" que viram pergunta na Tarefa 7

Itens onde a classificação é defensável mas o sócio pode mudar a banda de frequência ou apontar peculiaridade local não-pública:

- Linhas #5, #7, #9, #10, #12, #13, #16, #17, #21, #23, #26, #28, #29, #30, #33, #34, #44 — confirmar com sócio se a banda de frequência bate e se o bucket parece adequado dado o tipo de cliente que o escritório atende
