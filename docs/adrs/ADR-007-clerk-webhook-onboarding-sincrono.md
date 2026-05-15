# ADR-007: Sincronização Clerk → DB via webhook resiliente + onboarding síncrono

Data: 2026-05-15
Status: aceito

## Contexto

Criação de Organization no Clerk precisa propagar pro DB pra que o dashboard tenha tenant pra consultar. Webhook é o caminho oficial e cobre todo o ciclo de vida (create/update/delete de org, user e membership), mas é assíncrono: pode chegar depois da primeira requisição do usuário recém-onboardado. Sem mitigação, o dashboard pós-onboarding crasha ou entra em loop de redirect. Além disso, reentregas do webhook (network failure, container restart, retry do próprio Clerk) precisam ser idempotentes — caso contrário um evento processado duas vezes corrompe o estado.

## Decisão

Caminho duplo, com idempotência via dedup row:

1. **Webhook assíncrono** em `POST /api/webhooks/clerk`, com validação de assinatura Svix. Eventos relevantes: `organization.created/updated/deleted`, `user.created/updated`, `organizationMembership.created/deleted`.
2. **API route síncrona** `POST /api/onboarding/complete-org`, chamada pelo client logo após `<CreateOrganization>` completar, antes do redirect pro dashboard. Usa `clerkClient()` pra buscar dados de user e org caso o webhook ainda não tenha chegado.

Idempotência garantida por tabela `webhook_events` com PK `svix_id`. Handler falha → a row de dedup é deletada pra permitir reentrega. Handlers fazem `upsert` com `onConflict`: qual caminho chega primeiro (webhook ou síncrono) vence; o segundo passa sem erro. Ambos os caminhos invocam as mesmas funções de domínio em `shared-domain` — não há duplicação de lógica.

## Alternativas consideradas

- **Só webhook:** race condition na primeira requisição pós-onboarding. UX ruim (loop de redirect ou crash); inaceitável.
- **Só síncrono:** perde resiliência se a chamada falhar e perde captura de eventos pós-criação (updates posteriores, deletions, mudanças de membership feitas pelo dashboard do Clerk). Webhook cobre o ciclo de vida; síncrono cobre só o ponto inicial.
- **Polling no client após onboarding:** UX ruim, custo de requests, atraso visível pro usuário. Caminho descartado.

## Consequências

Positivas:
- Resiliência + consistência: ambos os caminhos convergem ao mesmo estado final via upsert idempotente.
- Reentrega segura do webhook — Clerk retenta em falha, `webhook_events` dedup garante uma única aplicação.
- UX consistente: dashboard só carrega quando o tenant existe.

Negativas:
- Dois caminhos que fazem trabalho parecido. Mitigado pela centralização em `shared-domain` — qualquer mudança de regra entra num lugar só.
- Onboarding síncrono adiciona 2 chamadas API ao Clerk (busca de user + org). Aceitável porque acontece uma vez por usuário e ocorre fora do hot path.
