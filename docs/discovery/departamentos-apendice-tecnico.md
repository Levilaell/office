# Departamentos — Apêndice técnico

> Sprint Mapa de Departamentos, Tarefa 8.
> Documento técnico, NÃO pra sócio. Padronizado pra consumo em Sprint X.0-discovery
> de cada departamento (entrada da Fase 2/3/4/5).
>
> Jargão técnico de software permitido aqui (microservice, RLS, BullMQ, embedding,
> schema) — diferente das fichas de departamento em `docs/discovery/departamentos/`.

## Convenção de leitura

Cada departamento tem:
- **Topologia de agentes** (Coordenador + Especialistas + Orquestrador? Quantos?)
- **Estimativa de chamadas LLM** (por dia, por operação, por mês — extrapolar custo)
- **Integrações externas necessárias** (com prioridade — quais primeiro)
- **TDs que afetam** (do `docs/tech-debt.md` atual)
- **Estimativa em sprints** (com granularidade)
- **Dependências** (depende de quê / habilita quê)

Quando Sprint X.0-discovery de departamento abrir, este apêndice é a base.

---

## Atendimento (já implementado)

### Topologia atual
- Camada `platform`: **Roteador** (Haiku 4.5, autônomo)
- Camada `atendimento`: **Coordenador** (Haiku 4.5 + Sonnet 4 em cascade), **Especialista Operacional** (Sonnet 4), **Especialista Comercial** (Sonnet 4)
- Sem Orquestrador (turn-a-turn é suficiente)
- ChannelAdapter como abstração entre canais externos e ingest domain

### Chamadas LLM (dados reais)
- Custo médio por triagem: ~USD 0.0008 (Haiku 4.5, prompt v1.1.0)
- Latência ponta a ponta: 2-3s
- Volume estimado por tenant (4-15 pessoas, 30-100 clientes): 50-200 mensagens/dia → ~USD 1-5/mês por tenant

### Integrações
- ChannelAdapter abstrato (Sprint 1.1)
- Adapter simulado (entregue, em produção)
- Adapter Evolution WhatsApp: **placeholder** — abrir ADR antes de implementar
- Adapter IMAP/SMTP e-mail: **placeholder** — Fase 1.5+
- Tools read-only: `getAccountSnapshot`, `getObligationsForAccount`, `getDocumentsForAccount`

### TDs abertos relevantes
- TD-030: catálogo `obligation_type` e `document_type` (afeta Especialista Operacional + Pessoal + Fiscal futuros)
- TD-031: storage de arquivos (afeta extração de documento — Pessoal, Contábil, Fiscal)
- TD-032: ✅ fechado (RLS Fase 1)
- TD-033: HUD viewport-aware (não bloqueia outros departamentos)
- TD-034: auto-login modo demo
- TD-035: cleanup automatizado de tenant demo

### Schema relevante
- `conversations`, `messages`, `conversation_classifications`, `leads`, `drafts`, `approvals`
- `agents`, `agent_runs`, `agent_messages` (gerais — usado por todos)
- `audit_log` (geral)

### Dependências
- Habilita: todos os outros departamentos (porta de entrada via canal)
- Depende de: kernel de agentes (Fase 0)

---

## Societário (planejado, 5 sprints)

### Topologia (ADR-023)
- **Coordenador Societário** (Sonnet 4 default, Haiku pra classificação inicial) — turn-a-turn, recebe `message.routed` com `destinationDepartment='societario'`
- **Orquestrador** (Sonnet 4, agente persistente acordado por cron + eventos) — **novo padrão**: agente dorme entre passos do processo, acorda por evento ou tick
- **Especialista Documental** (Sonnet 4) — gera minutas, contratos, dossiês
- **Especialista Operacional** (Sonnet 4) — interage com Portal Adapters
- **Especialista Jurídico** (Opus 4.7, raro) — interpretação jurídica complexa
- **Portal Adapter** (abstração nova) — interface comum entre processo e portal externo (Junta, Receita, Prefeitura, Sefaz)

### Chamadas LLM
- Processo simples (alteração de capital): 5-15 chamadas total (gerar minuta + classificação + revisão)
- Processo complexo (transformação societária — fora de escopo): 30+ chamadas
- Volume estimado por tenant: 30-200 processos/ano (1-2 por cliente)
- Custo estimado: USD 0.5-2 por processo simples [estimativa]

### Integrações
- Sprint 2.3 entrega: `ReceitaConsultaCnpjAdapter` (read-only), `JuncaConsultaPublicaAdapter` (JUCESP read-only), `DbeSubmissionAdapter`, `ConectaJusbrAdapter`
- Outras Juntas (JUCEPAR, JUCEMG, JUCERJ, etc): trabalho recorrente posterior
- Prefeituras e Sefaz: "Assistir humano" — humano protocola, agente prepara dossiê
- Integra Contador: opcional, ADR pendente

### TDs que afetam
- TD-030 (catálogo obligation_type — tem `societaria` mas precisa expandir)
- Nenhum TD novo crítico

### Schema (ADR-024)
- `legal_processes` (id, tenant_id, account_id, template, status, current_step, started_at)
- `process_steps` (id, legal_process_id, step_key, status, requires_approval, params JSONB, dependencies JSONB)
- Extensões a `documents` e `obligations` (FK `legal_process_id` opcional)
- Workflow engine: **BullMQ + cron + state em tabela** (ADR-022, sem Temporal)

### Sprints (5 sprints, ~11 semanas)
- 2.1 Fundações (2 sem)
- 2.2 Orquestrador + 3 templates (3 sem)
- 2.3 Primeiro Portal Adapter — Receita pós-Junta (2 sem)
- 2.4 Modo shadow + tiers (2 sem)
- 2.5 Visual + demo (2 sem)

### Dependências
- Habilita: padrão de workflow longo (reusável em Pessoal/Fiscal), Portal Adapter (reusável)
- Depende de: Atendimento (canal), Calendário rudimentar (Fase 0), módulo de aprovações (Fase 1)

---

## Pessoal/Folha (estimado)

### Topologia provável
- **Coordenador** (Sonnet 4 / Haiku cascade)
- **Especialista Cálculo** (Sonnet 4) — folha, rescisão, férias, 13º, verbas
- **Especialista eSocial** (Sonnet 4) — validação contra layout vigente, transmissão, interpretação de rejeição
- **Especialista Trabalhista** (Opus 4.7 raro) — CCT, jurisprudência, casos atípicos
- **Orquestrador** (reusa ADR-023) — rotina mensal acordada por cron (dia 1 abre, dia 5 fecha, dia 7 transmite, dia 15 DCTFWeb)

### Chamadas LLM
- Operação rotineira (folha mensal): 0 LLM no caminho determinístico
- Operação de exceção (rejeição eSocial, divergência apontamento): 2-5 LLM
- Atendimento de dúvida funcionário/cliente: 1-3 LLM
- Volume estimado por tenant: 200-1.500 eventos/mês
- Custo estimado: USD 5-20/mês por tenant [estimativa]

### Integrações
- eSocial (transmissão XML) — **alta prioridade**, requer cert. A1/A3 do cliente
- FGTS Digital — alta prioridade
- DCTFWeb — alta prioridade
- Conectividade Social — média prioridade
- Sistema legado de folha (Domínio Sistemas, Alterdata, Sage Folhamatic, Questor) — alta prioridade pra leitura/escrita
- INSS portal (consulta) — média prioridade
- Plataforma de ponto eletrônico (importação) — baixa prioridade inicial

### TDs que afetam
- TD-030 (catálogo `obligation_type` precisa de eventos eSocial S-1200, S-1299, etc)
- TD-031 (storage de arquivos pra OCR de documento de admissão)
- Suite RLS pra novas tabelas — pattern já estabelecido em Fase 2-prep

### Schema (estimado, abre ADR antes)
- `employees` (id, tenant_id, account_id, vínculo, salário, função, CCT, cert)
- `payroll_runs` (mensal, por account_id)
- `payroll_items` (provento/desconto por employee × payroll_run)
- `esocial_events` (S-2200, S-1200, S-2299, etc — status, payload, rejeição)
- `obligations` ganha eventos específicos eSocial

### Sprints (5-7 sprints, 3-4 meses)
- 3.1 Fundações (schema, Coordenador, intent catalog)
- 3.2 Cálculo determinístico (folha simples, férias, 13º, geração de guia)
- 3.3 Integração eSocial (S-2200 admissão como primeiro, depois S-1200/1299 rotineiro)
- 3.4 Rescisão + S-2299 (caso minado, validação rigorosa)
- 3.5 Modo shadow + tier (reusa ADR-017)
- 3.6 Visual + integração no escritório virtual (sala Pessoal)
- 3.7 (opcional) Eventos SST (S-2210/2220/2240)

### Dependências
- Habilita: DCTFWeb consolidada (Fiscal reusa), Calendário rico (mensal + esporádico)
- Depende de: Orquestrador (Societário entrega), workflow engine (Societário entrega), Portal Adapter pattern (Societário entrega)

### Particularidade
- Alto risco regulatório justifica `eval` real com LLM em mudança de prompt (ver TD-015 do Coordenador). Aplicar suite de eval antes de promover qualquer prompt v2.x do Especialista Cálculo ou eSocial.

---

## Contábil (estimado)

### Topologia provável
- **Coordenador** (Sonnet 4 / Haiku cascade)
- **Especialista Lançamentos** (Sonnet 4) — classificação + lançamento determinístico
- **Especialista Conciliação** (Sonnet 4) — matching algorítmico + tratamento de exceção
- **Especialista Apuração** (Sonnet 4) — DRE, balancete, IRPJ/CSLL Presumido/Real
- **Especialista SPED** (Sonnet 4) — geração e validação de ECD/ECF
- **Especialista Política Contábil** (Opus 4.7, raro) — interpretação CPC, política de provisão
- **Orquestrador** — fim de competência, fim de exercício

### Chamadas LLM
- Classificação rotineira (NF padrão): 0 LLM em 70% dos casos (regra + histórico)
- Classificação de exceção: 1-3 LLM
- Tratamento de divergência de conciliação: 1-3 LLM
- Apuração trimestral/anual com ajustes (Lucro Real): 5-15 LLM
- Volume estimado por tenant: milhares de lançamentos/mês
- Custo estimado: USD 10-50/mês por tenant [estimativa]

### Integrações
- ERPs/sistemas contábeis legados (Domínio, Alterdata, Sage, Questor) — **alta prioridade**, varia por base de cliente do escritório
- ContaAzul, Omie — média prioridade (clientes que usam)
- Open Finance / OFX (conciliação bancária) — alta prioridade
- SPED ECD/ECF (transmissão) — alta prioridade (anual)
- Bancos diretos (consulta extrato) — média prioridade

### TDs que afetam
- TD-030 (catálogo `document_type` pra NF-e, recibo, contrato)
- TD-031 (storage pra documentos de cliente)

### Schema (estimado)
- `accounting_entries` (lançamentos contábeis, particionado por tenant + competência)
- `chart_of_accounts` (plano de contas por tenant + customização por account)
- `bank_reconciliations` (extrato × lançamento)
- `accounting_periods` (competências abertas/fechadas)
- `financial_statements` (DRE, balancete, balanço gerados)

### Sprints (6-9 sprints, 4-6 meses)
- 4.1 Fundações
- 4.2 Importação NF-e + classificação rotineira (alvo: 70% determinístico)
- 4.3 Conciliação bancária (matching + tratamento de exceção)
- 4.4 Apuração mensal (DRE, balancete)
- 4.5 Apuração de impostos sobre lucro (Presumido + Real)
- 4.6 Fechamento de competência + provisões
- 4.7 ECD + ECF (transmissão SPED)
- 4.8 Modo shadow + tier
- 4.9 Visual + integração escritório virtual

### Dependências
- Habilita: dados pra atendimento ao banco/financeira (consultadas via tools)
- Depende de: integrações com sistemas legados maduras, Pessoal entregando folha (despesa de pessoal)

### Particularidade
- **Risco de venda alto.** Posicionamento crítico: "ampliação", não "substituição". Marketing precisa enfatizar contador continua dono da política contábil; agente faz repetição.

---

## Fiscal (estimado)

### Topologia provável
- **Coordenador**
- **Especialista Apuração Simples** (Haiku 4.5 ou Sonnet 4) — DAS, DEFIS, sublimite (alta automação determinística)
- **Especialista Apuração Lucro Presumido** (Sonnet 4) — PIS/COFINS cumulativo, IRPJ/CSLL presumido, ICMS
- **Especialista Apuração Lucro Real** (Opus 4.7 ou Sonnet 4) — PIS/COFINS não-cumulativo com créditos, LALUR
- **Especialista SPED Fiscal/EFD-Reinf/DCTFWeb** (Sonnet 4)
- **Especialista ICMS Estadual** (Sonnet 4 + base por UF) — heterogêneo, começar SP
- **Especialista Tributário** (Opus 4.7 raro) — simulação de regime, planejamento
- **Orquestrador** — apuração mensal por cliente, prazo cíclico

### Chamadas LLM
- Apuração rotineira: 1-3 LLM (validação cruzada, sinalização)
- Apuração de exceção (NCM duvidoso, regime especial, ST/DIFAL atípico): 5-15 LLM
- Resposta a notificação: 10-30 LLM (geração de defesa)
- Volume estimado por tenant: 150-1.500 apurações/mês
- Custo estimado: USD 15-60/mês por tenant [estimativa]

### Integrações
- PGDAS-D via Integra Contador (Receita Federal) — alta prioridade
- EFD-ICMS/IPI por UF (Sefaz) — alta prioridade, começar SP
- EFD-Reinf — alta prioridade
- DCTFWeb — alta prioridade (consolida eSocial e Reinf)
- NFS-e ABRASF (5% dos municípios) — média prioridade
- NFS-e municipais proprietários — baixa prioridade (manual)
- Sistemas contábeis legados (recepção de NF-e XML)

### TDs que afetam
- Mesmos que Contábil
- Eval real de LLM crítico (TD-015 pattern aplicado)

### Schema (estimado)
- `tax_apurations` (por account × competência × tributo)
- `tax_obligations_log` (entregas e prazos)
- `tax_documents` (DAS, DARF, GIA, EFDs)

### Sprints (8-12 sprints, 5-7 meses)
- 5.1 Fundações
- 5.2 Simples Nacional (DAS, DEFIS, sublimite) — caso "mais determinístico"
- 5.3 Lucro Presumido (PIS/COFINS, IRPJ/CSLL, ICMS básico)
- 5.4 Lucro Real (não-cumulativo, LALUR)
- 5.5 ICMS estadual (começar SP, deixar pattern pra outros)
- 5.6 SPED Fiscal + EFD-Reinf + DCTFWeb (consolidação)
- 5.7 NFS-e municipais (ABRASF)
- 5.8 Resposta a notificação (defesa administrativa)
- 5.9 Simulação de regime (planejamento tributário leve)
- 5.10 Modo shadow + tier (mais conservador)
- 5.11 Visual + integração escritório virtual
- 5.12 (opcional) Outras UFs ICMS

### Dependências
- Habilita: nada novo arquitetural — é consumidor pesado de tudo
- Depende de: Pessoal (DCTFWeb consolidada), Contábil (resultado pra Real), Atendimento (canal pra envio de DAS/DARF), Calendário rico

### Particularidade
- **Maior risco regulatório.** Tier sempre sugestivo/manual em apurações complexas. Estrutura "humano sempre antes" deve ser regra padrão, com semi-autônomo só em apurações determinísticas (Simples DAS) após validação prolongada.

---

## Financeiro Interno (estimado)

### Topologia provável (enxuta)
- **Coordenador** — atende o sócio diretamente (cliente único)
- **Especialista Faturamento** — NFS-e + boleto + cobrança em escala
- **Especialista Análise Financeira** — DRE gerencial, margem, indicadores
- **Especialista Folha Interna** — **reusa Especialista Cálculo do Pessoal** aplicado ao próprio CNPJ
- **Orquestrador** mensal (faturamento, cobrança, relatório)
- Sem Especialista Jurídico

### Chamadas LLM
- Operação rotineira (faturamento, cobrança automática): 0-1 LLM
- Análise de variação em DRE: 1-3 LLM
- Negociação de cobrança / precificação: 1-3 LLM
- Volume baixo — escritório atende a si mesmo (não × N clientes)
- Custo estimado: USD 1-5/mês por tenant [estimativa]

### Integrações
- NFS-e municipal (mesmo padrão que Fiscal vai entregar)
- Gateway de pagamento (Asaas, Pagar.me, Stripe, etc) — alta prioridade
- Open Finance (conciliação bancária do escritório) — média prioridade
- IGPM/IPCA (consulta pública pra reajuste) — baixa prioridade
- Reusa Pessoal/Contábil/Fiscal aplicados ao CNPJ do próprio escritório

### TDs que afetam
- Mínimos — reusa muito

### Schema (estimado)
- `client_contracts` (contrato escritório × cliente final)
- `invoices` (NFS-e emitidas pelo escritório)
- `payments` (recebimentos)
- `internal_expenses` (despesas internas)
- `profitability_metrics` (apuração de margem)

### Sprints (3-5 sprints, 2-3 meses)
- 6.1 Fundações (schema, Coordenador, intent catalog)
- 6.2 Faturamento + boleto/Pix + envio
- 6.3 Cobrança escalada (lembrete + cobrança formal)
- 6.4 Análise financeira (DRE gerencial, margem, indicadores)
- 6.5 (opcional) Folha interna + DAS do escritório (reusa Pessoal/Fiscal)

### Dependências
- Habilita: vitrine pro sócio (decisor único)
- Depende de: idealmente Pessoal (folha interna) e Fiscal (DAS interno) já entregues; mas pode rodar em paralelo com versão "manual" desses sub-passos

### Particularidade
- **Pode rodar em paralelo** a partir do meio da Fase 2 (Sprint 2.3+). Capacidade técnica baixa, reusa muito. Vende ao sócio.

---

## Dependências cruzadas entre departamentos

```
                                  ┌─────────────┐
                                  │  Roteador   │
                                  │  (platform) │
                                  └──────┬──────┘
                                         │
                              ┌──────────┴──────────┐
                              │                     │
                       ┌──────▼──────┐       ┌─────▼─────┐
                       │ Atendimento │       │ Outros 5  │
                       │   (Fase 1)  │       │ depts     │
                       └──────┬──────┘       └─────┬─────┘
                              │                    │
                              │ canal entrada      │
                              │ pra todos          │
                              ▼                    ▼
              ┌─────────────────────────────────────────┐
              │       Estado canônico compartilhado     │
              │  (accounts, obligations, documents,     │
              │   employees, payroll_runs, accounting,  │
              │   tax_apurations, legal_processes, ...) │
              └─────────────────────────────────────────┘
                  ▲             ▲              ▲
                  │             │              │
              ┌───┴───┐    ┌────┴───┐     ┌────┴────┐
              │Pessoal│    │Contábil│     │ Fiscal  │
              └───┬───┘    └────┬───┘     └────┬────┘
                  │             │              │
                  │ folha       │ resultado    │ apuração
                  │ gera        │ fecha        │ consolida
                  │ DCTFWeb     │ competência  │ tudo
                  └─────────────┴──────┬───────┘
                                       │
                              ┌────────▼────────┐
                              │   Calendário    │
                              │   compartilhado │
                              └─────────────────┘

       ┌────────────┐                ┌──────────────────┐
       │ Societário │                │Financeiro Interno│
       │ (paralelo  │                │ (paralelo —      │
       │  pré-Pessoal│               │  atende só sócio)│
       │  pra padrões)│               │                  │
       └────────────┘                └──────────────────┘
```

### Padrões compartilhados que vão emergir

1. **Orquestrador (agente persistente acordado por evento)** — introduzido pelo Societário (ADR-023). Reusado por Pessoal (rotina mensal), Fiscal (apuração mensal), Contábil (fim de competência), Financeiro Interno (faturamento mensal).

2. **Workflow engine BullMQ + cron + state em tabela** — introduzido pelo Societário (ADR-022). Reusado por todos os outros que tenham processo multi-passo de mais de um dia.

3. **Portal Adapter** — introduzido pelo Societário (Receita pós-Junta, JUCESP). Reusado/adaptado por Pessoal (eSocial, FGTS Digital), Fiscal (PGDAS-D, EFDs, NFS-e), Contábil (SPED ECD/ECF), Financeiro Interno (gateway de pagamento, NFS-e municipal pra próprio CNPJ).

4. **ChannelAdapter** — introduzido pela Fase 1 (Atendimento). Reusado por todos como canal de entrada.

5. **Tools read-only sobre domínio compartilhado** — introduzidos pela Fase 1 (Especialista Operacional). Reusado por todos pra consulta cruzada.

6. **Modo shadow + materializeProposal** — introduzido pela Fase 1 (Sprint 1.5). Reusado por todos.

7. **Tier de autonomia configurável por agente** — introduzido pela Fase 1 (ADR-017). Reusado por todos com defaults conservadores por departamento.

8. **`audit_log` com `trace_id`, `cost_usd`, `prompt_version`** — introduzido pela Fase 0. Reusado por todos como requisito não-negociável.

### Implicação pra discovery de cada próximo departamento

Sprint X.0-discovery do departamento escolhido começa identificando:

1. Quais dos 8 padrões compartilhados são **reusados sem ajuste**
2. Quais precisam de **extensão pontual** (novo evento, nova abstração de Portal Adapter)
3. Quais introduzem **novo padrão arquitetural** (raro depois do Societário entrar)

Pra Pessoal: reusa todos os 8. Provavelmente extensão pontual em Portal Adapter (eSocial é mais complexo que Junta Comercial).

Pra Contábil: reusa todos os 8. Provavelmente extensão de tools (importação OFX como tool primitiva).

Pra Fiscal: reusa todos os 8. Provavelmente extensão em Portal Adapter (PGDAS-D, EFDs, NFS-e ABRASF — vários no mesmo departamento).

Pra Financeiro Interno: reusa todos os 8 + Pessoal/Contábil/Fiscal já implementados. Mínimo trabalho arquitetural; muito trabalho de UX pro sócio.
