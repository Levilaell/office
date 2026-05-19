# Departamento Contábil — Mapa de descoberta

> Sprint Mapa de Departamentos, Tarefa 2.
> Documento na linguagem do contador, profundidade média. Comparativo central em
> `docs/discovery/departamentos-mapa-comparativo.md`.

## (a) O que esse departamento faz no dia a dia

### Entrada de movimento (contínuo)
1. Receber documentação do cliente (NF-e de vendas, NF-e/NFS-e de compras, recibos, contratos, comprovantes bancários)
2. Classificar documento (compra, venda, despesa, ativo, financeiro, transferência)
3. Lançar movimento no sistema (Domínio, Alterdata, Sage Contábil, Questor, ContaAzul, Omie) — débito + crédito com plano de contas
4. Cadastrar fornecedor/cliente novo quando aparece (CNPJ, dados, conta contábil padrão)
5. Manter o plano de contas atualizado (criar conta nova quando movimento exigir)

### Conciliação
6. **Conciliação bancária** — bater extrato do banco com lançamentos contábeis (cliente fornece OFX, CSV, ou conexão via Open Finance)
7. Conciliação de cartão de crédito (faturas vs lançamentos individuais)
8. Conciliação de contas a pagar e receber (cruzar lançamentos com fluxo real)
9. Tratar diferenças (lançamento esquecido, retenção não prevista, juros bancários, tarifas, débito automático sem aviso)

### Fechamento mensal/trimestral
10. **Apuração de resultado** — DRE mensal (receita, custo, despesa, lucro)
11. **Balancete mensal** — relação de contas com saldos
12. Apuração de impostos sobre o lucro (IRPJ + CSLL) — para Lucro Presumido e Lucro Real
13. **Fechamento de competência** — bloquear lançamentos do mês após apuração
14. Provisões (férias, 13º, encargos sobre folha) — quando regime exigir

### Encerramento anual
15. **Balanço Patrimonial** anual (ativo + passivo + PL)
16. DRE anual consolidada
17. **ECD** — Escrituração Contábil Digital (entregar ao SPED até último dia útil de maio do ano seguinte)
18. **ECF** — Escrituração Contábil Fiscal (entregar ao SPED até último dia útil de julho)
19. **DRE para o cliente** (formato gerencial pra leitura do sócio)
20. Notas explicativas e relatórios (Lucro Real e empresa de médio porte)

### Atendimento a terceiros
21. Atendimento a banco para análise de crédito (DRE, balanço, faturamento por mês)
22. Atendimento a auditoria externa (quando cliente tem)
23. Atendimento a fiscalização da Receita (cruzamento entre ECD/ECF e DCTFs)
24. Resposta a financeiras e investidores quando cliente busca crédito ou capital

### Manutenção
25. Acompanhar mudanças no regime tributário (Simples vs Presumido vs Real)
26. Avaliar enquadramento por sublimite anual (Simples — sublimite de R$ 4,8M)
27. Ajustes de competência (reabertura excepcional, retificações de lançamento)

**Total: 27 atividades.** Núcleo é a linha 3 (lançar movimento) — todo o resto deriva dela. Volume diário de lançamentos é a métrica principal de carga.

## (b) Por que dói pro escritório

**Volume é o problema número um.** Cliente médio (PME, 50 funcionários, R$ 5M faturamento/ano) gera centenas de documentos por mês — NFs de venda, NFs de compra, recibos, despesas via cartão, extratos bancários com dezenas de movimentações. Lançamento é trabalho manual repetitivo. Mesmo com importação de XML de NF-e (que já é padrão), restam categorização, vínculo ao centro de custo, classificação de despesa específica e tratamento de exceção. Escritório típico processa milhares de lançamentos por mês.

**Qualidade da entrada depende do cliente.** NF-e chega via XML padrão — fácil. Mas comprovante bancário, recibo de despesa, contrato de prestação de serviço chegam por WhatsApp, e-mail, foto borrada, papel rasgado. Trabalho de "ir atrás" do documento consome tempo do escritório. Cliente que não manda no prazo trava o fechamento.

**Conciliação bancária é tediosa.** Bater extrato com lançamento, identificar transferência interna, tratar débito automático esquecido, juros, tarifas. Cliente faz Pix sem registrar; pagamento de fornecedor cai na conta como TED sem identificação. Cada item exige investigação.

**Mudança de regime tributário cascateia.** Cliente saiu do Simples no meio do ano? Plano de contas muda, apuração de imposto muda, cálculo de despesa dedutível muda. Equipe ajusta lançamentos retroativos, regenera apurações, refaz DCTFs. Trabalho silencioso, alto risco.

**Erro vira problema demorado.** Erro de classificação em janeiro só aparece no balanço de dezembro. Cliente reclama em junho quando o banco recusa o balanço pra empréstimo. Voltar e reabrir competência é dor. ECD/ECF entregue com erro força retificação que entra em malha fina.

**Atendimento ao cliente sobre números do negócio**. Cliente liga: "por que minha despesa cresceu?", "esse lucro tá certo?", "posso distribuir dividendo?". Contador é o oráculo dos números — mas leva 30 minutos pra montar resposta puxando relatórios.

## (c) O que dá pra automatizar (matriz)

| # | Atividade | O que humano faz hoje | O que IA/automação faria | Bucket | Confiança |
|---|---|---|---|---|---|
| 1 | Importação de NF-e XML | Sistema importa; contador valida ou aceita | Automação total — agente importa, valida CFOP/CST, alerta divergência | Automatizar | Alta |
| 2 | Classificação de lançamento (NF, recibo, despesa) | Contador olha + escolhe conta contábil | Agente classifica por histórico do cliente + descrição + regra do plano de contas; humano valida amostragem | Automatizar | Alta |
| 3 | Lançamento contábil simples (compra rotineira, venda padrão) | Contador lança | Agente lança automaticamente após classificar; humano valida amostra | Automatizar | Média |
| 4 | Lançamento de exceção (operação atípica, transferência complexa, ativo) | Contador lança caso a caso | Agente prepara proposta de lançamento, sinaliza dúvida; humano decide e lança | Assistir humano | Alta |
| 5 | Cadastro de fornecedor/cliente novo | Contador consulta CNPJ + cadastra | Agente consulta API pública (Receita), preenche dados, propõe conta contábil; humano confirma | Automatizar | Alta |
| 6 | Conciliação bancária (cruzamento extrato × lançamento) | Contador roda no sistema, trata diferenças manualmente | Agente importa OFX, faz matching automático (data + valor + descrição), separa "casado" de "pendente"; humano resolve pendentes | Assistir humano | Alta |
| 7 | Conciliação de cartão de crédito | Contador bate fatura com lançamentos | Agente quebra fatura por estabelecimento, propõe lançamento individual, identifica juros/anuidade; humano valida | Automatizar | Média |
| 8 | Tratamento de diferença na conciliação (Pix sem registro, TED não identificada) | Contador investiga, pergunta ao cliente | Agente sinaliza diferença, sugere via histórico (este TED na mesma data e valor é provavelmente pagamento ao fornecedor X), pergunta ao cliente via Atendimento | Assistir humano | Média |
| 9 | Apuração de resultado mensal (DRE) | Contador roda no sistema | Agente roda + valida consistência (margens fora de banda esperada, conta com saldo anômalo) + emite relatório | Automatizar | Alta |
| 10 | Balancete mensal | Contador roda + revisa | Agente roda + identifica contas com movimento atípico + emite | Automatizar | Alta |
| 11 | Apuração de IRPJ/CSLL (Lucro Presumido) | Contador calcula | Determinístico — agente roda com base no faturamento e percentual de presunção; humano valida | Automatizar | Alta |
| 12 | Apuração de IRPJ/CSLL (Lucro Real) | Contador calcula com adições/exclusões/compensações | Agente roda base + sinaliza ajustes (despesas indedutíveis, prejuízo acumulado, doações); humano valida ajustes | Assistir humano | Alta |
| 13 | Provisões (férias, 13º, encargos) | Contador roda mensal | Agente roda automaticamente com base na folha (cruzamento com Pessoal) | Automatizar | Alta |
| 14 | Fechamento de competência (bloqueio do mês) | Contador fecha após apuração | Agente fecha automaticamente após validação dos relatórios; humano confirma | Assistir humano | Média |
| 15 | Balanço Patrimonial anual | Contador roda + revisa contas | Agente roda + cruza saldos com extratos + sinaliza inconsistência | Assistir humano | Alta |
| 16 | DRE anual | Contador roda + monta versão gerencial pro cliente | Agente roda + gera versão fiscal + versão gerencial; humano valida narrativa | Assistir humano | Alta |
| 17 | ECD (transmissão SPED) | Contador transmite | Agente prepara payload + valida estrutura + transmite; humano confirma | Assistir humano | Média |
| 18 | ECF (transmissão SPED) | Contador transmite | Agente prepara + valida + transmite; humano confirma | Assistir humano | Média |
| 19 | Atendimento a banco (DRE pra análise de crédito) | Contador puxa relatório + envia | Agente gera dossiê customizado por banco (formato exigido), envia | Automatizar | Média |
| 20 | Resposta a "por que minha despesa cresceu?" do cliente | Contador investiga, puxa relatórios, explica | Agente roda análise comparativa mês a mês, identifica conta-fonte da variação, monta narrativa; humano valida e envia | Assistir humano | Média |
| 21 | Avaliação de enquadramento tributário (Simples vs Presumido vs Real) | Contador roda simulação anual | Agente roda simulação contínua com dados reais + alerta quando regime atual deixa de ser ótimo; humano valida e propõe ao cliente | Assistir humano | Alta |
| 22 | Acompanhamento de sublimite Simples (R$ 4,8M) | Contador acompanha mensalmente | Agente alerta automaticamente em % do limite + projeta data de estouro | Automatizar | Alta |
| 23 | Atendimento a auditoria externa | Contador atende, fornece documentação | Agente prepara dossiê (extratos, lançamentos suporte, política contábil), responde questionário; humano valida narrativa final | Assistir humano | Média |
| 24 | Resposta a notificação Receita (cruzamento ECD × DCTF) | Contador prepara defesa | Agente identifica divergência, prepara explicação técnica + minuta de resposta; humano valida e envia | Assistir humano | Baixa |
| 25 | Reabertura de competência (correção retroativa) | Contador reabre, corrige, reapura | Agente prepara plano de correção em cascata (lançamento corrigido → reapuração → retransmissão), executa após aprovação | Assistir humano | Baixa |
| 26 | Decisão sobre política contábil (depreciação, provisão, reconhecimento de receita) | Sócio do escritório decide com cliente | — | Fora de escopo | Alta |
| 27 | Avaliação de negócio em fusão/aquisição | Sócio/consultor especializado | — | Fora de escopo | Alta |
| 28 | Conversa com investidor/banco sobre estratégia | Sócio do escritório atende | — | Fora de escopo | Alta |

**Total: 28 linhas.** Distribuição:

| Bucket | Linhas | % |
|---|---|---|
| Automatizar | 10 | 36% |
| Assistir humano | 15 | 54% |
| Fora de escopo | 3 | 11% |

**% Automatizável** = 36% + 27% = **63%**.

## (d) O que NÃO dá pra automatizar e por quê

1. **Decisão sobre política contábil** (depreciação por tempo de vida útil contestável, provisão de devedores duvidosos, reconhecimento de receita em contratos longos) — exige julgamento técnico-contábil + alinhamento com o cliente.
2. **Avaliação de negócio em fusão/aquisição** — análise complexa de ativos intangíveis, projeções, due diligence.
3. **Conversa estratégica com sócio do cliente** sobre distribuição de lucro, capitalização, sucessão — relação de confiança humana.
4. **Tratamento de operação atípica nova** (primeiro contrato de royalties, primeira venda internacional, primeiro arrendamento mercantil) — exige interpretação do regulamento contábil aplicável (CPCs).
5. **Resposta a fiscalização da Receita em campo** — auditor presencial, perguntas abertas.
6. **Definição de plano de contas pra cliente novo grande** — exige conversa pra entender o negócio.

## (e) Como esse departamento conversa com os outros

Contábil é o "espelho" dos outros departamentos:

- **Pessoal** gera folha mensal → Contábil lança despesa de pessoal, INSS empresa, FGTS, provisões de férias e 13º
- **Fiscal** apura impostos → Contábil lança DAS/DARF/ICMS na competência (cruzamento ECD × DCTFWeb é matéria de fiscalização)
- **Atendimento** recebe pergunta do cliente sobre números ("posso distribuir lucro? Quanto sobrou?") → consulta Contábil pra apurar
- **Societário** processa alteração de capital → Contábil registra integralização (caixa, ativo, capital social) e ajusta plano de contas
- **Financeiro Interno** (do escritório) usa Contábil como exemplo para ele próprio — escritório também tem contabilidade
- **Atendimento** recebe NF do cliente → encaminha pra Contábil → Contábil classifica e lança
- **Contábil** detecta divergência em extrato → **Atendimento** pede esclarecimento ao cliente

Esboço de fluxo (movimento mensal):

```
Mês X chega
  → Pessoal fecha folha do mês X-1 → publica resultado
  → Fiscal apura impostos mês X-1 → publica DAS/DARF
  → Cliente envia documentos do mês X-1 (NFs, extratos, recibos)
  → Atendimento triagem
  → Contábil:
    → importa NF-e XML
    → classifica e lança (auto + amostragem humano)
    → concilia extrato bancário (matching auto + tratamento humano de pendência)
    → lança despesas de pessoal (vindo de Pessoal)
    → lança impostos (vindo de Fiscal)
    → roda DRE + balancete
    → valida consistência
    → fecha competência (humano confirma)
  → Cliente recebe DRE gerencial
```

## (f) Como o agente desse departamento se encaixaria

**Topologia provável:** Coordenador + Especialistas + Orquestrador. Coordenador atende dúvidas e classifica intent. Especialistas: **Lançamentos** (classificação + lançamento determinístico), **Conciliação** (matching algorítmico + tratamento de exceção via LLM), **Apuração** (DRE/balancete/IRPJ/CSLL), **SPED** (geração e validação de arquivos ECD/ECF). Orquestrador acordado por evento — fim de mês, fim de competência, fim de ano fiscal.

**Tier inicial:** sugestivo na maioria, **automatizar** sob amostragem em classificação de NF padrão. Cálculos puros (DRE, balancete, IRPJ/CSLL determinísticos) podem rodar autonomamente; resultado entra na competência e humano valida no fechamento. Tratamento de exceção (operação atípica, divergência de conciliação, ajuste de plano de contas) sempre sugestivo. Decisão de política contábil nunca passa pelo agente.

**Volume típico:** **altíssimo**. Cada cliente gera dezenas a centenas de documentos/mês. Escritório típico com 30-100 clientes processa milhares de lançamentos/mês. É o departamento com maior volume de operações determinísticas — alvo natural pra alavancagem.

**Chamadas LLM por operação:** baixas no caminho feliz (classificação por regra/histórico bate na maioria), **médias em exceção** (descrição ambígua, primeira ocorrência de tipo de despesa, divergência de conciliação). **Estimativa: 0 LLM em 70% dos lançamentos rotineiros, 2-5 LLM nos 30% de exceção** [estimativa].

**Risco regulatório:** **médio-alto**. Erro de classificação contábil não dá multa imediata, mas distorce DRE, balanço, ECD, ECF — cascateia em apuração de IRPJ/CSLL errada (cuja multa é Fiscal). Risco é também de **reputação**: cliente percebe DRE errada quando pede crédito no banco. Risco de fiscalização cruzada ECD × DCTF.

**Risco de venda alto.** Contabilidade é o **núcleo** do escritório — substituir é decisão difícil pro contador titular. Ele se identifica com o "fazer contabilidade". Vender "automação de contabilidade" pode soar como ameaça, não amplificação. Posicionamento precisa enfatizar: agente faz o trabalho repetitivo (lançamento, conciliação), contador faz o trabalho de valor (política, fechamento, conversa).

## (g) Tamanho do impacto comercial

[estimativas baseadas em material público]

- **Tempo do escritório consumido por Contábil**: **30-50% do tempo total** num escritório típico [estimativa]. É o maior consumidor de tempo absoluto.
- **% da receita vinda de Contábil**: **30-45% do faturamento** [estimativa]. Mas é também o serviço mais comoditizado — preço por cliente baixo, volume sustenta.
- **Dias "pegando fogo"**: dias 1-15 (fechamento do mês anterior), encerramento de exercício (janeiro-fevereiro), prazo ECD (maio), prazo ECF (julho). Total: **~10-15 dias/mês de pressão real**, com pico anual.
- **Tempo por dúvida de cliente sobre número**: **20-45 min** por interação [estimativa]. Resposta exige puxar relatório, comparar, montar narrativa.
- **Sensibilidade a erro**: alta no balanço anual (banco usa), média no mensal. Cliente percebe quando vai pedir crédito ou distribuir lucro.

---

## Síntese (pra alimentar o mapa comparativo)

- Volume: **Altíssimo** (contínuo diário, milhares de lançamentos/mês)
- Dor escritório: **Alta**
- Risco regulatório: **Médio** (cascateia em Fiscal e exposição em fiscalização cruzada)
- % Automatizável: **63%** (alto)
- Complexidade técnica: **Alta** (integração com sistemas legados Domínio/Alterdata/Sage, conexão bancária OFX/Open Finance, geração de SPED ECD/ECF)
- Tempo de implementação: 6-9 sprints × 2-3 semanas ≈ **4-6 meses** [estimativa]
- Risco de venda: **Alto** — núcleo do escritório, contador titular pode resistir à automação. Posicionamento crítico.
