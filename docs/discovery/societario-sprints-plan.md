# Societário — Plano de sprints da Fase 2

> Sprint Fase 2.0-discovery, Tarefa 8.
> Esboço de divisão da Fase 2 em sprints baseado nas descobertas.
> Reconciliação com estimativa de `escopo-produto.md` no fim.

## Princípios de planejamento

- Inspirado no padrão Fase 1 (foundations → especialistas → portal/canal → shadow → visual + demo)
- Cada sprint termina com algo demonstrável (não apenas refactor invisível)
- Cobre uma única decisão arquitetural não-trivial por sprint quando possível
- Premissa: Levi solo, ~1.5–2 semanas por sprint efetivo

## Sprint Fase 2.1 — Fundações do Societário (2 semanas)

### Objetivo

Schema do Societário (ADR-024) migrado, Coordenador Societário operacional via bus, primeira intent classificada ponta a ponta. Sem template real ainda.

### Entregas

- Migração `legal_processes` + `process_steps` + extensões a `documents`/`obligations` (FK `legal_process_id` opcional)
- Suite RLS pra novas tabelas (`tests/integration/legal-processes-rls.test.ts`)
- Coordenador Societário criado em código (ID, prompt v1.0.0, eventos)
- Subscriber `societario-coordenador-inbound` (paridade com Atendimento)
- Roteador global classifica `destination_department='societario'` corretamente (prompt já aceita, validar eval)
- Catálogo inicial de intents: `consulta`, `iniciar_processo`, `acompanhar_processo`, `urgente_juridico`
- Endpoint dev `/api/societario/simulate` (paridade com `inbound/simulate`)
- Seed agent `coordenador-societario` em todo tenant (script + migração)

### Dependências

- ADR-024 validado (este sprint discovery)
- Pré-Sprint 2.1 idealmente: sócio respondeu pelo menos as 11 perguntas críticas (`societario-perguntas-socio.md`). Sem isso, templates da 2.2 viram chute.

### Riscos

- Schema pode precisar de ajuste em campos JSONB (`params`, `dependencies`) após primeiro template real surgir. Mitigação: deixar campos abertos, validar via Zod em camada de aplicação.
- Eval do Roteador pra intents societários pode degradar accuracy de Atendimento — rodar bateria conjunta antes de merge.

---

## Sprint Fase 2.2 — Orquestrador + 3 primeiros templates (3 semanas)

### Objetivo

Orquestrador funcional acordado por cron + eventos. 3 templates codificados e executáveis ponta a ponta no fluxo "Assistir humano" (sem portal externo automatizado ainda).

### Entregas

- Agente Orquestrador (ID, prompt v1.0.0) + worker BullMQ (`process-orchestrator-tick.ts`)
- Cron tick configurável por tenant (default 5 min)
- 3 templates codificados em `packages/shared-domain/legal/templates/`:
  - **Alteração de capital social** (4 passos: gerar minuta → coletar assinaturas → protocolar Junta → confirmar deferimento)
  - **Atualização cadastral CNPJ via DBE** (3 passos: gerar DBE → assinar → confirmar)
  - **Alteração de sede intramunicipal** (5 passos: gerar minuta → coletar assinaturas → protocolar Junta → confirmar deferimento → atualizar Receita pós-Junta)
- Especialista Documental (gera minutas, contratos básicos)
- UI mínima `/dashboard/societario/processos` (lista, detalhe, status manual update)
- `audit_log` registra todas transições de `process_steps.status`

### Dependências

- Sprint 2.1 completa
- Sócio confirmou ordem prioritária de templates (perguntas A1, A2, A5, D21, D23)

### Riscos

- "Coletar assinaturas" passo manual + síncrono pode travar processo na espera do cliente. Mitigação: notificação automática (WhatsApp/email via Atendimento) lembrando cliente final, escalada após N dias.
- Template "atualização CNPJ via DBE" depende de `Especialista Documental` gerar XML válido. Validador rigoroso é trabalho real.

---

## Sprint Fase 2.3 — Primeiro portal automatizado: Receita pós-Junta + consultas (2 semanas)

### Objetivo

Primeiro Portal Adapter operacional. Atos "Automatizar" da matriz (linhas #7, #10, #13, #16, #23, #36) viram realidade — agente confirma deferimento na Junta e dispara DBE pós-Junta automaticamente.

### Entregas

- Abstração `PortalAdapter` em `packages/shared-domain/portals/` (contrato ADR-023)
- `ReceitaConsultaCnpjAdapter` (read-only, sem auth) — confirma situação cadastral pós-atualização
- `JuncaConsultaPublicaAdapter` (read-only, polling de status por NIRE em JUCESP) — primeira Junta apenas, expansão pra outras é trabalho recorrente
- `DbeSubmissionAdapter` (geração de DBE assinado quando certificado A1 disponível)
- `ConectaJusbrAdapter` (read-only, pré-flight de passivos judiciais)
- Tools dos agentes (Coordenador + Orquestrador) usando adapters via injeção
- Suite de teste de adapter com mocks de HTTP

### Dependências

- Sprint 2.2 completa
- Sócio confirmou estado dominante (B9, B13) — define qual Junta primeiro
- Confirmação de E29 (Receita pós-Junta automática) — define se 7 linhas da matriz são "Automatizar" ou "Assistir humano"

### Riscos

- Polling de Junta pode quebrar se layout HTML mudar. Mitigação: testes de regressão automáticos rodando em CI; alerta via Supervisor quando parser falha.
- DBE assinado pode rejeitar por CNAE/estrutura mal formada. Validador prévio crítico.

---

## Sprint Fase 2.4 — Modo shadow + tiers de autonomia em Societário (2 semanas)

### Objetivo

Aplicar ADR-017 (modo shadow + tiers) ao Societário. Tenant configura tier por agente; aprovações HITL fluem via `approvals` existente.

### Entregas

- `agent_policies` ganha registros pros novos agentes (Coordenador, Orquestrador, Especialistas)
- UI configuração de tier por agente do Societário (similar ao Atendimento)
- Default conservador: TODOS os agentes do Societário em **sugestivo** (mais conservador que Atendimento, justificado pela natureza regulatória)
- `approvals` enfileira corretamente quando step `requires_approval=true`
- Regras "sempre humano" pro Societário (lista hardcoded em código): cessão de quotas com ganho de capital > X, transformação societária, distrato com débitos pendentes detectados, qualquer step que altere estrutura societária (ie. quase tudo)
- UI mostra "rascunho aguardando você" em `/dashboard/aprovacoes` filtrado por origem `societario`
- Eval da fluência de aprovação (não trava processo de longa duração)

### Dependências

- Sprint 2.3 completa
- Tier mais conservador exige UX clara — operador entende que está aprovando ato regulatório, não mensagem de chat

### Riscos

- Tenant pode "aprovar tudo no automático" pra ganhar tempo, desnaturando o tier sugestivo. Mitigação: registro em audit_log; métrica de "aprovações em < 5 segundos" como sinal de revisão.

---

## Sprint Fase 2.5 — Visual + integração no escritório virtual + demo (2 semanas)

### Objetivo

Sala Societário visualmente populada no escritório 2D. Avatares dos agentes novos. Demo fechando Fase 2.

### Entregas

- Sala "Societário" no canvas isométrico (já existe vazia — populá-la)
- Avatares: Coordenador Societário, Orquestrador (visual de "agente persistente" — talvez animação diferente), Especialista Documental
- HUD da sala com métricas (processos ativos, em espera, deferidos)
- Conversa por cliente final (`/dashboard/conversas/[account]`) mostra processos societários do account em curso
- Demo script (modo demo Fase 1 já existe — TD-034/TD-035) atualizado com cenário de alteração de capital ponta a ponta
- Snapshot consolidado de tech-debt da Fase 2 (`docs/sprint-reviews/fase-2-tech-debt-snapshot.md`)
- Tag `v0.2.0-fase-2`

### Dependências

- Sprint 2.4 completa
- Modo demo Fase 1 funcional (TD-034 fechado seria ideal, mas não bloqueia)

### Riscos

- Animação de "agente persistente" no canvas pode confundir UX. Mitigação: teste com Levi observando antes de detalhar.
- Demo de alteração de capital pode esbarrar em tempo real (deferimento real da Junta é dias). Solução: modo demo com timestamps comprimidos.

---

## Estimativa total

| Sprint | Duração | Cumulativo |
|---|---|---|
| 2.0-discovery (este) | 3-5 dias | concluído |
| 2.1 Fundações | 2 sem | 2 sem |
| 2.2 Orquestrador + templates | 3 sem | 5 sem |
| 2.3 Portal Adapters | 2 sem | 7 sem |
| 2.4 Modo shadow + tiers | 2 sem | 9 sem |
| 2.5 Visual + demo | 2 sem | 11 sem |

**Total estimado: 11 semanas ≈ 2.75 meses.**

### Reconciliação com `escopo-produto.md`

`escopo-produto.md` previu **2 meses para Fase 2 (Societário)**. Estimativa atual é **2.75 meses** — 30% mais longa.

Razões pela diferença:

1. **Estado inicial mais maduro** — Fase 1 entregou padrão de Coordenador, ChannelAdapter, modo shadow, audit, RLS. Não precisamos reinventar essas peças. Reduziria estimativa, MAS:
2. **Complexidade real do Societário maior** — processos de longa duração com state persistente exigem Orquestrador (agente novo, sem análogo na Fase 1) + workflow engine (decisão arquitetural ADR-022) + Portal Adapters (novo padrão).
3. **3 templates iniciais não cobrem todo o catálogo** — Fase 2 entrega base sólida pra escalar adicionando templates; entregar 15 templates levaria 4+ meses.

Decisão: **manter 2.75 meses como estimativa realista, comunicar honestamente que cobre 3 templates + Receita pós-Junta + uma Junta**. Escalada de templates é trabalho posterior, paralelo à Fase 3.

Se sócio precisar do MVP "operacional pra venda" antes (ex: cobrar de cliente já na semana 6), reduzir escopo da 2.5 (demo simplificada) e mover templates extras pra pós-2.

---

## Sinais que disparariam revisão deste plano

- **Pré-Sprint 2.1:** sócio responde perguntas e mostra geografia diferente do esperado (ex: 80% PR, não SP). Reordenar 2.3 — adapter de JUCEPAR antes de JUCESP.
- **Durante Sprint 2.2:** template de alteração de capital se mostra muito mais simples (só 2 passos efetivos) ou complexo (precisa de 3 agentes). Ajustar templates seguintes.
- **Durante Sprint 2.3:** Adapter de Junta SP quebra em produção (HTML muda). Disparar revisão de RPA (eventualmente abrir ADR-021).
- **Fim de Sprint 2.4:** se métricas mostram operador "aprovando tudo no automático" sistematicamente, refazer onboarding e talvez ajustar regras "sempre humano".
- **Fim de Sprint 2.5:** se sócio confirma valor real do produto Societário, abrir Fase 3 (DP); se não, considerar pivot ou consolidação.

---

## Vínculos

- `docs/discovery/societario-matriz-decisao.md` — fonte de priorização
- `docs/discovery/societario-perguntas-socio.md` — inputs faltantes do sócio
- `docs/adrs/023-topologia-agentes-societario.md` — arquitetura que cada sprint implementa
- `docs/adrs/024-schema-legal-processes.md` — schema da Sprint 2.1
- `docs/adrs/022-workflow-engine.md` — decisão de engine que vale ao longo da fase
- `docs/escopo-produto.md` §Roadmap — estimativa macro original (2 meses)
