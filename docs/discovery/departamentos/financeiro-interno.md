# Departamento Financeiro Interno — Mapa de descoberta

> Sprint Mapa de Departamentos, Tarefa 4.
> Documento na linguagem do contador, profundidade média. Comparativo central em
> `docs/discovery/departamentos-mapa-comparativo.md`.

## Particularidade desse departamento

Os outros departamentos atendem o **cliente final do escritório**. Este atende **o próprio escritório** — o sócio, no caso. Implicações práticas:

- O **comprador** desse módulo é o sócio do escritório (decisor único, ciclo de venda curto)
- O **usuário** é o sócio + assistente administrativo (1-2 pessoas no escritório de 4-15)
- O **valor percebido** não está em escala (não atende N clientes do cliente), está em **gestão do negócio**
- A **complexidade técnica** é menor (é só um cliente, não N)
- O **risco regulatório** é baixo (escritório fatura próprio CNPJ, não há multa de Receita por erro interno)

## (a) O que esse departamento faz no dia a dia

### Faturamento aos clientes do escritório
1. Gerar **NFS-e** mensal de cada cliente (escritório presta serviço de contabilidade — emite NFS-e via prefeitura)
2. Enviar boleto/Pix de cobrança aos clientes (via gateway de pagamento ou geração manual)
3. Manter contratos vigentes dos clientes (valor mensal, reajuste por IGPM/IPCA, escopo de serviços)
4. Aplicar reajuste anual quando contrato prevê
5. Cobrar honorários **extra** quando cliente demanda serviço fora do contrato (alteração societária, consultoria pontual)

### Cobrança
6. Identificar clientes em atraso (1 dia, 7 dias, 30 dias, 60 dias)
7. Enviar lembrete amistoso (1-7 dias atraso)
8. Enviar cobrança formal (8-30 dias)
9. Negociar parcelamento quando cliente busca renegociação
10. Decidir corte de serviço em inadimplência grave (60+ dias) — decisão do sócio
11. Encaminhar à cobrança jurídica em caso extremo (raro em escritórios pequenos)

### Conciliação financeira interna
12. Conciliar recebimentos no banco com NFS-e emitidas (Pix, TED, boleto liquidado)
13. Identificar pagamento "às cegas" (transferência sem identificação clara)
14. Conciliar despesas internas (aluguel, energia, internet, sistemas, salários, IPVA, IPTU)
15. Gerenciar **fluxo de caixa** projetado do escritório (entradas previstas vs saídas previstas)

### Apuração de receita e custo
16. Calcular **receita por cliente** (faturamento mensal × N clientes)
17. Calcular **receita por colaborador** (quanto cada pessoa gera em horas faturáveis quando aplicável)
18. Calcular **custo do colaborador** (salário + encargos + benefícios + estrutura)
19. Calcular **margem por cliente** (receita - tempo gasto × custo-hora do colaborador)
20. Identificar cliente **deficitário** (margem negativa) e proposta de ajuste

### Folha interna do escritório
21. Folha mensal do próprio escritório (mesmo trabalho que Pessoal faz pros clientes — só que pra dentro)
22. Pró-labore do sócio
23. Pagamento de prestadores PJ/MEI quando aplicável (advogado, contador parceiro, TI)
24. Vale-refeição, plano de saúde, benefícios

### Relatórios pro sócio
25. **DRE gerencial** mensal do escritório
26. Indicadores: ticket médio, churn, inadimplência, margem, horas faturáveis vs não-faturáveis
27. Análise mês a mês (crescimento, sazonalidade)
28. Projeção anual (orçamento simples)
29. Análise de viabilidade de contratação nova (custo × receita esperada)

### Tributação do próprio escritório
30. Apuração do **DAS** do escritório (Simples Nacional Anexo III ou V conforme caso)
31. Geração de obrigações próprias (mesmas dos clientes mas pro CNPJ do escritório)

**Total: 31 atividades.** Algumas se sobrepõem com Pessoal e Fiscal (folha interna, DAS interno) — mas o consumidor é o sócio, não cliente externo.

## (b) Por que dói pro escritório

**Cobrança é desconfortável.** Cliente está em atraso, escritório precisa cobrar. Equipe sente que está "perseguindo" o cliente — relação que devia ser profissional vira chata. Inadimplência em escritório de contabilidade brasileira é tipicamente 5-15% [estimativa] do faturamento e cresce em períodos de crise econômica.

**Apuração de produtividade é manual.** Pra saber "este cliente dá lucro?", sócio precisa saber quanto tempo cada colaborador gasta com cada cliente. Maioria dos escritórios pequenos não tem timesheet — apura por intuição. Resultado: clientes deficitários ficam invisíveis por anos.

**Precificação de serviço novo é chute.** Cliente pede "consultoria pra fazer holding patrimonial" — quanto cobrar? Escritório pequeno não tem benchmarking. Tipicamente subprecificam (medo de perder a venda) e absorvem o trabalho.

**Folha interna é "feita por último".** Equipe processa folha de N clientes; quando sobra tempo, processa a do próprio escritório. Erro próprio é especialmente embaraçoso.

**Sócio não tem visão financeira clara do próprio negócio.** Ironicamente, escritório que cuida da contabilidade de N clientes tem visão débil da própria contabilidade. Faltam relatórios gerenciais (não fiscais — gerenciais), faltam indicadores. Sócio vai pelo "sentimento".

**Reajuste anual é deixado pra depois.** Contrato prevê reajuste por IGPM/IPCA, mas sócio adia pra "não perder o cliente". Resultado: escritório perde margem ano a ano contra a inflação.

## (c) O que dá pra automatizar (matriz)

| # | Atividade | O que humano faz hoje | O que IA/automação faria | Bucket | Confiança |
|---|---|---|---|---|---|
| 1 | Geração de NFS-e mensal aos clientes do escritório | Assistente emite uma por uma | Agente emite via API ABRASF (município padrão) ou prepara dados pra portal proprietário | Automatizar | Alta |
| 2 | Envio de boleto/Pix de cobrança | Assistente envia por e-mail/WhatsApp | Agente gera + envia automaticamente (Atendimento como canal); registra entrega | Automatizar | Alta |
| 3 | Aplicação de reajuste anual contratual | Sócio ajusta manualmente (quando lembra) | Agente alerta na data, propõe ajuste por IGPM/IPCA cadastrado, envia comunicado ao cliente; humano valida | Assistir humano | Alta |
| 4 | Cobrança automática de honorários extras (alteração societária, consultoria pontual) | Sócio cobra ao fim ou esquece | Agente identifica trabalho extra realizado (via outros departamentos) + propõe cobrança; humano valida | Assistir humano | Média |
| 5 | Identificação de clientes em atraso | Assistente roda relatório | Agente roda continuamente + alerta sócio + sugere ação | Automatizar | Alta |
| 6 | Envio de lembrete amistoso (1-7 dias) | Assistente envia | Agente envia automaticamente via Atendimento | Automatizar | Alta |
| 7 | Envio de cobrança formal (8-30 dias) | Assistente ou sócio envia | Agente envia com tom mais firme; humano valida primeiro contato | Assistir humano | Média |
| 8 | Negociação de parcelamento | Sócio negocia caso a caso | — (humano sempre, relação delicada) | Fora de escopo | Alta |
| 9 | Decisão de corte de serviço (60+ dias) | Sócio decide | — | Fora de escopo | Alta |
| 10 | Encaminhamento à cobrança jurídica | Sócio decide com advogado | — | Fora de escopo | Alta |
| 11 | Conciliação financeira do escritório | Assistente bate extrato com NFS-e | Mesmo padrão Contábil — agente faz matching, separa pendentes; humano resolve | Assistir humano | Alta |
| 12 | Identificação de pagamento sem origem clara | Assistente investiga | Agente sugere via histórico (TED no mesmo dia e valor é provavelmente do cliente X) | Assistir humano | Média |
| 13 | Conciliação de despesas internas | Assistente lança | Agente importa fatura (cartão corporativo, conta bancária) + classifica | Automatizar | Média |
| 14 | Fluxo de caixa projetado | Sócio roda mentalmente | Agente projeta com base em contratos vigentes + despesas recorrentes + sazonalidade histórica; humano valida cenário | Assistir humano | Média |
| 15 | Apuração de receita por cliente | Sócio sabe vagamente | Determinístico — agente roda relatório contínuo | Automatizar | Alta |
| 16 | Apuração de horas por colaborador por cliente | Não medido (na maioria dos escritórios pequenos) | Agente integra com sistema de tarefas/ChannelAdapter e estima por interação registrada; humano completa lacunas | Assistir humano | Baixa |
| 17 | Cálculo de custo de colaborador (salário + encargos + benefícios) | Sócio sabe vagamente | Agente calcula determinístico (cruzamento com folha interna) | Automatizar | Alta |
| 18 | Cálculo de margem por cliente | Sócio não calcula sistematicamente | Agente calcula + ranqueia clientes por margem; humano valida e decide ajuste | Assistir humano | Alta |
| 19 | Identificação de cliente deficitário + proposta de ajuste | Sócio percebe por intuição | Agente identifica + propõe (renegociar valor, reduzir escopo, ou descontinuar); humano decide | Assistir humano | Média |
| 20 | Folha interna do escritório | Equipe processa quando sobra tempo | Mesma automação que Pessoal — agente roda folha + transmite eSocial + gera holerites | Automatizar | Alta |
| 21 | Pró-labore do sócio | Calculado mensal | Agente calcula com base no acordado entre sócios | Automatizar | Alta |
| 22 | Pagamento de prestadores PJ/MEI | Assistente paga | Agente lembra vencimento, gera ordem de pagamento; humano confirma | Assistir humano | Alta |
| 23 | Gestão de benefícios (VR/VA/plano) | Assistente compra créditos mensais | Agente lembra + gera ordem de compra; humano valida | Assistir humano | Alta |
| 24 | DRE gerencial mensal | Sócio puxa do sistema | Agente gera versão gerencial customizada (sem termos contábeis técnicos) | Automatizar | Alta |
| 25 | Indicadores (ticket médio, churn, margem, etc) | Sócio calcula manualmente quando lembra | Agente roda contínuo + envia resumo mensal ao sócio | Automatizar | Alta |
| 26 | Análise mês a mês | Sócio compara manual | Agente compara + sinaliza variação relevante + interpreta causa via histórico | Automatizar | Alta |
| 27 | Projeção anual (orçamento) | Sócio faz em planilha | Agente projeta + simula cenários (contratação nova, perda de N clientes); humano valida | Assistir humano | Média |
| 28 | Análise de viabilidade de contratação nova | Sócio decide intuitivo | Agente simula impacto financeiro (custo da contratação × receita marginal esperada); humano decide | Assistir humano | Média |
| 29 | DAS / impostos do próprio escritório | Mesma rotina Fiscal aplicada ao CNPJ do escritório | Mesmo agente Fiscal — escritório vira "cliente de si mesmo" no sistema | Automatizar | Alta |
| 30 | Sugestão de precificação pra serviço novo | Sócio chuta com benchmarking pessoal | Agente sugere via base de mercado pública + histórico do escritório; humano decide | Assistir humano | Baixa |

**Total: 30 linhas.** Distribuição:

| Bucket | Linhas | % |
|---|---|---|
| Automatizar | 13 | 43% |
| Assistir humano | 14 | 47% |
| Fora de escopo | 3 | 10% |

**% Automatizável** = 43% + 23% = **66%**.

## (d) O que NÃO dá pra automatizar e por quê

1. **Decisão de cortar serviço a cliente em inadimplência** — decisão estratégica do sócio (relação, histórico, potencial de retorno).
2. **Negociação de parcelamento** — relação delicada, cada caso é único.
3. **Encaminhamento à cobrança jurídica** — decisão grave, custo alto, relação rompida.
4. **Decisão de precificação final pra serviço novo** — depende do "feeling" do sócio sobre o cliente, sua margem desejada, posicionamento do escritório.
5. **Decisão sobre contratação nova / demissão** — decisão humana, varia por relação pessoal e estratégia.
6. **Decisão sobre composição societária do próprio escritório** — sócios decidem sozinhos.

## (e) Como esse departamento conversa com os outros

Diferentemente dos outros, Financeiro Interno **consome** mais do que **gera**:

- **Atendimento** é canal de cobrança e comunicação com cliente final (envia boleto, lembrete, cobrança formal)
- **Pessoal** processa folha interna (mesma rotina dos clientes, aplicada ao CNPJ do escritório)
- **Contábil** lança movimento financeiro do escritório (NFS-e emitida, despesa paga, custo de pessoal) — escritório vira "cliente de si mesmo"
- **Fiscal** apura impostos do escritório (DAS Anexo III ou V, depende da composição de serviços)
- **Societário** processa eventos societários do próprio escritório (raros, mas acontecem — alteração de contrato social, entrada de sócio)
- Recebe sinal de outros departamentos sobre **trabalho extra realizado** (Societário fez alteração contratual → cobrar honorário extra)

Esboço de fluxo (faturamento mensal):

```
Início do mês X
  → Orquestrador Financeiro Interno acorda
  → Apura clientes ativos + contratos vigentes + reajustes pendentes
  → Detecta serviços extras realizados no mês X-1 (vindo de Societário, Consultoria)
  → Gera NFS-e por cliente
  → Gera boleto/Pix
  → Atendimento envia ao cliente
  → Acompanha recebimento (conciliação automática extrato × NFS-e)
  → Aciona cobrança em escala de atraso
  → Reporta sócio: receita do mês, inadimplência, projeção
```

## (f) Como o agente desse departamento se encaixaria

**Topologia provável:** Coordenador + Especialistas + Orquestrador. Mais enxuto que outros — escala menor. Coordenador atende o sócio diretamente (ele é o "cliente" do agente). Especialistas: **Faturamento** (geração NFS-e + boleto), **Cobrança** (escalada de atraso), **Análise Financeira** (DRE gerencial, indicadores, margem por cliente), **Folha Interna** (reusa Especialista Cálculo do Pessoal). Orquestrador mensal pra ciclo de faturamento.

**Tier inicial:** **semi-autônomo é viável** em várias atividades — emissão de NFS-e rotineira, envio de boleto, conciliação, geração de relatório. Cobrança formal e reajuste anual seguem em **sugestivo**. Decisões estratégicas (corte, precificação) fora de escopo. **Tier pode ser mais agressivo aqui que nos outros departamentos** porque (a) o "cliente" é o próprio sócio (auto-fiscalização imediata) e (b) erro tem impacto financeiro recuperável, não regulatório.

**Volume típico:** **médio-baixo**. Escritório com 30-100 clientes = 30-100 NFS-e/mês + folha interna mensal + cobrança contínua + relatório mensal. Eventos de cobrança variam com inadimplência (5-15 clientes em atraso típicos [estimativa]).

**Chamadas LLM por operação:** **baixas**. Cálculos são determinísticos. LLM entra pra (a) negociação de cobrança (geração de mensagem amistosa vs formal), (b) interpretação de causa de variação em DRE, (c) sugestão de precificação. Estimativa: **0 LLM em rotina, 1-3 LLM em comunicação e análise** [estimativa].

**Risco regulatório:** **baixo**. Erro interno fica interno — não há multa de Receita Federal por má gestão de cobrança do próprio escritório. Risco real é (a) relação com cliente (cobrança mal-feita perde cliente) e (b) erro fiscal do próprio CNPJ (mas aí é o módulo Fiscal aplicado a ele mesmo).

## (g) Tamanho do impacto comercial

[estimativas]

- **Tempo do escritório consumido por Financeiro Interno**: **5-15% do tempo total** num escritório típico [estimativa]. Tipicamente "trabalho que sobra" — não é foco.
- **% da receita vinda de Financeiro Interno**: zero (atende o próprio escritório, não cliente). O **valor** está na **gestão do negócio** do sócio, não em receita direta.
- **Dias "pegando fogo"**: dias 1-5 do mês (faturamento + envio), dias 25-30 (vencimento dos boletos), encerramento anual (orçamento). Total: **~5-7 dias/mês de pressão real**.
- **Sensibilidade a erro**: baixa em curto prazo (erro interno é corrigível), média em longo prazo (sócio sem visão financeira toma decisão errada).
- **Diferencial competitivo**: nulo do ponto de vista de venda externa. **Mas alavanca interna** — sócio com visão financeira clara fecha mais clientes melhores e perde menos.

### Particularidade comercial

- **Comprador é o sócio do escritório.** Decisor único. Ciclo de venda curto. Não depende de aprovação de equipe.
- **Valor percebido baixo por colaboradores.** Equipe operacional não vê benefício direto (eles não cobram, não decidem precificação).
- **Pode não vender em escritório pequeno (1-3 pessoas).** Sócio faz tudo, não percebe valor de automatizar. Vende melhor em escritório que cresceu (8+ pessoas) onde a gestão deixa de ser intuitiva.
- **Vende em conjunto.** Faz mais sentido oferecer Financeiro Interno **junto** com outro departamento, não isolado.

---

## Síntese (pra alimentar o mapa comparativo)

- Volume: **Médio** (mensal × 1 organização — o próprio escritório)
- Dor escritório: **Baixa-Média** (cobrança incomoda, mas não consome 30% do tempo)
- Risco regulatório: **Baixo** (escritório é seu próprio cliente; risco fiscal cai no módulo Fiscal aplicado a si mesmo)
- % Automatizável: **66%** (alto)
- Complexidade técnica: **Baixa** (reusa muito do Pessoal/Contábil/Fiscal — escritório vira "cliente de si mesmo"; integrações são NFS-e municipal e gateway de pagamento)
- Tempo de implementação: 3-5 sprints × 2-3 semanas ≈ **2-3 meses** [estimativa]
- Risco de venda: **Baixo a sócio (decisor único, vê valor), médio em escritório pequeno (sócio faz tudo)**
- **Particularidade:** atende o sócio, não cliente. Pode ir em paralelo a outros departamentos como módulo "leve" da plataforma
