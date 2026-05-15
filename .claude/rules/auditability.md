# Auditabilidade

## Princípios

- Contabilidade é regulada. Audit é requisito legal, não opcional.
- Tudo registrado de forma imutável.
- Audit log nunca é fonte de erro; falha em logar = falha da operação.

## O que registrar

Toda operação relevante registra:
- `trace_id` (correlação)
- `tenant_id`
- `account_id` (quando aplicável)
- `actor` (user_id, agent_id, ou "system")
- `action` (verbo claro)
- `resource` (o que foi afetado)
- `before` / `after` (snapshot quando aplicável)
- `prompt_version` (quando envolve LLM)
- `model_used` (quando envolve LLM)
- `cost_usd` (quando envolve LLM)
- `timestamp` (UTC, com ms)
- `metadata` (livre, JSON estruturado)

## Imutabilidade

- Tabela `audit_log` é INSERT-only
- Nenhuma policy de UPDATE ou DELETE
- Backup contínuo
- Retenção mínima: 5 anos (verificar exigência regulatória brasileira)

## Aprovações humanas

Quando humano aprova ação:
- Registra user_id, timestamp, decisão (aprovado/rejeitado/modificado)
- Se modificou: registra o que foi modificado
- Justificativa opcional mas recomendada

## Acesso ao audit

- Dono do tenant vê tudo do seu tenant
- Gerente vê do seu departamento
- Operador vê só do seu trabalho
- Suporte interno (nosso): com permissão explícita, log de acesso ao audit

## Common pitfalls

- Esquecer de logar erro/exception (sempre logar com trace_id)
- Log incompleto que não permite reconstruir o que aconteceu
- Logar PII sem necessidade
- Log síncrono bloqueando operação principal (use fila)
