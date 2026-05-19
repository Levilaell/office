# Departamento Pessoal/Folha — Mapa de descoberta

> Sprint Mapa de Departamentos, Tarefa 1.
> Documento na linguagem do contador, profundidade média. Comparativo central em
> `docs/discovery/departamentos-mapa-comparativo.md`.

## (a) O que esse departamento faz no dia a dia

### Admissão
1. Receber documentação do funcionário novo (CTPS digital, RG, CPF, comprovante de residência, escolaridade, certidões)
2. Orientar exame admissional e validar o ASO
3. Cadastrar no sistema (Domínio, Alterdata, Sage Folhamatic, Questor) com vínculo, função, cargo, salário e CCT aplicável
4. Gerar contrato (CLT, autônomo, estágio, intermitente) e termos (vale-transporte, vale-refeição, plano)
5. Transmitir evento **S-2200** (admissão) no eSocial até a véspera do início efetivo
6. Cadastrar dependentes para IR e salário-família

### Rotina mensal
7. Importar apontamento de jornada (planilha do cliente ou integração com ponto eletrônico)
8. Calcular folha (proventos, horas extras, adicionais, descontos, INSS, IRRF, FGTS, VT, VR, plano)
9. Gerar e enviar holerite ao funcionário (e-mail, app, impressão)
10. Gerar guias: **GPS** (INSS), **FGTS Digital** (FGTS), **DARF** do IRRF
11. Transmitir eventos **S-1200** (remuneração), **S-1210** (pagamento), **S-1299** (fechamento) no eSocial
12. Gerar **DCTFWeb** mensal (consolida tributos do eSocial e da EFD-Reinf)
13. Atender dúvidas do empregador e do funcionário (holerite, vale-transporte, falta, atestado)

### Eventos esporádicos
14. Cálculo e concessão de **férias** (saldo + 1/3 constitucional)
15. Processar afastamento (auxílio-doença INSS, licença-maternidade, acidente — S-2230)
16. Alteração de cargo/salário/jornada/função (S-2206)
17. Concessão e reembolso de salário-maternidade
18. Processar aviso prévio (trabalhado ou indenizado)

### Encerramento / rescisão
19. Calcular rescisão (saldo, aviso, 13º proporcional, férias proporcionais + 1/3, FGTS + multa 40% se aplicável)
20. Gerar **TRCT** e termos de quitação
21. Transmitir **S-2299** (desligamento) no eSocial
22. Gerar **GRFC** / chave de movimentação para saque de FGTS
23. Acompanhar homologação no sindicato quando a CCT exigir

### Anuais e periódicos
24. **13º salário** — 1ª parcela em novembro, 2ª em dezembro
25. **DIRF** anual (IR retido na fonte)
26. Atualização de salários por **dissídio** anual da CCT
27. Eventos SST do eSocial: **S-2210** (acidente), **S-2220** (monitoramento de saúde — ASO), **S-2240** (condições de trabalho — riscos)

**Total: 27 atividades.** Inclui o fluxo cruzado óbvio com o cliente final do escritório (atendimento de dúvida de funcionário no item 13).

## (b) Por que dói pro escritório

**eSocial domina a dor operacional.** Cada evento é um XML rígido contra o layout oficial vigente. Rejeição vem com código numérico difícil de diagnosticar; equipe gasta horas reabrindo arquivo, ajustando campos e retransmitindo. Layout muda periodicamente (S-1.0 → S-1.1 → S-1.2 nos últimos anos), o que força reaprender. Cliente final raramente entende rejeição — o escritório fica no meio.

**Prazo é inflexível.** Folha mensal precisa estar fechada até o pagamento dos funcionários. eSocial **S-1299** (fechamento) tem prazo legal (dia 15 do mês seguinte para Simples e Lucro Presumido normais), e a **DCTFWeb** depende dele. Atraso multiplica multas. Os dias 1-10 do mês são o "fim de mundo" do DP: equipe inteira para outras coisas pra fechar folha.

**Cálculo de rescisão é minado.** Verba indenizatória vs salarial muda incidência de INSS, FGTS e IR. Aviso prévio é proporcional ao tempo de serviço (Lei 12.506). Férias vencidas vs proporcionais. 13º proporcional. Multa de 40% sobre FGTS quando dispensa sem justa causa. Cada componente erra de jeito diferente, e funcionário ou ex-funcionário cobra — reclamação trabalhista é o risco real.

**Atendimento ao funcionário do cliente consome tempo do contador.** Funcionário liga reclamando de holerite ("desconto errado de vale-transporte") ou pedindo segunda via, e o contador é quem responde — porque o RH do pequeno cliente quase sempre não existe. Isso é "trabalho não cobrado": consome 20-40% [estimativa] do tempo da equipe de DP em escritórios que atendem PMEs e MEs.

**Legislação muda o tempo todo.** CLT, jurisprudência (TST/STF), CCTs anuais por categoria e estado, reforma trabalhista, mudanças em incidências previdenciárias. Equipe precisa acompanhar. Cliente pequeno paga o escritório justamente pra não acompanhar — e quando muda, o escritório paga o preço de atualizar nos sistemas.

## (c) O que dá pra automatizar (matriz)

| # | Atividade | O que humano faz hoje | O que IA/automação faria | Bucket | Confiança |
|---|---|---|---|---|---|
| 1 | Cálculo de folha mensal | Roda no sistema, confere por amostragem | Determinístico — agente roda cálculo + valida contra CCT do cliente; humano valida amostra | Automatizar | Alta |
| 2 | Geração e envio de holerite | Sistema gera PDF, contador envia | Agente gera + envia (WhatsApp/e-mail) + registra entrega | Automatizar | Alta |
| 3 | Geração de guias mensais (GPS/FGTS Digital/DARF) | Sistema gera, contador confere e disponibiliza | Agente gera + valida valores + monitora prazo + envia ao cliente | Automatizar | Alta |
| 4 | Transmissão de S-1200 (remuneração) | Contador transmite via sistema; corrige rejeição | Agente valida payload contra layout + transmite + interpreta rejeição + propõe correção; humano aprova | Assistir humano | Média |
| 5 | Cálculo de rescisão | Contador roda, revisa, envia ao funcionário | Agente roda + sinaliza pontos de risco (verbas, multa, aviso) + gera TRCT; humano revisa | Assistir humano | Alta |
| 6 | Transmissão de S-2299 (desligamento) | Contador transmite após rescisão validada | Agente prepara payload + transmite + monitora aceite; humano confirma | Assistir humano | Média |
| 7 | Geração de GRFC (FGTS rescisório) | Contador gera no Conectividade Social/sistema | Agente gera + valida valor + envia ao cliente | Automatizar | Alta |
| 8 | DCTFWeb mensal | Contador roda consolidação + transmite | Agente roda + cruza com eSocial e EFD-Reinf + transmite; humano aprova | Assistir humano | Média |
| 9 | DIRF anual | Contador consolida ano + transmite | Agente consolida + valida + transmite; humano confere antes | Assistir humano | Alta |
| 10 | Admissão (cadastro inicial) | Contador recebe docs + cadastra no sistema | Agente extrai dados dos documentos (OCR), valida, propõe cadastro; humano confere antes da transmissão S-2200 | Assistir humano | Média |
| 11 | Transmissão de S-2200 (admissão) | Contador transmite | Agente prepara payload pós-validação + transmite; humano confere primeiro | Assistir humano | Média |
| 12 | Cálculo de férias | Contador calcula + envia aviso | Agente calcula (saldo + 1/3) + gera recibo + monitora calendário | Automatizar | Alta |
| 13 | Cálculo e geração de 13º salário | Contador roda em novembro/dezembro | Agente roda + valida + gera holerites de 1ª e 2ª parcela | Automatizar | Alta |
| 14 | Atendimento ao funcionário do cliente (dúvida holerite, 2ª via) | Contador atende por WhatsApp/telefone | Agente responde via fluxo do Atendimento usando Pessoal como tool (read-only) | Automatizar | Média |
| 15 | Acompanhamento de afastamento INSS | Contador orienta, agenda perícia, ajusta folha durante afastamento | Agente monitora período + alerta retorno + atualiza folha; humano decide nas dúvidas | Assistir humano | Média |
| 16 | Alteração contratual (cargo/salário/jornada — S-2206) | Contador transmite | Agente prepara payload + transmite; humano confere | Assistir humano | Média |
| 17 | Apontamento de ponto (jornada do mês) | Cliente envia planilha, contador importa, confere divergências | Agente importa, identifica divergências, propõe ajuste; humano valida | Assistir humano | Média |
| 18 | Cálculo de verba complementar (adicional noturno, periculosidade, insalubridade) | Contador calcula caso a caso | Agente identifica aplicabilidade (CBO + CCT) + calcula | Automatizar | Média |
| 19 | Resposta a fiscalização trabalhista (MTE) | Contador responde com base em documentação | Agente prepara dossiê + minuta de resposta; humano revisa e envia | Assistir humano | Baixa |
| 20 | Eventos SST do eSocial (S-2210, S-2220, S-2240) | Contador transmite quando médico envia ASO/laudo | Agente recebe ASO/laudo → extrai → propõe payload; humano valida | Assistir humano | Média |
| 21 | Atualização por dissídio (CCT anual) | Contador lê CCT, ajusta sistema, recalcula | Agente lê CCT (PDF), extrai índice, propõe ajuste; humano valida | Assistir humano | Baixa |
| 22 | Mediação de conflito empregado-empregador | Contador escuta as partes (informalmente) | — | Fora de escopo | Alta |
| 23 | Decisão de demissão (justa causa, sem justa) | Cliente decide, contador implementa | — | Fora de escopo | Alta |
| 24 | Homologação sindical presencial (quando CCT exige) | Contador acompanha o cliente | — | Fora de escopo | Alta |
| 25 | Resposta a reclamação trabalhista (audiência) | Advogado responde; contador fornece dados | — | Fora de escopo | Alta |

**Total: 25 linhas.** Distribuição:

| Bucket | Linhas | % |
|---|---|---|
| Automatizar | 7 | 28% |
| Assistir humano | 14 | 56% |
| Fora de escopo | 4 | 16% |

**% Automatizável** (Automatizar + 50% × Assistir humano) = 28% + 28% = **56%**.

## (d) O que NÃO dá pra automatizar e por quê

1. **Decisão de demissão (justa causa ou sem)** — julgamento sobre prova documental e contexto. Risco trabalhista alto. Cliente decide.
2. **Mediação de conflito interno** — relação humana; agente vira parte do problema.
3. **Análise de afastamento com perícia INSS complexa** — exige análise médica e documentação clínica; advogado em muitos casos.
4. **Negociação de acordo individual atípico** (intermitente com nuance, banco de horas longo, jornada 12×36 contestada) — caso a caso com sócio do cliente.
5. **Resposta a fiscalização trabalhista presencial** — auditor pergunta no campo, defesa exige presença.
6. **Audiência de reclamação trabalhista** — advogado humano obrigatório (CLT + OAB).
7. **Homologação sindical presencial** — quando CCT exigir, é ato físico no sindicato.
8. **Interpretação de jurisprudência mudando** (terceirização, vínculo de PJ, pejotização) — exige interpretação jurídica.

## (e) Como esse departamento conversa com os outros

Pessoal é cliente-pesado do Atendimento (dúvidas de funcionário) e produtor pesado de obrigações (que viram tarefas no calendário fiscal):

- **Atendimento** recebe dúvida do funcionário do cliente ("meu holerite tá errado") → consulta Pessoal → responde
- **Atendimento** recebe dúvida do cliente final ("quanto vou pagar de INSS este mês?") → consulta Pessoal → responde
- **Pessoal** gera obrigações mensais (GPS, FGTS, DARF, DCTFWeb) → vão pro **calendário de obrigações** (visível por Fiscal e Atendimento, monitorado pelo Coordenador da plataforma)
- **Pessoal** gera resultado da folha → **Contábil** lança no resultado contábil (despesa de pessoal, provisões de férias e 13º)
- **Societário** processa admissão de sócio na empresa → **Pessoal** define se vira CLT, pró-labore ou sócio cotista (afeta encargos)
- **Pessoal** transmite eSocial → cruza com **Fiscal** (DCTFWeb consolida tributos previdenciários e retenções)
- **Pessoal** detecta divergência em apontamento → **Atendimento** pede correção ao cliente

Esboço de fluxo (admissão):

```
Cliente envia docs do funcionário novo
  → Atendimento recebe e classifica como "admissão"
  → encaminha pra Pessoal
    → Pessoal extrai dados dos documentos (OCR + validação)
    → propõe cadastro + contrato
    → notifica humano: "pronto pra transmitir S-2200, confere?"
    → humano valida e libera
    → Pessoal transmite S-2200
    → confirma recibo
    → atualiza domínio compartilhado (funcionário cadastrado, vínculo ativo)
  → Atendimento informa cliente: "admissão concluída"
```

## (f) Como o agente desse departamento se encaixaria

**Topologia provável:** Coordenador + N especialistas + Orquestrador (similar ao Societário). Coordenador é turn-a-turn — atende dúvidas no fluxo do Atendimento ou consulta direta. Especialistas: **Cálculo** (determinístico — folha, rescisão, férias, 13º), **eSocial** (validação contra layout + transmissão + interpretação de rejeição), **Trabalhista** (interpretação de CCT, jurisprudência, casos atípicos). Orquestrador é necessário pra rotina mensal — agente acordado por cron no dia 1 pra abrir folha, dia 5 pra fechar, dia 7 pra transmitir, dia 15 pra DCTFWeb. Padrão "agente persistente acordado por evento" já justificado no ADR-023 do Societário.

**Tier inicial:** sugestivo em todos. Risco regulatório alto (multa por evento errado, exposição em fiscalização). O Especialista de Cálculo pode migrar pra semi-autônomo após confiança comprovada, mas eSocial e rescisão sempre sugestivo. Decisões de cliente sobre demissão e acordo nunca passam pelo agente.

**Volume típico:** **alto**. Cada cliente tem N funcionários (média de 5-15 funcionários por cliente PME [estimativa]). Folha mensal = 1 evento × M clientes. Eventos eSocial esporádicos (admissões, demissões, alterações, afastamentos, SST) somam fluxo contínuo. Escritório típico de 4-15 pessoas atende 30-100 clientes [estimativa] = **200-1.500 eventos/mês**.

**Chamadas LLM por operação:** poucas no caminho feliz. Cálculo é determinístico — LLM só entra pra interpretação ("isso é INSS ou não?"), validação cruzada, interpretação de rejeição eSocial, e atendimento de dúvida. **Estimativa: 1-3 chamadas LLM por evento de exceção** [estimativa]. Cálculos puros usam zero LLM.

**Risco regulatório: alto.** eSocial errado = multa por evento (R$ 200-R$ 800 por evento conforme tabela vigente [estimativa]) + retrabalho. Cálculo de rescisão errado = exposição em reclamação trabalhista, valores significativos. Atraso de prazo mensal = juros e multa SELIC sobre tributos.

## (g) Tamanho do impacto comercial

[estimativas baseadas em material público: Sebrae, CFC, Sescon SP, fóruns Contabilizei/ContaSimples, textos da Sage/Domínio sobre rotina de DP]

- **Tempo do escritório consumido por DP**: **25-40% do tempo total da equipe** num escritório típico (4-15 pessoas) atendendo PMEs com folha [estimativa].
- **% da receita do escritório vinda de DP**: **20-30% do faturamento** [estimativa]. Folha é serviço caro e de retenção alta — cliente não troca de contador por outros serviços, troca por erro em folha.
- **Dias "pegando fogo"**: dias 1-10 do mês (fechamento + transmissão eSocial + DCTFWeb), dia 15 (DCTFWeb), pico em novembro/dezembro (13º), períodos de férias coletivas (julho/janeiro). Total: **~15 dias/mês de pressão real**.
- **Tempo médio por dúvida de funcionário**: **10-25 min** por interação [estimativa]. Em escritório com 30 clientes × 10 funcionários médio = 300 funcionários, supondo 4 dúvidas/funcionário/ano = 1.200 atendimentos/ano = 100/mês. A 15 min cada = **~25h/mês só de atendimento de holerite/dúvida** — quase um colaborador inteiro dedicado.
- **Sensibilidade a erro**: alta. Erro de holerite vira reclamação imediata; erro de eSocial vira retrabalho + multa; erro de rescisão vira ação trabalhista. Cliente percebe muito.

---

## Síntese (pra alimentar o mapa comparativo)

- Volume: **Alto** (mensal × N clientes + eventos esporádicos)
- Dor escritório: **Altíssima**
- Risco regulatório: **Alto**
- % Automatizável: **56%** (médio-alto)
- Complexidade técnica: **Média** (1-3 integrações eSocial/FGTS/DCTFWeb + workflow mensal de prazo curto)
- Tempo de implementação: 5-7 sprints × 2-3 semanas ≈ **3-4 meses** [estimativa]
- Risco de venda: **baixo** — escritório se mata com folha, paga bem por melhoria
