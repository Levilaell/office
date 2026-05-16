# ADR-011: UX em quatro superfícies complementares

Data: 2026-05-15
Status: aceito

## Contexto

Com agentes operando 24/7 atrás do dashboard, o usuário (operador do escritório contábil) precisa de quatro coisas distintas, frequentemente ao mesmo tempo:

1. **Saber o que precisa da atenção dele agora** — aprovações pendentes, escalações.
2. **Acompanhar o histórico de um cliente final específico** — toda interação com aquela empresa cliente, agentes participantes, decisões tomadas.
3. **Operar um departamento inteiro** — listas, métricas, filtros, ações em batch (ex: ver todos os DAS vencendo na semana, todas as folhas em andamento).
4. **Ver a operação acontecendo** — sensação visceral de "tenho uma equipe trabalhando" que materializa o posicionamento ("amplifica, não substitui").

Tentar resolver tudo em uma única tela com tabs vira sobrecarga visual e mata o diferencial visual. Tentar reduzir pra uma só (ex: só lista, só dashboard tradicional) perde a metáfora do "escritório virtual" que ancora o pitch comercial.

## Decisão

Quatro superfícies complementares, cada uma com propósito claro:

### 1. Inbox de aprovações — `/dashboard/aprovacoes`

**Status:** implementada (Sprint 0.3d-B). Componentes em `apps/web/src/components/approvals/` (`ApprovalsInbox`, `ApprovalCard`, `ApprovalSheet`, `ActionDialog`). Backed by `usePendingApprovals` no `realtime-store` (Zustand) alimentado via Socket.io (ADR-009).

Fila HITL global do tenant. Filtros por departamento e por expiração. Ações: approve / reject / modify / request_more_info. Cada decisão dispara `POST /api/approvals/[id]/decide` e emite `approval.resolved` no bus. É o único lugar onde o operador vê tudo que está pendente em todos os departamentos simultaneamente — concentra a atenção humana em um único caminho.

### 2. Conversa por cliente final (account) — Fase 1+

**Status:** não implementada. Decidida agora pra que API de eventos e modelo de dados já considere o requisito.

Thread unificada por `account_id`. Agentes aparecem como participantes marcados (avatar + departamento), lado a lado com mensagens do operador humano e do cliente final. Preserva contexto cronológico: "o que aconteceu com esse cliente no último mês". Vai consumir `agent_messages` + `interactions` (modelo já existe em `escopo-produto.md` §Modelo de dados).

### 3. Painel operacional por departamento — `/dashboard/{departamento}` — Fase 1+

**Status:** não implementada. Cada departamento (atendimento, societario, etc) ganha sua rota.

UI tradicional — tabelas, métricas, filtros, ações em batch. É a "ferramenta de trabalho" do operador quando ele quer agir como gerente de departamento (ver todos os tickets abertos do atendimento, todas as obrigações fiscais do mês). Não compete com o escritório 2D — complementa.

### 4. Escritório virtual 2D — `/dashboard/escritorio`

**Status:** implementada (Sprint 0.3d-A). Canvas isométrico PixiJS em `apps/web/src/components/office/` (`OfficeCanvas`, `scene.ts`, `agent-render.ts`, `rooms.ts`, `iso.ts`, `positioning.ts`). State em `realtime-store` via Socket.io.

Navegação principal por agentes. Cada departamento = sala isométrica. Avatares representam agentes; estados visuais (ocioso, trabalhando, aguardando aprovação, em erro) animam em tempo real conforme `agent.state_changed`. Clique em avatar abre `AgentSheet` lateral com últimos runs, ferramentas disponíveis, prompt versionado em uso. É a superfície de descoberta e de "como meu escritório está agora".

### Decisões transversais

- **End-client (acesso de cliente final do escritório) = MVP.** Decisão Levi. Modelo de dados (`accounts`, RBAC role `end_client`) já contempla; UI dedicada vem na Fase 1+.
- **Mobile = Fase 4+.** Web responsivo cobre Fase 0-3. App nativo só quando volume justificar.
- **Realtime via Socket.io dia 1.** ADR-009. Todas as quatro superfícies consomem o mesmo store (`realtime-store`) alimentado pelo mesmo socket.

## Alternativas consideradas

- **Single dashboard com tudo em tabs.** Mata o diferencial visual; sobrecarga cognitiva alta porque o operador precisa lembrar em qual tab está cada coisa. Não escala quando tem 8+ departamentos. Rejeitada.
- **Escritório 2D pós-MVP, MVP só com inbox + painéis.** Rejeitada porque o escritório 2D é o diferencial comercial — é a demo que vende. Sem ele no MVP, perde-se a metáfora "amplifica equipe humana" que ancora todo o posicionamento. Adiar seria adiar o motor de conversão.
- **Three-pane app à la Slack (sidebar + lista + detalhe).** Funciona pra mensageria pura, mas a fila de aprovações e o escritório 2D pedem layouts diferentes. Forçar tudo num layout único cria atrito desnecessário.
- **Apenas escritório 2D, sem inbox separada.** Bonito, mas avesso à ergonomia: operador precisaria caçar avatares "em estado de aprovação" pra agir. Inbox concentra; escritório descobre. Funções diferentes.

## Consequências

Positivas:
- Cada superfície tem um job claro. "Onde vejo X?" tem resposta de uma palavra: inbox, conversa, painel, escritório.
- Escritório 2D = demo killer. Diferenciação visual imediata em apresentação comercial.
- Inbox concentra ações que exigem atenção humana — não se perdem no meio de uma timeline ou painel cheio de tabela.
- Conversa por cliente preserva contexto longitudinal — operador navega entre clientes finais sem perder histórico.
- Quatro superfícies sobre o mesmo `realtime-store` = state consistente entre elas (mudança em uma reflete instantaneamente nas outras).

Negativas:
- 4x mais surface area de UI pra manter. Cada superfície precisa de empty state, loading state, error state, estado mobile responsivo próprios.
- Navegação cross-surface exige cuidado: deep-link de um item da inbox pra "ver no escritório" e vice-versa não é trivial. Mitigado por URL params consistentes (`?account=...`, `?agent=...`).
- Onboarding do operador maior: precisa entender pra que serve cada superfície. Mitigado por tour inicial e por nomes auto-explicativos nas rotas.

## Quando reverter

Se 6 meses depois do GA, telemetria (PostHog) mostrar que uma das superfícies tem <5% de uso recorrente por tenant ativo, considerar consolidação. Provável candidato a colapsar: painel operacional por departamento, se a inbox + escritório cobrirem 95% dos fluxos. Não reverter o escritório 2D nem a inbox — esses dois são pilares do produto.
