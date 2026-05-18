# ADR-014: Escopo do Departamento de Atendimento na Fase 1

Data: 2026-05-18
Status: aceito

## Contexto

A Fase 1 implementa o primeiro departamento da plataforma após a fundação (Fase 0). O departamento de Atendimento é a porta de entrada do escritório contábil — onde cliente final, lead e administrativo se cruzam.

Há tensão entre três escopos possíveis:

1. **Apenas operacional:** agente responde clientes já contratados sobre obrigações, documentos, prazos. Tom técnico-formal. Volume previsível.
2. **Apenas comercial:** agente qualifica leads novos chegando pelos canais. Pipeline, slots, agendamento de call. Volume imprevisível.
3. **Híbrido completo:** os dois mais nutrição de lead, follow-up automatizado, CRM próprio.

Escritórios contábeis brasileiros de 4-15 pessoas (cliente ideal de entrada) **não separam** atendimento operacional de comercial na prática — a mesma pessoa atende as duas demandas. Excluir comercial cria buraco visível de produto. Incluir comercial completo é trabalho de Fase 3-4.

## Decisão

Escopo da Fase 1 = **operacional + comercial leve**:

- **Operacional completo:** agente classifica intent, consulta domínio compartilhado (read-only), responde dúvidas sobre obrigações, documentos, status, prazos. Escala humano em dúvida regulatória.
- **Comercial leve:** agente qualifica lead novo coletando slots estruturados (nome, empresa, porte, regime, dor, prazo). Quando qualificado, sinaliza humano pra agendamento de call. **Não** agenda diretamente, **não** nutre lead, **não** faz follow-up automatizado, **não** fecha venda.
- **Administrativo:** intents administrativos (cobrança da fatura do escritório, atualização de cadastro) viram sempre handoff humano. Sem agente especialista dedicado na Fase 1.

CRM próprio (pipeline visual, follow-up automatizado, nutrição) fica como **Fase 1.5 opcional ou Fase 3**, dependendo da tração comercial.

## Alternativas consideradas

**A) Apenas operacional na Fase 1:** mais simples, menor risco. Rejeitada porque cria buraco visível de produto e quebra posicionamento "amplifica equipe" — escritório teria que decidir entre "automatizar atendimento operacional mas ignorar lead novo" ou "voltar a fazer atendimento humano completo".

**B) Híbrido completo com CRM:** entrega mais valor, mas multiplica complexidade da Fase 1 por ~2x. CRM exige modelo de pipeline, automações de nutrição, integrações de calendário. Trabalho que deve viver em fase própria depois de validar o operacional.

**C) Comercial primeiro, operacional na Fase 2:** rejeitada porque operacional tem volume maior e ROI mais claro pro escritório. Comercial sem operacional sólido também desconecta lead do produto que ele vai consumir.

## Consequências

**Positivas:**
- Topologia de agentes contida (3 agentes: 1 coordenador + 2 especialistas)
- Escopo demonstrável em ~2.5 meses, alinhado com roadmap macro
- Especialista Operacional **read-only** elimina aprovação humana no caminho crítico de resposta — simplifica fluxo drasticamente
- Modelo de dados de leads existe no schema mas é minimalista — refatoração futura pra CRM completo é aditiva, não destrutiva

**Negativas:**
- Lead qualificado precisa de humano pra agendar call. Em escritório sem disponibilidade rápida, lead pode esfriar.
- "Comercial leve" pode frustrar tenant que espera funil completo. Onboarding precisa comunicar expectativa.
- Ações de escrita no domínio (atualizar cadastro, marcar tarefa, agendar) ficam fora do agente — operador humano executa via UI. Aceita-se na Fase 1; reabrir na Fase 2+.

**Critérios de revisão:**
- Se >30% dos tenants ativos pedirem agendamento automático de call: priorizar integração com Google Calendar na Fase 1.5
- Se métrica de lead frio (qualificado mas não convertido) > 50%: priorizar nutrição automatizada
