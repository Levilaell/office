# Departamento Fiscal — Mapa de descoberta

> Sprint Mapa de Departamentos, Tarefa 3.
> Documento na linguagem do contador, profundidade média. Comparativo central em
> `docs/discovery/departamentos-mapa-comparativo.md`.

## (a) O que esse departamento faz no dia a dia

### Recepção e classificação fiscal de documentos
1. Receber NF-e (entrada e saída) emitidas e recebidas — via XML do cliente ou puxando do portal Sefaz
2. Classificar **CFOP** (operação fiscal — venda, devolução, transferência, etc) — se cliente emite errado, ajustar
3. Validar **CST/CSOSN** (tributação ICMS) e **NCM** (classificação fiscal) — base pra apuração
4. Identificar incidência de **ICMS Substituição Tributária** quando aplicável
5. Tratar **DIFAL** (diferencial de alíquota interestadual) em vendas pra consumidor final fora do estado

### Apuração mensal — regime Simples Nacional
6. Apurar receita bruta do mês por anexo (I-V) do Simples
7. Calcular **DAS** mensal (alíquota efetiva conforme faixa e anexo)
8. Gerar guia DAS via PGDAS-D no portal Receita
9. Acompanhar sublimite estadual (R$ 3,6M) e nacional (R$ 4,8M) — alerta de desenquadramento

### Apuração mensal — regime Lucro Presumido
10. Apurar **PIS/COFINS** (cumulativo, alíquotas 0,65% + 3,0%)
11. Apurar **IRPJ** (presunção 8%/12%/32% conforme atividade) e **CSLL** (presunção 12%/32%)
12. Calcular **ISS** (varia por município, 2-5%) sobre serviços
13. Apurar **ICMS** sobre vendas, considerando substituição tributária, isenções, créditos
14. Gerar guias DARFs e GIAs
15. Gerar e transmitir **EFD-ICMS/IPI** (SPED Fiscal mensal — estado exige)
16. Gerar e transmitir **EFD-Contribuições** (SPED PIS/COFINS mensal)

### Apuração mensal — regime Lucro Real
17. Apurar PIS/COFINS **não-cumulativo** (1,65% + 7,6% com créditos sobre insumos)
18. Apurar IRPJ/CSLL **sobre lucro contábil** (com adições, exclusões, compensações de prejuízo)
19. Manter **LALUR** (Livro de Apuração do Lucro Real) — eletrônico via ECF
20. Identificar e tratar despesas indedutíveis (multas, brindes acima do limite, etc)

### Consolidações periódicas
21. Apurar e transmitir **EFD-Reinf** (retenções na fonte — IRRF, INSS, ISS, contribuições previdenciárias)
22. Apurar e transmitir **DCTFWeb** (consolida tributos federais — cruza com eSocial + EFD-Reinf)
23. Atualizar e transmitir **DCTF** PJ tradicional (algumas obrigações ainda residuais)

### Anuais
24. **ECF** — Escrituração Contábil Fiscal (Lucro Real e Presumido). Compartilhado com Contábil mas Fiscal apura ajustes
25. **DEFIS** — Declaração de Informações Socioeconômicas e Fiscais (Simples Nacional, anual até 31/03)
26. **DIRF** anual (declaração de IR retido) — compartilhado com Pessoal
27. Apuração e entrega de **RFB DIRPF** dos sócios quando escritório atende

### Estaduais e municipais
28. **GIA** mensal estadual (varia por UF — SP usa GIA, outros usam EFD-ICMS direto)
29. **DESTDA** (declaração mensal Simples — para empresas com substituição tributária e DIFAL)
30. **NFS-e** geração via portais municipais (ABRASF padrão em ~5% dos municípios, restante é proprietário)
31. Acompanhamento de regimes especiais municipais quando aplicável

### Fiscalização e contencioso administrativo
32. Atender notificação fiscal (Receita, Sefaz, Prefeitura)
33. Apresentar defesa em auto de infração
34. Acompanhar parcelamento de débitos quando cliente adere
35. Resposta a **malha fina** (cruzamento de obrigações entre si)

**Total: 35 atividades.** Mais amplo dos departamentos. Heterogeneidade reflete: cada regime tributário tem rotina própria, cada UF tem peculiaridade, cada município tem portal.

## (b) Por que dói pro escritório

**Complexidade legal é o problema número um.** Cada regime tributário (Simples / Presumido / Real) tem rotina própria, fórmula própria, prazo próprio. Cada estado tem peculiaridade de ICMS (ST, DIFAL, créditos, isenções, regimes especiais). Cada município tem portal próprio de NFS-e e tributo ISS com alíquota e base própria. Equipe precisa saber tudo. Cliente novo de UF nova ou município novo = curva de aprendizado real.

**Mudança legal constante.** Reforma tributária aprovada (CBS+IBS começa em 2026-2027), mudanças anuais de tabela do Simples (alíquotas efetivas), mudanças em CFOP/CST/NCM, decretos estaduais sobre ICMS, mudanças em alíquotas municipais. Software contábil acompanha — mas equipe precisa entender o impacto pra apurar corretamente.

**Prazo é absoluto.** DAS, DCTFWeb, ICMS, ISS mensais. Atraso = multa por dia + juros SELIC + correção. Cliente reclama do escritório, não do governo. Equipe corre.

**Erro de classificação cascateia.** CST errado = ICMS errado = SPED Fiscal errado = malha fiscal estadual. NCM errado = importação batida = IPI errado. Erro descoberto meses depois = retificação retroativa = pagamento de diferença + multa por declaração retificadora.

**SPED é o "raio-x da empresa pra Receita".** Cruza ECD × ECF × EFD-Contribuições × DCTFWeb × eSocial × NF-e emitidas × NF-e recebidas × extrato bancário (em alguns casos). Divergência entre obrigações dispara notificação automática. Escritório vira o detetive das divergências.

**Atendimento de fiscalização é desgastante.** Auditor fiscal pode pedir documentos de até 5 anos atrás, perguntar sobre operação específica, contestar classificação. Resposta exige montar dossiê + apresentar defesa. Risco de auto de infração com valor altíssimo.

**Cliente final reclama de imposto.** Cliente paga, contador é o "mensageiro" da conta. Cliente liga: "por que esse imposto tá tão alto?", "tem como pagar menos?", "esse DAS tá certo?". Resposta exige paciência + didática + às vezes simulação de regime alternativo.

## (c) O que dá pra automatizar (matriz)

| # | Atividade | O que humano faz hoje | O que IA/automação faria | Bucket | Confiança |
|---|---|---|---|---|---|
| 1 | Recepção de NF-e (puxar do portal Sefaz) | Contador ou sistema busca XML | Agente puxa via API integradora ou portal Sefaz; valida assinatura | Automatizar | Alta |
| 2 | Classificação de CFOP | Contador classifica caso a caso (ou cliente acerta) | Agente classifica por descrição + histórico + regra; sinaliza dúvida | Assistir humano | Média |
| 3 | Validação de CST/CSOSN e NCM | Contador valida amostral | Agente cruza CST × NCM × atividade do cliente, sinaliza inconsistência | Automatizar | Média |
| 4 | Apuração de DAS Simples Nacional | Sistema calcula, contador valida | Determinístico — agente calcula com base no faturamento por anexo; humano valida amostral | Automatizar | Alta |
| 5 | Geração de guia DAS no PGDAS-D | Contador acessa portal Receita | Agente integra com Integra Contador (API oficial pós-2023) | Automatizar | Alta |
| 6 | Acompanhamento de sublimite Simples | Contador acompanha mensalmente | Agente projeta data de estouro, alerta antecipadamente | Automatizar | Alta |
| 7 | Apuração de PIS/COFINS cumulativo (Lucro Presumido) | Sistema calcula | Determinístico | Automatizar | Alta |
| 8 | Apuração de PIS/COFINS não-cumulativo (Lucro Real) | Contador apura créditos sobre insumos | Agente roda + sinaliza créditos discutíveis (insumo essencial vs uso e consumo); humano decide | Assistir humano | Média |
| 9 | Apuração de IRPJ/CSLL Presumido | Sistema calcula com presunção | Determinístico | Automatizar | Alta |
| 10 | Apuração de IRPJ/CSLL Real | Contador faz LALUR com adições/exclusões/compensação | Agente roda base + propõe adições/exclusões via histórico e CPCs; humano valida | Assistir humano | Alta |
| 11 | Apuração de ICMS sobre vendas | Sistema calcula | Agente calcula + trata ST/DIFAL/isenção/crédito; humano valida exceção | Assistir humano | Alta |
| 12 | Apuração de ISS municipal | Sistema calcula | Agente calcula via alíquota municipal cadastrada; humano valida quando muda | Automatizar | Média |
| 13 | Geração e transmissão de EFD-ICMS/IPI (SPED Fiscal) | Contador transmite | Agente prepara arquivo + valida + transmite; humano confirma | Assistir humano | Média |
| 14 | Geração e transmissão de EFD-Contribuições | Contador transmite | Agente prepara + valida + transmite | Assistir humano | Média |
| 15 | EFD-Reinf | Contador transmite | Agente prepara + transmite após eventos | Assistir humano | Média |
| 16 | DCTFWeb mensal (consolidação tributos federais) | Contador transmite | Agente roda + cruza com eSocial e EFD-Reinf + transmite; humano valida | Assistir humano | Alta |
| 17 | DEFIS anual (Simples) | Contador transmite | Agente prepara + transmite | Automatizar | Alta |
| 18 | ECF anual | Contador prepara + transmite | Agente prepara payload + cruza com ECD; humano valida e transmite | Assistir humano | Média |
| 19 | DIRF anual | Contador consolida ano + transmite | Agente consolida + transmite | Assistir humano | Alta |
| 20 | GIA mensal SP | Contador transmite | Agente roda + transmite via portal Sefaz-SP | Assistir humano | Média |
| 21 | DESTDA (Simples ST/DIFAL) | Contador transmite | Agente roda + transmite | Automatizar | Média |
| 22 | NFS-e geração (município padrão ABRASF) | Cliente emite ou contador emite | Agente integra via API ABRASF (~5% dos municípios) | Automatizar | Alta |
| 23 | NFS-e geração (município padrão proprietário) | Contador acessa portal e emite | Agente prepara dados + humano emite no portal | Assistir humano | Média |
| 24 | Resposta a malha fina (cruzamento) | Contador investiga divergência + retifica | Agente identifica divergência por cruzamento de obrigações, propõe correção; humano valida e executa retificação | Assistir humano | Média |
| 25 | Resposta a notificação fiscal (1ª intimação, esclarecimento) | Contador prepara resposta | Agente prepara dossiê + minuta de resposta; humano revisa e envia | Assistir humano | Baixa |
| 26 | Resposta a auto de infração (defesa administrativa) | Contador + às vezes advogado | Agente prepara base factual; defesa jurídica é humano | Assistir humano | Baixa |
| 27 | Simulação de regime tributário (Simples × Presumido × Real) | Contador roda anual | Agente roda mensal com dados reais + alerta quando regime atual deixa de ser ótimo | Automatizar | Alta |
| 28 | Acompanhamento de parcelamento de débitos | Contador acompanha | Agente monitora vencimento de parcela + alerta + gera guia | Automatizar | Alta |
| 29 | Atendimento ao cliente sobre "por que tanto imposto?" | Contador explica caso a caso | Agente prepara análise + comparativo + simulação; humano valida narrativa | Assistir humano | Média |
| 30 | Defesa em fiscalização presencial (auditor no campo) | Contador atende presencial | — | Fora de escopo | Alta |
| 31 | Estratégia tributária (planejamento, holding, reestruturação) | Sócio do escritório (com advogado) | — | Fora de escopo | Alta |
| 32 | Resposta a recurso administrativo (CARF, CMT) | Advogado tributário | — | Fora de escopo | Alta |
| 33 | Decisão de aderir a parcelamento | Cliente decide com orientação do escritório | — | Fora de escopo | Alta |

**Total: 33 linhas.** Distribuição:

| Bucket | Linhas | % |
|---|---|---|
| Automatizar | 12 | 36% |
| Assistir humano | 17 | 52% |
| Fora de escopo | 4 | 12% |

**% Automatizável** = 36% + 26% = **62%**.

## (d) O que NÃO dá pra automatizar e por quê

1. **Defesa em fiscalização presencial** — auditor fiscal pergunta no campo, agente não vai.
2. **Estratégia tributária complexa** (holding patrimonial, planejamento internacional, reestruturação societária com objetivo fiscal) — exige advogado tributário + análise caso a caso.
3. **Recurso administrativo no CARF/CMT** — peça jurídica formal, advogado tributarista.
4. **Decisão de aderir a parcelamento ou pagar à vista** — decisão do cliente baseada em fluxo de caixa.
5. **Interpretação de norma nova (decreto/IN publicado ontem)** — exige análise jurídica até o software contábil incorporar.
6. **Tratamento de operação inédita** (primeira exportação, primeira importação de serviço com remessa) — exige análise dedicada.
7. **Negociação com fiscal** (parcelamento informal, esclarecimento de divergência via reunião) — relação humana.

## (e) Como esse departamento conversa com os outros

Fiscal é o consumidor pesado de **todos os outros departamentos** e o gerador de obrigações no calendário:

- **Pessoal** transmite eSocial → Fiscal consolida em DCTFWeb (cruzamento INSS + IR Retido + retenções)
- **Contábil** fecha competência → Fiscal apura impostos sobre o resultado (IRPJ/CSLL Real, PIS/COFINS, ICMS, ISS)
- **Atendimento** recebe pergunta do cliente sobre imposto → consulta Fiscal pra apurar
- **Societário** processa alteração de CNAE → Fiscal **alerta impacto tributário** (pode desenquadrar do Simples, mudar alíquota, exigir IE nova)
- **Societário** processa abertura/baixa → Fiscal apura últimos impostos antes de baixar
- **Fiscal** gera DAS/DARF/ICMS → **Atendimento** envia ao cliente
- **Fiscal** detecta divergência ECD × DCTFWeb → **Contábil** revê lançamento
- **Fiscal** detecta sublimite Simples próximo → **Atendimento** alerta cliente

Esboço de fluxo (apuração mensal Simples):

```
Fim do mês X
  → Pessoal fecha folha do mês X → transmite eSocial S-1299
  → Contábil fecha competência do mês X → publica receita bruta
  → Fiscal:
    → recebe receita bruta por anexo (do Contábil)
    → aplica alíquota Simples por faixa
    → calcula DAS
    → gera guia via PGDAS-D
    → projeta sublimite (alerta se > 80%)
  → Atendimento envia guia ao cliente
  → Cliente paga
  → Fiscal confirma quitação (consulta Receita)
  → Calendário fiscal: obrigação cumprida
```

## (f) Como o agente desse departamento se encaixaria

**Topologia provável:** Coordenador + Especialistas + Orquestrador. Coordenador atende dúvidas e roteia. Especialistas: **Apuração Simples** (determinístico — DAS, DEFIS, sublimite), **Apuração Lucro Presumido** (PIS/COFINS cumulativo, IRPJ/CSLL com presunção, ICMS), **Apuração Lucro Real** (PIS/COFINS não-cumulativo com créditos, LALUR), **SPED Fiscal/EFD-Reinf/DCTFWeb** (geração e transmissão de arquivos), **ICMS Estadual** (heterogêneo por UF — começar SP). Orquestrador acordado mensalmente pra abrir/fechar competência fiscal por cliente.

**Tier inicial:** **sugestivo em quase tudo, manual nas exceções**. Mais conservador dos departamentos. Cálculos determinísticos (DAS Simples, IRPJ Presumido, PIS/COFINS cumulativo) podem migrar pra semi-autônomo após confiança, porque erro é matematicamente reproduzível. Apuração Lucro Real, ICMS com ST/DIFAL, resposta a notificação, ECF anual — sempre humano antes da transmissão. Decisão estratégica tributária nunca passa pelo agente.

**Volume típico:** **alto** (mensal × N clientes). Cada cliente tem 1-5 apurações principais por mês (DAS ou conjunto Presumido/Real + GIA + DCTFWeb + EFD). Escritório com 30-100 clientes = **150-1.500 apurações/mês** + transmissões eSocial/EFD-Reinf/DCTFWeb consolidadas.

**Chamadas LLM por operação:** **médias**. Cálculos puros têm zero LLM, mas o departamento é heterogêneo — cada operação não-rotina (operação atípica, NCM duvidoso, regime especial, resposta a notificação, simulação de regime) puxa LLM. **Estimativa: 1-3 LLM por apuração rotineira, 5-15 LLM por exceção** [estimativa].

**Risco regulatório: ALTÍSSIMO.** O mais alto do produto. Multa por declaração entregue errada, multa por atraso, multa por divergência em SPED, juros SELIC sobre tributo errado. Auto de infração tem valor multiplicador (50% a 225% sobre o tributo). Sanção CFC ao responsável técnico (contador). Possível responsabilização criminal em caso de fraude (sonegação fiscal). Fiscal é o único departamento onde "humano sempre antes" é um princípio que pode ser **literal** em muitas situações.

**Por que tier "sugestivo" / "manual" sempre vai dominar Fiscal:** o trade-off entre velocidade e segurança pende todo pra segurança. Tempo gasto em validação humana é barato comparado a multa.

## (g) Tamanho do impacto comercial

[estimativas baseadas em material público]

- **Tempo do escritório consumido por Fiscal**: **20-35% do tempo total** num escritório típico [estimativa]. Menor que Contábil em horas absolutas mas mais "denso" — exige conhecimento técnico raro.
- **% da receita vinda de Fiscal**: **15-30% do faturamento** [estimativa]. Tipicamente embutido no fee mensal junto com Contábil.
- **Dias "pegando fogo"**: dias 18-25 do mês (vencimento da maioria das obrigações fiscais), dias 28-31 (DAS), prazo da DEFIS (março), prazo da ECF (julho). Total: **~12-15 dias/mês de pressão real**.
- **Tempo por dúvida fiscal do cliente**: **15-60 min** por interação [estimativa]. Resposta exige consulta a tabela, simulação, às vezes ofício a colega.
- **Sensibilidade a erro**: **máxima**. Erro fiscal vira processo administrativo, perda de cliente, exposição do escritório. Em escritórios pequenos, um único auto de infração mal defendido pode quebrar a relação com o cliente principal.
- **Diferencial competitivo**: escritórios que dominam **planejamento tributário** cobram premium. IA pode ajudar com simulação contínua e alerta proativo de oportunidade — diferencial real.

---

## Síntese (pra alimentar o mapa comparativo)

- Volume: **Alto** (mensal × N clientes, com diversidade enorme entre clientes)
- Dor escritório: **Altíssima** (complexidade + prazo + risco multiplicador)
- Risco regulatório: **Altíssimo** (multa + sanção CFC + criminal em fraude)
- % Automatizável: **62%** (alto), mas tier sempre sugestivo/manual
- Complexidade técnica: **Alta** (integrações múltiplas: PGDAS-D, EFD-ICMS/IPI por UF, EFD-Reinf, DCTFWeb, NFS-e municipais, Sefaz estaduais)
- Tempo de implementação: 8-12 sprints × 2-3 semanas ≈ **5-7 meses** [estimativa]
- Risco de venda: **Médio** — escritório quer ajuda, mas teme erro de IA em campo regulatório sensível. Confiança constrói com tempo.
- **Particularidade:** maior valor real (planejamento tributário) está no que NÃO é automatizável; agente assiste pra liberar contador para o trabalho de alto valor
