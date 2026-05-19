# Sprint Mapa de Departamentos — Self-review

Data: 2026-05-19
Branch: `main` (commit direto, sprint discovery sem PR conforme `.claude/rules/pr-policy.md`)
Sprint anterior: Fase 2.0-discovery (Societário). Próximo: depende da decisão da call com sócio (ver `docs/discovery/departamentos-resumo-executivo.md`).

## Documentos gerados (paths)

Todos novos. Zero código tocado.

1. `docs/discovery/departamentos/pessoal.md` — Tarefa 1
2. `docs/discovery/departamentos/contabil.md` — Tarefa 2
3. `docs/discovery/departamentos/fiscal.md` — Tarefa 3
4. `docs/discovery/departamentos/financeiro-interno.md` — Tarefa 4
5. `docs/discovery/departamentos/atendimento.md` — Tarefa 5b (snapshot Fase 1)
6. `docs/discovery/departamentos/societario.md` — Tarefa 5a (resumo padronizado)
7. `docs/discovery/departamentos-mapa-comparativo.md` — Tarefa 6 (espinha do sprint)
8. `docs/discovery/departamentos-recomendacao-ordem.md` — Tarefa 7 (saída comercial)
9. `docs/discovery/departamentos-apendice-tecnico.md` — Tarefa 8 (jargão isolado, pra próximas discoveries)
10. `docs/discovery/departamentos-resumo-executivo.md` — Tarefa 9 (Levi lê em 3 min)

**Total: 10 documentos** (prompt esperava 9; o 10º é Atendimento + Societário em arquivos separados na Tarefa 5).

## Hashes em main

```
8344e71 (HEAD pré-sprint, fechou Fase 2.0-discovery Societário)
↓
43763c1 docs(sprint-review): Fase 2.0-discovery — self-review estruturado
↓ (este sprint começa aqui)
039eb7a docs(discovery): mapa do departamento Pessoal/Folha                      (Tarefa 1)
d1cfe05 docs(discovery): mapa do departamento Contábil                           (Tarefa 2)
7768423 docs(discovery): mapa do departamento Fiscal                             (Tarefa 3)
7f29f5e docs(discovery): mapa do departamento Financeiro Interno                 (Tarefa 4)
6e01456 docs(discovery): mapa do Atendimento (snapshot Fase 1) e Societário      (Tarefa 5)
3afa30a docs(discovery): mapa comparativo central de todos os departamentos      (Tarefa 6)
587226f docs(discovery): recomendação de ordem dos departamentos                 (Tarefa 7)
0a3f13d docs(discovery): apêndice técnico dos departamentos pra futuras disc.    (Tarefa 8)
b9ab554 docs(discovery): resumo executivo do mapa de departamentos               (Tarefa 9)
↓
(este self-review + push pendentes)
```

## Recomendação de ordem (sintetizada)

1. **Atendimento** ✅ (Fase 1, feita)
2. **Societário** — valida padrões arquiteturais novos (Orquestrador, workflow longo, Portal Adapter) em risco médio antes de risco alto
3. **Pessoal/Folha** — maior dor + alavancagem, com padrões já validados
4. **Contábil** — núcleo do escritório, posicionar como amplificação
5. **Fiscal** — último porque maior risco regulatório
6. **Financeiro Interno** — intercalado entre sprints grandes (Levi solo; sprint curto cabe entre dois sprints maiores) a partir do meio da Fase 2

## Distribuição da matriz por departamento

| Dept | Total | Auto | Assistir | Fora | % Automatizável | Status |
|---|---|---|---|---|---|---|
| Atendimento | 19 | 13 | 2 | 4 | **73% (real)** | ✅ Fase 1 |
| Societário | 45 | 14 | 24 | 7 | 57.5% | A decidir |
| Pessoal | 25 | 7 | 14 | 4 | 56% | A decidir |
| Contábil | 28 | 10 | 15 | 3 | 63% | A decidir |
| Fiscal | 33 | 12 | 17 | 4 | 62% | A decidir |
| Financeiro Interno | 30 | 13 | 14 | 3 | 66% | A decidir |
| **Total** | **180** | **69 (38%)** | **86 (47%)** | **25 (15%)** | — | — |

**Stop rule de "inviabilidade" (>60% Fora) NÃO disparou em nenhum departamento.** Mais alto foi Atendimento (21%) e Pessoal (16%); todos outros < 16%.

## Top 5 padrões observados

1. **Não há "fácil + alto valor" no nicho.** Todo departamento de alto valor (Pessoal, Contábil, Fiscal) tem risco regulatório alto. Atendimento foi exceção e por isso foi a escolha textbook pra Fase 1.

2. **% Automatizável dos 5 estimados converge em 56-66%.** Banda estreita. Teto natural de ~60-65% no nicho contábil brasileiro. Confirma que "amplifica equipe, não substitui" é tese técnica, não floreio de marketing.

3. **Pessoal e Fiscal são os "vingadores" da dor.** Maior alavancagem por sprint depois de feito, mas exigem plataforma já madura. Argumento direto pra Societário antes deles (validar Orquestrador/workflow/Portal Adapter em risco médio).

4. **Calendário de obrigações compartilhado é alavancagem cruzada.** Pessoal gera DCTFWeb que Fiscal consolida. Implementar Pessoal antes de Fiscal significa Fiscal reusar em vez de construir.

5. **Financeiro Interno é "leve" tecnicamente e baixo em risco**, mas atende um comprador diferente (o sócio, decisor único). Sprint curto cabe **intercalado** entre sprints grandes porque reusa muito (Pessoal/Contábil/Fiscal aplicados ao próprio CNPJ). Como Levi é solo, "paralelo" é literal "intercalado".

## Decisões tomadas sozinho (baixa confiança, dependem de sócio)

| Decisão | Razão | Como muda com sócio |
|---|---|---|
| Societário em 2º se mantém pelo motivo *certo* (complexidade arquitetural progressiva), não pelo original ("burocrático, baixo risco") | Padrões introduzidos lá são reusados em Pessoal/Fiscal; errar arquitetura em risco médio é recuperável | Q1 + Q2 + Q7 podem sinalizar Pessoal em 2º — cenário alternativo "Volume primeiro" |
| Financeiro Interno intercalado (não em 6º) | Reusa muito + comprador é sócio + ciclo curto + sprint curto cabe entre dois sprints grandes (Levi solo, sem paralelismo real) | Sócio pode preferir foco serial sem intercalação |
| % Automatizável dos 5 estimados em 56-66% (banda estreita) | Cálculo a partir das matrizes; consistente com 73% real do Atendimento (que tinha pior bucket "Fora de escopo" maior) | Sócio pode mostrar atividade rotineira que eu coloquei em "Assistir humano" mas que tem prática 100% automatizada no escritório dele |
| Volume "Altíssimo" para Atendimento e Contábil | Atendimento real; Contábil estimado por volume de lançamentos/mês | Calibração via Q1 |
| Dor "Altíssima" para Pessoal e Fiscal | Material público (Sebrae, Sescon SP) + experiência de mercado | Q2 valida |
| Tier inicial sempre sugestivo em todos os 5 | Conservador, alinhado ao princípio "human-in-the-loop em ação externa de impacto" | Sócio pode argumentar que algumas atividades determinísticas (DAS Simples, geração de holerite simples) podem entrar em semi-autônomo já no 1º deploy |
| Estimativa de tempo de implementação por departamento (3-7 meses cada) | Extrapolação de Atendimento (3m / 6-7 sprints) ajustada pela complexidade | Pode mudar muito se sócio mostrar que algo é mais simples (ou mais complexo) que assumi |
| Risco de venda "alto" para Contábil | Material de mercado sobre identidade do contador titular | Sócio pode reportar prática diferente em seu próprio escritório |

## Calibração de estimativas

Confiança variável por dimensão:

| Dimensão | Confiança | Razão |
|---|---|---|
| Atendimento (todos os campos) | **Alta** | Dado real da Fase 1 |
| Societário (todos os campos) | **Alta** | Discovery profunda recém-feita |
| **Risco regulatório** (todos depts) | Alta | Definido por lei e prática conhecida |
| **% Automatizável** dos 5 estimados | Média-Alta | Matriz com 25-33 linhas; padrão emergiu coerente |
| **Complexidade técnica** | Média-Alta | Dada por integrações conhecidas + padrão arquitetural deduzido |
| **Volume típico** | Média | Estimado por extrapolação de cliente típico (4-15 pessoas, 30-100 clientes) — sócio pode calibrar |
| **Dor escritório** | Média | Material público + intuição de mercado — sócio calibra na Q1+Q2 |
| **Tempo de implementação** | Baixa-Média | Extrapolação. Atendimento real foi 3m / 6-7 sprints; outros são estimativas por analogia |
| **Risco de venda** | Baixa | Dependente de prática do sócio com clientes; só ele tem visão real |
| **% da receita do escritório por depto** | Baixa | Conhecimento público varia; depende do mix de cliente |

**Resumo:** dimensões "duras" (risco regulatório, % automatizável) têm boa confiança. Dimensões "blandas" (dor real, tempo, risco de venda) dependem do sócio.

## Diferenças vs ordem original do escopo

- **Original** (`docs/escopo-produto.md`): Atendimento → Societário → Pessoal → Contábil → Fiscal → Financeiro Interno
- **Recomendada**: Atendimento ✅ → Societário → Pessoal → Contábil → Fiscal, com **Financeiro Interno intercalado entre sprints grandes a partir do meio da Fase 2**

### Justificativa em 3 bullets

- **Posições 1-5 idênticas.** A descoberta confirma a viabilidade do que estava planejado, sem rearranjo de departamentos serializados.
- **Justificativa de Societário em 2º muda.** Original assumiu "burocrático, padronizado, baixo risco". Descoberta confirma médio-alto risco + alta complexidade arquitetural. Razão pra ficar em 2º é **agora arquitetural** (introduzir Orquestrador/workflow/Portal Adapter em risco médio antes de risco alto), não o motivo escrito antes.
- **Financeiro Interno sai de "em paralelo a qualquer um" pra "intercalado entre sprints grandes a partir do meio da Fase 2".** Reusa muito + atende sócio (decisor único) + ciclo de venda curto + pode virar vitrine na demo comercial — opção tática nova. **"Intercalado" é literal, não "paralelo" — Levi é solo.**

## Riscos identificados pra Fase 2

1. **Sem call com sócio ainda.** Todas as estimativas de dor real, tempo e impacto comercial são extrapoladas de conhecimento público. Sprint 2.1 (Societário) tem 11 perguntas críticas pendentes do sprint discovery anterior; **pode juntar as 7 perguntas deste sprint na mesma call estendida pra 90 min**.

2. **Bias técnico na recomendação.** A defesa de Societário em 2º é arquitetural ("introduzir padrões em risco médio"). É um argumento técnico legítimo, mas comercial não-otimal — Pessoal libera mais horas/mês depois de feito. Se a métrica chave for "horas economizadas por sprint", cenário "Volume primeiro" vence.

3. **Estimativa de tempo dos 5 departamentos pode estar otimista.** Atendimento foi 3 meses com 6-7 sprints; extrapolei 2-7 meses pros outros, dependendo da complexidade. **Soma total: 17-25 meses** se sequencial. Compatível com 16-20 meses do `escopo-produto.md`, mas margem apertada. Margem real depende de qualidade de integrações com sistemas legados (Domínio, Alterdata, Sage) — gap conhecido.

4. **Risco de venda do Contábil não tem solução clara.** Vou precisar testar posicionamento. Pode ser que escritório-cliente rejeite Contábil "automatizado" mesmo bem posicionado. Mitigação: começar com escritórios early adopter (mais abertos a IA), validar com 2-3 clientes antes de escalar.

5. **Calendário de obrigações compartilhado é assumido como pré-condição.** TD-030 (catálogo `obligation_type`/`document_type`) precisa ser feito antes ou no início do sprint de Pessoal/Fiscal/Contábil (não em sprint separado — cabe dentro do sprint principal). Não bloqueia, mas é trabalho preparatório.

## Sugestão pra próximo passo

**Concreto, em ordem:**

1. **Levi lê** `docs/discovery/departamentos-resumo-executivo.md` (3 min).
2. **Levi decide** se aceita recomendação principal, cenário alternativo, ou quer ajustar antes de levar pro sócio.
3. **Levi agenda call com sócio** — 90 min se for juntar as 7 perguntas deste sprint + 11 do Societário; 60 min se for só este sprint.
4. **Pós-call:**
   - Aceita ordem principal → próximo Sprint = **Sprint 2.1 Fundações Societário** (depende das 11 perguntas críticas do `societario-perguntas-socio.md`)
   - Cenário "Volume primeiro" → próximo Sprint = **Sprint 3.0-discovery Pessoal** (3-5 dias antes do Sprint 3.1)
   - Cenário "Risco depois" → próximo Sprint = **Sprint 6.0-discovery Financeiro Interno**
5. **Levi documenta a decisão** em commit/ADR/sprint review do próximo módulo, citando este resumo + as respostas do sócio.

**Tempo total até começar próximo módulo:** 1-2 semanas [estimativa].

## Surpresas durante implementação

1. **Atendimento como âncora real mudou meu cálculo.** Sem ele, eu tinha estimado % automatizável dos outros mais alto. O 73% real do Atendimento (com pior bucket "Fora de escopo" maior) calibrou pra baixo as estimativas dos outros — converge na banda 56-66%, mais defensável.

2. **Anti-sunk-cost test surpreendeu positivamente.** Testei honestamente: "se a discovery do Societário não existisse, eu colocaria Societário em 2º?". Resposta: **sim, mas pelo motivo arquitetural, não pelo motivo original**. Trabalho feito acelera, mas não enviesa a decisão.

3. **Stop rule (>60% Fora de escopo) nem chegou perto de disparar.** Pior caso foi Atendimento (21%), e Atendimento foi a escolha óbvia pra Fase 1. Mostra que produto inteiro tem viabilidade em todos os 5 departamentos restantes.

4. **Tarefa 6 (mapa comparativo) é mesmo a espinha** — todos os documentos subsequentes (7, 8, 9) derivam dela. Se fosse fazer paralelo (advisor sugeriu), Tarefas 1-5 podiam ser delegadas, mas 6 tem que ser feita no main com Opus pra coerência.

5. **Financeiro Interno acabou sendo mais interessante do que assumido.** Originalmente "departamento secundário"; análise mostrou que **atende um comprador diferente (sócio), pode rodar intercalado entre sprints grandes, e vira vitrine pra demo comercial**. Posicionamento "vende ao sócio antes de oferecer ao cliente final" é argumento de venda novo que emergiu da análise.

6. **Calendário de obrigações compartilhado emergiu como pré-condição não-óbvia.** Não estava explícito no início; emergiu da análise de fluxos cruzados (Pessoal gera obrigações, Fiscal consolida, Atendimento envia). Implicação: TD-030 (catálogo `obligation_type`) precisa estar resolvido antes ou no início do sprint de Pessoal/Fiscal/Contábil.

## Validação rodada

- `git status`: limpo (working tree clean após 9 commits) ✓
- `pnpm typecheck`: ✓ (10 successful, full turbo cache — sprint não tocou código)
- `pnpm lint`: ✓ (10 successful, full turbo cache)
- `pnpm test`: ✓ (10 successful, full turbo cache)
- `pnpm build`: ✓ (3 successful, full turbo cache)

> Sprint discovery não modifica código — validação confirma que nada foi
> inadvertidamente alterado.

## Conclusão

Sprint Mapa de Departamentos entrega 10 documentos novos em 9 commits sequenciais. Tabela comparativa central (Tarefa 6) é o eixo; resumo executivo (Tarefa 9) é o output principal pra Levi → sócio.

**Recomendação:** mantém a ordem original (Atendimento ✅ → Societário → Pessoal → Contábil → Fiscal) com justificativa atualizada (complexidade arquitetural progressiva, não "burocrático e baixo risco"). Financeiro Interno intercalado entre sprints grandes a partir do meio da Fase 2 (sprint curto, Levi solo).

**Próximo passo:** Levi lê resumo executivo, agenda call com sócio (60-90 min), depois abre próximo Sprint conforme decisão.

**Não há bloqueador novo.** Bloqueio remanescente do sprint anterior (11 perguntas críticas do Societário) pode ser resolvido na mesma call.
