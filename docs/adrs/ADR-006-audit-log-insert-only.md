# ADR-006: audit_log INSERT-only e estrutura mandatória de campos

Data: 2026-05-15
Status: aceito

## Contexto

Contabilidade brasileira é regulada (CFC, regras fiscais, LGPD). Audit completo de toda ação relevante — sobretudo de decisões automatizadas envolvendo dados de cliente final — é requisito legal, não opcional. Anos depois do evento, o histórico precisa ser reconstrutível com fidelidade: quem fez, quando, em que tenant, com qual prompt, com qual modelo, a que custo, e qual era o estado antes/depois. Um audit mutável (ou um service-role com UPDATE/DELETE livres) é vetor de erro: uma única migration descuidada destrói a garantia.

## Decisão

A tabela `audit_log` é INSERT-only pelo role `authenticated`. UPDATE e DELETE são explicitamente REVOKED via SQL. Service-role tecnicamente pode mutar (Postgres não permite negar tudo ao owner), mas operações nele são tratadas como anomalia operacional e auditadas externamente.

Campos mandatórios em toda inserção:
- `trace_id` (correlação cross-service via Langfuse)
- `tenant_id`
- `actor` (user_id, agent_id, ou `"system"`)
- `action` (verbo claro)
- `resource` (o que foi afetado)
- `metadata` (JSON estruturado, livre)
- `created_at` (UTC com ms)

Campos opcionais relevantes: `account_id`, `before`, `after`, `prompt_version`, `model`, `cost_usd`.

RLS de SELECT respeita o tenant do request. INSERT permite `tenant_id = current_tenant_id() OR tenant_id IS NULL` (NULL reservado pra eventos de plataforma). Correções de registros errados são INSERTs de evento `correction` referenciando o original via `metadata`, nunca UPDATE.

## Alternativas consideradas

- **audit_log mutável:** perde garantia legal e abre superfície de adulteração. Inaceitável dado o contexto regulatório.
- **Event sourcing puro com replay obrigatório:** overkill no estágio atual. Aumenta complexidade (snapshots, projeções, versionamento de eventos) sem ganho proporcional. INSERT-only entrega 80% do benefício a 5% do custo.
- **Audit em sistema externo (Better Stack, Datadog):** perde transação local com o estado da aplicação. Risco real de divergência entre o que aconteceu no DB e o que está auditado. Aumenta dependência externa pra compliance.

## Consequências

Positivas:
- Compliance regulatória atendida na fundação, não como adendo.
- Reconstrução completa de histórico via SELECT ordenado por `created_at`.
- `trace_id` correlaciona eventos cross-service (web ↔ agent-runtime ↔ workers ↔ Langfuse).

Negativas:
- Não dá pra "limpar" log; correções viram eventos novos. Operacionalmente é o que queremos, mas exige disciplina ao consultar (filtrar eventos `correction`).
- Tabela cresce monotonicamente. Mitigação futura via particionamento por mês quando atingir escala; não relevante agora.
