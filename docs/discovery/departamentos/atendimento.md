# Departamento Atendimento — Snapshot da Fase 1 (departamento já entregue)

> Sprint Mapa de Departamentos, Tarefa 5b.
> Documento estruturado igual aos outros, mas refletindo o que JÁ EXISTE
> (não o que escritório faz manualmente). Serve de **baseline real** pra
> comparar com os 5 departamentos a decidir.
> Detalhe técnico completo: `docs/sprint-reviews/1.6-escritorio-virtual-fecha-fase-1.md`.

## (a) O que esse departamento faz hoje (já implementado)

### Recepção de mensagem externa
1. Receber mensagem via canal externo (Sprint 1.1 entregou **ChannelAdapter** — abstração; canal simulado funcional, WhatsApp Evolution e e-mail estão placeholders pra Fase 1.5+)
2. Persistir mensagem em `conversations` + `messages` com `trace_id`
3. Publicar evento `message.received` no bus de eventos

### Triagem e classificação
4. **Roteador** (Haiku 4.5) classifica em um dos 6 departamentos (`atendimento`, `societario`, `pessoal`, `contabil`, `fiscal`, `financeiro_interno`) — agente único da camada `platform`
5. **Coordenador de Atendimento** filtra `message.routed` com `destinationDepartment='atendimento'` e classifica em 15 intents internas (operacional vs comercial vs escalation)
6. Persistir classificação em `conversation_classifications`

### Atendimento via Especialistas
7. **Especialista Operacional** responde dúvidas operacionais do cliente (DAS, INSS, prazo, holerite, status de obrigação) consultando ferramentas read-only do domínio compartilhado (`getAccountSnapshot`, `getObligationsForAccount`, `getDocumentsForAccount`)
8. **Especialista Comercial** qualifica lead novo via slot-filling (porte, regime, dor, urgência, contato), persiste em `leads`, transiciona status (`novo` → `qualificando` → `qualificado`)
9. Especialista publica proposta de resposta

### Modo shadow e aprovação
10. `materializeProposal` unifica fluxo: tier **sugestivo** cria `draft` pendente (humano aprova via Inbox); tier **semi_autônomo** envia direto e registra `auto_approved` (Sprint 1.5)
11. Worker de expiração de drafts pendentes
12. Inbox de drafts pendentes + UI de aprovação/edição/rejeição

### Visual e UX
13. Sala "Atendimento" no canvas isométrico (Sprint 1.6)
14. Badge de drafts pendentes no avatar
15. Pulse animation no agente em `working`
16. Animação de handoff entre agentes (Coordenador → Especialista)
17. HUD com saúde da sala (drafts pendentes count)
18. Página de detalhe de conversa (timeline + sidebar com intent/lead/drafts) — TD-027 fechado

### Onboarding e demo
19. Wizard de 3 passos pra tenant novo (identidade, horário, tier) — Sprint 1.6
20. Modo demo gateado por env com `/api/demo/trigger-scenario` (apresentação comercial)

### Auditoria
21. Toda chamada de LLM passa pelo wrapper `@office/shared-llm` que registra prompt versionado, modelo, latência, custo, `trace_id` no Langfuse
22. `audit_log` registra: `task.created`, `task.completed`, `task.failed`, `llm.call`, `message.received`, `message.routed`, `handoff.requested`, `handoff.accepted`, `draft.materialized`, `approval.decided`

**Total: 22 atividades implementadas em ~7 sprints (1.0 → 1.6).**

## (b) Dores do escritório que a Fase 1 endereça (em produto, não ainda em produção real)

**Volume de mensagens consome equipe.** Escritório de 4-15 pessoas atende dezenas de WhatsApps, e-mails e ligações por dia. Maioria é dúvida operacional repetitiva (DAS, prazo, segunda via de holerite, "recebeu meu documento?"). Coordenador classifica e Especialista Operacional responde sem operador.

**Lead novo descalibrado.** Cliente potencial chega sem contexto. Escritório gasta 15-30 min na primeira conversa pra entender porte, regime, dor. Especialista Comercial qualifica via slot-filling — operador recebe lead já com dossiê pronto.

**Risco de envio incorreto.** Pequeno escritório teme IA "responder errado" e perder cliente. Modo sugestivo (default) cria draft pendente e exige aprovação antes do envio — operador no controle.

**Auditoria pra cliente regulado.** Contabilidade é regulada (CFC). Toda interação fica registrada com `trace_id`, `cost_usd`, `prompt_version`. Permite reconstruir o que aconteceu e por quê.

**Configurabilidade por tier (ADR-017).** Cliente decide o nível de autonomia por agente. Escritório conservador deixa tudo sugestivo; quando ganha confiança, libera semi-autônomo na classificação ou em respostas operacionais simples.

## (c) Matriz: o que JÁ foi automatizado × o que ficou fora

| # | Atividade | O que humano fazia | O que IA faz hoje | Status na Fase 1 |
|---|---|---|---|---|
| 1 | Triagem inicial de mensagem | Operador lia, decidia departamento | Roteador classifica em departamento | **Automatizado** (Haiku 4.5, autonomo) |
| 2 | Classificação de intent dentro do Atendimento | Operador lia, decidia | Coordenador classifica em 15 intents | **Automatizado** (configurável por tier) |
| 3 | Resposta a dúvida operacional simples (DAS, INSS, holerite) | Operador puxava dado e respondia | Especialista Operacional consulta ferramentas + responde via draft | **Automatizado** (sugestivo default) |
| 4 | Qualificação de lead novo (slot-filling) | Operador entrevistava por 15-30 min | Especialista Comercial coleta slots por turnos | **Automatizado** (sugestivo default) |
| 5 | Persistência de lead com status | Operador anotava em CRM (ou esquecia) | Lead persistido em `leads`, transições rastreadas | **Automatizado** |
| 6 | Geração de draft de resposta | Operador escrevia | Especialista propõe; humano edita ou aprova no Inbox | **Automatizado** (com aprovação humana) |
| 7 | Aprovação de envio | Operador decidia "manda" | Inbox + aprovação explícita; auto-aprovação se semi_autônomo | **Implementado** (configurável) |
| 8 | Envio efetivo da resposta no canal | Operador enviava | ChannelAdapter envia (no canal simulado; WhatsApp Evolution falta) | **Parcial** — adapter funciona; canal real pendente |
| 9 | Auditoria de cada passo | Operador anotava informalmente | `audit_log` registra tudo com `trace_id`, custo, modelo, prompt versionado | **Automatizado** |
| 10 | Histórico de conversa visível | Aplicativo externo (WhatsApp Web, e-mail) | Página de detalhe (timeline + sidebar) | **Implementado** (read-only) |
| 11 | Envio manual da página de detalhe | (não existia o conceito) | Operador continua usando Inbox; envio manual ficou fora | **Fora de escopo Fase 1** |
| 12 | Notificação proativa ao cliente (proativa, sem mensagem prévia) | Operador disparava ad hoc | Coordenador da plataforma + Calendário (Fase 2+) | **Fora de escopo Fase 1** |
| 13 | Atendimento de funcionário do cliente | Operador atendia | Falta identidade do funcionário (segurança) | **Fora de escopo Fase 1** |
| 14 | Escalada para humano em caso de incerteza | Operador percebia | Coordenador detecta `intent='escalation'` e cria draft sinalizando | **Implementado** |
| 15 | Onboarding de tenant novo | Tutorial manual ou e-mail | Wizard 3 passos pós-criação Clerk org | **Implementado** (Sprint 1.6) |
| 16 | Modo demo pra venda comercial | PowerPoint | `/demo` + DemoTriggerWidget + seed de tenant demo | **Implementado** (Sprint 1.6) |
| 17 | Conexão real com WhatsApp/Telegram/etc | Conta WhatsApp do escritório | Placeholder no `ChannelAdapter`; canal simulado em produção | **Fora de escopo Fase 1** (Fase 1.5+) |
| 18 | Conexão real com e-mail (IMAP/SMTP) | Conta de e-mail do escritório | Placeholder | **Fora de escopo Fase 1** |
| 19 | Templates de resposta com edição de variáveis | Operador editava | Sem editor de templates (operador edita o draft livremente) | **Fora de escopo Fase 1** |

**Total: 19 linhas.** Distribuição:

| Bucket (Fase 1) | Linhas | % |
|---|---|---|
| Automatizado (entregue) | 13 | 68% |
| Parcial / configurável | 2 | 11% |
| Fora de escopo Fase 1 | 4 | 21% |

**% Automatizável efetivo da Fase 1** = 68% + 5.5% = **~73%**. Alinhado com a estimativa pública de Atendimento como "alta alavancagem".

## (d) O que ficou fora (e por quê)

1. **Envio manual pelo operador na página de detalhe** — sprint dedicado posterior (Fase 1.5+). Operador continua agindo via Inbox.
2. **Canais reais (Evolution WhatsApp, IMAP)** — exigem ChannelAdapter formal por canal + auth/secret/HMAC. ADR a abrir antes de implementar. Placeholder existe.
3. **Funcionário do cliente conversando direto com agente** — exige sistema de identidade do funcionário (não está no Clerk hoje, e dados sensíveis exigiriam controle adicional).
4. **Templates editáveis de resposta** — feature de produto pra escala. Não é necessário até base de clientes maior.
5. **Notificação proativa sem mensagem prévia** (calendário envia lembrete antes de obrigação vencer) — depende de calendário fiscal completo (Fase 2+, módulo plataforma).

## (e) Como esse departamento conversa com os outros (e vai conversar)

Hoje, Atendimento é o **único departamento operacional** — então não tem com quem conversar de fato. Mas a arquitetura já está pronta:

- **Atendimento** vai receber mensagem do cliente sobre folha (Pessoal) → encaminhar pra Pessoal via handoff de evento (futuro)
- **Atendimento** vai receber mensagem sobre alteração contratual (Societário) → encaminhar pra Societário (Fase 2.1 implementa o Coordenador Societário que recebe `message.routed` com `destinationDepartment='societario'`)
- **Atendimento** vai receber pergunta sobre DAS (Fiscal) → consultar Fiscal pra apurar (read-only)
- **Atendimento** vai enviar cobrança (Financeiro Interno) — Financeiro gera, Atendimento entrega via canal
- **Roteador** já classifica em todos os 6 departamentos; **falta Coordenador receber** em cada um

## (f) Topologia implementada (real, não estimada)

- **Roteador** — agente Haiku 4.5, autônomo, classifica mensagem em departamento. Único da camada `platform`. Seedado por tenant via webhook `organization.created` ou API síncrona.
- **Coordenador de Atendimento** — Haiku 4.5 pra classificação rápida + Sonnet 4 pra raciocínio (cascade). Tier configurável (default sugestivo).
- **Especialista Operacional** — Sonnet 4. Consulta tools read-only. Tier configurável.
- **Especialista Comercial** — Sonnet 4. Slot-filling. Tier configurável.
- **Sem Orquestrador** — Atendimento é turn-a-turn (responde rápido a evento). Orquestrador entra em Societário (e provavelmente Pessoal, Fiscal) onde há processos de longa duração.

**Custo médio observado:** ~**USD 0.0008 por triagem** (Haiku 4.5 com prompt v1.1.0) [dado real do desenvolvimento, com tráfego baixo]. Latência ponta a ponta **2-3s** [dado real].

**Cobertura de testes:** 533 testes totais pós-Fase 1 (unit + integration). Suite RLS específica (`tests/integration/rls-fase-1.test.ts`) cobre 8 tabelas.

## (g) Impacto comercial — dado parcial real, resto estimativa

**Estado real da Fase 1:**
- **Sprint timeline real:** Sprint 1.0 → 1.6 em **~3 meses** de execução com Levi solo
- **Cobertura funcional:** ~73% do que escritório faz manualmente em Atendimento (do escopo escolhido pra Fase 1)
- **Custo de IA real:** USD 0.0008/triagem; estimativa de 50-200 triagens/dia em escritório de 4-15 = **USD 1-5/mês por tenant** [estimativa]
- **TDs abertos relevantes:** TD-030 (catálogo obligation/document), TD-031 (storage de arquivos), TD-033 (HUD viewport-aware), TD-034 (auto-login demo), TD-035 (cleanup demo)

**Estimativa (sem dado de uso real ainda):**
- Tempo do escritório consumido por Atendimento: **15-30% do tempo total** [estimativa].
- % da receita do escritório vinda de Atendimento: zero direto (Atendimento sustenta os outros, não fatura sozinho).
- Diferencial: cliente percebe rapidez de resposta + não fica esperando "vou consultar e te retorno".

**Calibração da escala (Atendimento como âncora):**

Este departamento define a escala usada nos outros docs:
- Volume **altíssimo** = contínuo, mensagens chegam o dia inteiro
- Dor **alta** = consome 15-30% do tempo de equipe, prazo informal mas contínuo
- Risco **médio** = erro vira retrabalho/cliente irritado, não multa
- Complexidade **média** = 1-3 integrações (canal externo), workflow turn-a-turn (sem processo longo)
- % automatizável **~70%** entregue
- Implementação **~3 meses** com Levi solo, 6-7 sprints

---

## Síntese (pra alimentar o mapa comparativo)

- Volume: **Altíssimo** (mensagens contínuas)
- Dor escritório: **Alta**
- Risco regulatório: **Médio** (erro = retrabalho, sem multa)
- % Automatizável: **~73% entregue** (dado real)
- Complexidade técnica: **Média** (resolvida)
- Tempo de implementação: **~3 meses, 6-7 sprints** (dado real)
- Status: **Fase 1 concluída** (`v0.1.0-fase-0`)
- TDs abertos não-críticos
- Canais reais (WhatsApp Evolution, IMAP) faltam — Fase 1.5+
