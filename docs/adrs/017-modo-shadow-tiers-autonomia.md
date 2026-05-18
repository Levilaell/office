# ADR-017: Modo shadow e tiers de autonomia em conversa síncrona

Data: 2026-05-18
Status: aceito

## Contexto

A plataforma define (princípio 7) autonomia configurável em 4 tiers por agente por tenant: **manual / sugestivo / semi-autônomo / autônomo**. O sistema de aprovação humana da Fase 0 funciona bem pra ações em batch (executar DCTFWeb, gerar guia, etc) onde latência de aprovação não impacta o cliente final.

Em **chat ao vivo (WhatsApp, e-mail)**, a semântica de aprovação é diferente:

- Cliente final está esperando resposta — latência alta vira problema de UX
- Volume de mensagens é alto — aprovação síncrona pra cada uma cansa o operador humano
- Nem toda mensagem do agente é "ação de impacto externo" no sentido regulatório (responder "bom dia" não exige aprovação formal)
- Mas mensagens com dados fiscais/financeiros do cliente final exigem cuidado — agente errado pode passar valor errado, prazo errado, info regulatória incorreta

A questão: como aplicar tiers de autonomia em conversa síncrona sem nem travar o fluxo (sugestivo aplicado a tudo) nem expor o tenant (autônomo aplicado a tudo)?

## Decisão

Em departamento de Atendimento, o sistema opera em **modo shadow** como default, com semântica adaptada por tier:

**Tier sugestivo (default Fase 1):**
- Agente gera resposta
- Resposta vira `message_draft` com `status=pending`, visível no inbox do operador
- Inbox mostra: rascunho, reasoning do agente, confidence, expiração
- Operador escolhe: Aprovar (→ envia), Editar (→ envia versão editada, edit_diff salvo), Rejeitar (→ não envia, agente pode reavaliar)
- Draft expira em 5 minutos (configurável). Expirou = escala humano ou some, conforme contexto.

**Tier semi-autônomo:**
- Agente gera resposta
- Resposta envia direto via canal
- Registro ainda criado em `message_drafts` com `status=approved, resolved_by=null` (rastreabilidade)
- Operador vê histórico de "respostas automáticas" em inbox filtrado, pode intervir se vir erro

**Tier autônomo:**
- Não exposto na Fase 1 pra Atendimento
- Reserva pra Fase 2+ quando confiança operacional estiver consolidada

**Tier manual:**
- Não exposto na Fase 1 pra Atendimento
- Não faz sentido em chat ao vivo: se humano vai compor toda resposta, o agente vira só sugestão passiva — não justifica complexidade na Fase 1

**Exceções: regras de "sempre humano":**

Independente do tier configurado pelo tenant, certos intents **sempre** passam por aprovação humana (vira draft mesmo em semi-autônomo):

- `operacional.duvida_regime` (mudança de regime tributário — alto impacto)
- `urgente` (qualquer mensagem marcada como urgente)
- Mensagem com palavras-chave fiscais críticas (lista configurável: "multa", "auditoria", "processo", "intimação", "fiscalização")
- Confidence do agente abaixo de threshold (default 0.7)
- Erro de tool / dado faltando (agente sinaliza, vira humano)

**Tabela `message_drafts` é separada de `approvals`:**

`approvals` (Fase 0) é pra **ações de impacto externo regulatório** — executar obrigação, alterar cadastro no governo, etc. Tem semântica de "sem aprovação, nada acontece".

`message_drafts` (Fase 1) é pra **respostas em conversa síncrona** — alto volume, expiração curta, edição como operação primária. Semântica de "sem aprovação em prazo, ou some ou escala".

Manter tabelas separadas evita poluir o conceito original de `approvals` com semântica de chat.

## Alternativas consideradas

**A) Tudo em `approvals`:** unificar conceitualmente. Rejeitada porque expiração curta, edição, alto volume e ausência de impacto regulatório formal são semânticas diferentes que vão divergir cada vez mais.

**B) Tier sugestivo bloqueia até aprovação manual sem expiração:** cliente final fica esperando indefinidamente. Rejeitada — UX inaceitável em chat.

**C) Tier semi-autônomo sem registro em `message_drafts`:** mais simples. Rejeitada porque elimina rastreabilidade — operador não consegue revisar respostas automáticas, métricas ficam cegas, eval futuro fica sem material.

**D) "Sempre humano" como flag em `agent_policies` em vez de regras hardcoded:** mais flexível. Aceita parcialmente — palavras-chave críticas são configuráveis por tenant; intents sempre-humano ficam hardcoded no schema de intents (`default_assignee=human_handoff`) e podem ser overrides por tenant.

## Consequências

**Positivas:**
- Tenant pode começar conservador (sugestivo) e migrar pra semi-autônomo conforme ganha confiança — onboarding natural
- Modo shadow é padrão validado de rollout de IA em customer service (ML cred)
- Métricas de aprovação/edição/rejeição são sinais fortes pra promover ou degradar tier automaticamente no futuro
- Exceções por intent garantem segurança regulatória mesmo no tier mais autônomo
- Separação `message_drafts` ↔ `approvals` mantém conceitos limpos

**Negativas:**
- Tenant em sugestivo precisa de operador humano disponível pra aprovar — fora de horário comercial é dor (mitigação: T13 + escalação)
- Threshold de confidence em prompt do agente exige calibração — agentes propensos a alta confidence injustificada quebram o sistema. Mitigação via eval contínuo.
- Lista de palavras-chave críticas é fonte de manutenção contínua (LGPD, novas regulamentações etc)
- Dois caminhos de aprovação (drafts vs approvals) no produto pode confundir operador novo. UI precisa distinguir claramente.

**Restrições de implementação:**
- Default de novo tenant: sugestivo em todos os 3 agentes de Atendimento
- Mudança de tier requer permissão de owner ou manager do tenant (não operador)
- Toda mudança de tier registra em `audit_log` com user_id + before/after
- Em rejeição de draft pelo operador, agente pode reavaliar com prompt extra ("operador rejeitou esta sugestão: [razão opcional]"). Refinamento: Sprint 1.5.
