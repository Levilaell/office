# Departamentos — Recomendação de ordem de implementação

> Sprint Mapa de Departamentos, Tarefa 7.
> **Documento mais importante comercial do sprint.** Fundamenta a próxima
> decisão estratégica do produto.
>
> Insumo principal: `docs/discovery/departamentos-mapa-comparativo.md`.

## Seção 1 — Recomendação concreta

1. **Atendimento** — ✅ Fase 1 entregue
2. **Societário** — valida padrões arquiteturais novos (Orquestrador, workflow longo, Portal Adapter) em risco regulatório médio antes de aplicar em departamentos de risco maior
3. **Pessoal/Folha** — depois dos padrões validados, ataca o maior par "dor × alavancagem" do produto
4. **Contábil** — núcleo do escritório, posicionamento como amplificação (lançamento/conciliação), não substituição (política/fechamento)
5. **Fiscal** — último porque tem o maior risco regulatório do nicho; só faz sentido com plataforma madura nos outros departamentos
6. **Financeiro Interno** — **intercalado** entre sprints grandes (sprint curto de 3-5 semanas que cabe entre o fim de Societário e o início de Pessoal, por exemplo). Comprador é o sócio (decisor único). Pode virar vitrine na demo comercial inicial. **Importante: você é solo, não há capacidade de rodar dois sprints simultâneos — "intercalado" é literal, não "em paralelo"**

## Seção 2 — Por que essa ordem (longo)

### Por que Societário em 2º (e não Pessoal)

A ordem original do `escopo-produto.md` já sugeria Societário em 2º, mas pelo motivo *errado* — assumiu "burocrático, padronizado, baixo risco". A descoberta mostrou que Societário tem **complexidade arquitetural alta** (Orquestrador como agente novo persistente acordado por evento, workflow engine pra processos de longa duração, Portal Adapter pra integrações governamentais fragmentadas) e **risco regulatório médio-alto** (ato societário pode ser juridicamente nulo).

O motivo certo pra manter Societário em 2º não é o sunk cost da discovery, é **complexidade arquitetural progressiva**: 

- O **Orquestrador** vai ser necessário em Pessoal (rotina mensal acordada por cron — abrir folha dia 1, fechar dia 5, transmitir dia 7) e em Fiscal (apuração mensal por cliente, polling de status).
- O **workflow engine** vai ser necessário em Pessoal (eSocial multi-evento), Fiscal (apurações sequenciais) e Contábil (fechamento de competência).
- O **Portal Adapter** vai ser necessário em Fiscal (PGDAS-D, Sefaz estadual, NFS-e municipal), Pessoal (eSocial, FGTS Digital), Contábil (SPED ECD/ECF).

Introduzir esses padrões num departamento de risco médio (Societário) permite estabilizar a arquitetura antes de aplicar em risco alto (Pessoal) ou altíssimo (Fiscal). Erro arquitetural em Societário é recuperável; em Fiscal pode custar caro.

**Teste anti-sunk-cost (feito explicitamente):** se a discovery e os ADRs do Societário **não existissem ainda**, eu ainda colocaria Societário em 2º? **Sim** — pelo argumento de complexidade incremental. O trabalho feito acelera (5 sprints já planejados, 3 ADRs prontos, schema esboçado), mas a posição se sustenta sozinha.

### Por que Pessoal em 3º (e não Contábil)

Pessoal tem **maior dor escritório** (altíssima) e maior risco regulatório direto entre Pessoal e Contábil (alto vs médio). Equipe se mata com fechamento mensal de folha + eSocial; cliente paga bem por melhoria; resultado mensurável.

Pessoal também **gera obrigações que Fiscal consolida** (DCTFWeb, EFD-Reinf). Implementar Pessoal antes de Fiscal significa que o **calendário de obrigações compartilhado** já estará populado quando Fiscal entrar — Fiscal reusa em vez de construir.

Contábil tem volume absoluto maior, mas é o **núcleo da identidade do contador**. Vender automação de contabilidade pode soar como ameaça. Vale ir depois de Pessoal pra estabilizar a confiança do escritório com a plataforma — quando o escritório vê Pessoal funcionando, encaixar Contábil é amplificação, não substituição.

### Por que Contábil em 4º

Já entrou justificado acima — risco de venda alto, vale chegar com confiança construída. Tecnicamente é o departamento de **maior alavancagem por volume** (milhares de lançamentos/mês), mas requer integração madura com sistemas legados (Domínio, Alterdata, Sage) e padrão estável de conciliação bancária (OFX/Open Finance) que ganha qualidade com adapters já testados em Pessoal/Fiscal.

### Por que Fiscal em 5º

Maior risco regulatório do produto (multa multiplicadora 50-225%, sanção CFC, criminal em fraude). Tier sempre sugestivo/manual em apurações complexas. Só faz sentido depois de:

- **Calendário de obrigações** já maduro (vindo de Pessoal e Contábil — DCTFWeb, ECD, ECF)
- **Modo shadow** super estável (testado em Atendimento + Societário + Pessoal + Contábil)
- **Auditoria total** comprovada em uso real

Por isso a ordem original já colocava Fiscal por último, e a descoberta confirma.

### Por que Financeiro Interno intercalado / vitrine

Tem **complexidade técnica baixa** (reusa muito do Pessoal/Contábil/Fiscal aplicado ao próprio CNPJ do escritório) e **risco regulatório baixo** (erro interno é corrigível, sem multa de Receita). Comprador é o **sócio**, decisor único, ciclo curto.

**Atenção tática:** você é dev solo. Não há capacidade real de rodar dois sprints simultaneamente — "intercalado" é literal. O sprint de Financeiro Interno é curto (3-5 semanas, vide apêndice técnico) e cabe entre sprints maiores: por exemplo, entre fim do Sprint 2.5 do Societário e início do Sprint 3.1 do Pessoal. Ou entre Pessoal e Contábil. Não significa "simultâneo".

Duas opções táticas:

- **(a) Intercalado** entre Societário e Pessoal (ou entre Pessoal e Contábil), como módulo "leve" da plataforma — ocupa pouca capacidade técnica e produz valor pro sócio.
- **(b) Como vitrine inicial** — sócio do escritório-cliente ativa pra ele primeiro (folha do próprio escritório, faturamento, indicadores), valida o produto consigo mesmo, depois ativa pros clientes finais. Argumento de venda fortíssimo: "use você primeiro pra ver".

Recomendação concreta: opção (a) — intercalado a partir do meio da Fase 2 ou início Fase 3. Opção (b) só se o sócio mostrar interesse específico em testar antes de oferecer ao cliente.

### Como essa sequência protege o produto

- **Sprint 2.1 → 2.5 (Societário)** introduz Orquestrador e workflow engine sem risco regulatório alto. Se o padrão precisar refator, refazemos sem expor cliente.
- **Sprint 3.x (Pessoal)** aplica padrões testados em departamento de alta dor — operador percebe valor rápido. Calendário de obrigações compartilhado já populado.
- **Sprint 4.x (Contábil)** aplica padrões + adapters de sistema legado num departamento de risco moderado mas com volume gigante (alavancagem).
- **Sprint 5.x (Fiscal)** chega com plataforma madura. Tier conservador. Calendário + integrações + adapters + modo shadow tudo testado.
- **Sprint intercalado (Financeiro Interno)** roda entre dois sprints grandes (ex: Sprint 2.5 → curto Financeiro Interno → Sprint 3.1) — sócio do escritório vê valor cedo sem disputar capacidade técnica com sprint principal.

### Como essa sequência maximiza valor comercial

Cada departamento aberto = motivo pra cliente assinar / renovar / pagar mais.

- Após Fase 1 (Atendimento): plataforma vendável como "operador de atendimento IA"
- Após Fase 2 (Societário): "+ automação de processos societários"
- Após Fase 3 (Pessoal): "+ amplifica seu DP" — primeiro departamento de altíssima dor com solução
- Após Fase 4 (Contábil): "+ amplifica sua contabilidade" — escritório completo
- Após Fase 5 (Fiscal): "+ apoia fiscal" — diferencial premium
- Sprint paralelo Financeiro Interno: módulo independente, vende pro sócio

## Seção 3 — Cenários alternativos

### Cenário "Volume primeiro" (maximiza horas/mês liberadas)

Se a métrica chave for **horas economizadas pelo escritório por sprint investido**, a ordem muda:

1. Atendimento ✅
2. **Pessoal** — alto volume + altíssima dor + maior alavancagem por sprint
3. **Contábil** — volume absoluto maior
4. **Fiscal** — completa o trio de "núcleo do escritório"
5. **Societário** — esporádico, mais valor unitário que volume
6. **Financeiro Interno** — paralelo

**Quando faz sentido:** sócio responde A6 (dor primária) = "DP é o nosso inferno" + A1 (volume Societário) = "raramente atendemos alterações contratuais". Sinaliza que volume manda mais que padronização arquitetural.

**Risco:** introduz Orquestrador, workflow engine e Portal Adapter (todos padrões novos) num departamento de **alto risco regulatório** (eSocial). Erro arquitetural pode virar incidente regulatório. Vale só se o time tem confiança alta na arquitetura ou se aceita maior fragilidade no primeiro deploy.

### Cenário "Risco depois" (protege contra erro inicial)

Se aversão a risco for alta (cliente piloto sensível, escritório conservador):

1. Atendimento ✅
2. **Financeiro Interno** — risco baixíssimo, vitrine pra sócio, ciclo de venda curto
3. **Societário** — risco médio-alto
4. **Contábil** — risco médio
5. **Pessoal** — risco alto
6. **Fiscal** — risco altíssimo

**Quando faz sentido:** primeiro cliente piloto está hesitante e quer ver IA funcionando "sem mexer no que importa". Financeiro Interno é o módulo onde erro é corrigível e visível só pro sócio.

**Risco:** Financeiro Interno tem **baixo valor de venda externa** — não fatura cliente, só amplifica o sócio. Ciclo comercial mais longo até atingir Pessoal/Fiscal (que são onde escritório paga mais).

### Cenário "Sócio prefere Pessoal"

Se sócio em pergunta crítica (vide seção 4) responder explicitamente que prefere Pessoal antes de Societário:

1. Atendimento ✅
2. **Pessoal** — atende preferência do sócio
3. **Societário** — Orquestrador entra aqui, com Pessoal já tendo testado workflow longo de outra forma
4. **Contábil**
5. **Fiscal**
6. **Financeiro Interno** — paralelo

**Tradeoff vs recomendação principal:** aceita maior risco arquitetural no primeiro deploy pós-Atendimento (Pessoal tem risco alto, vai ser primeira aplicação do Orquestrador novo) em troca de valor comercial mais imediato (DP é dor #1 da maioria dos escritórios brasileiros segundo material público).

**Quando faz sentido:** sócio do escritório-cliente responde A6 e D24/D25 sinalizando que folha é o "inferno" deles e que aceitam o risco do produto novo nesse departamento.

## Seção 4 — Perguntas pro sócio (críticas, 7 perguntas)

Curtas, calibram a recomendação. Foco em dimensões onde o sócio tem visão melhor que conhecimento público.

### Q1 — Volume e tempo
**"Em escritório típico de 4-15 pessoas como o seu (ou conhecido), qual departamento consome MAIS horas da equipe por mês? Ranqueie do mais consumido pro menos: Pessoal/Folha, Contábil, Fiscal, Societário, Financeiro Interno, Atendimento."**

→ Calibra a dimensão "Dor escritório" e "Volume típico" da tabela comparativa.

### Q2 — Dor primária
**"Qual é o departamento que MAIS gera reclamação interna da equipe? Onde a equipe diz 'isso aqui me mata'?"**

→ Identifica onde alavancagem percebida tem maior potencial de venda. Pode confirmar Pessoal (eSocial), Fiscal (apuração complexa) ou outro.

### Q3 — Dor do cliente final do escritório
**"Quando vocês perdem um cliente, ele costuma sair por causa de erro/atraso em qual departamento? E quando vocês fecham um cliente novo, ele costuma escolher vocês pela qualidade de qual departamento?"**

→ Diferencia o departamento "perde cliente" (proteger) do departamento "fecha cliente" (diferencial). Pode mudar a prioridade.

### Q4 — Disposição a pagar
**"Se cliente final pudesse pagar 30% a mais pra ter melhoria em um único departamento, qual eles escolheriam?"**

→ Identifica onde o valor percebido pelo cliente final é maior. Conecta produto com receita real.

### Q5 — Receita atual
**"Hoje, qual departamento do escritório é o que mais fatura? Qual é o de maior margem (receita - tempo gasto)?"**

→ Confirma onde a receita está concentrada — pode mudar prioridade se houver discrepância (ex: Contábil fatura 30% mas tem margem -10%).

### Q6 — Risco específico
**"Já aconteceu de um cliente cobrar prejuízo por erro em obrigação acessória (eSocial, SPED, DCTF)? Qual departamento gerou? Qual foi o desfecho?"**

→ Calibra "Risco regulatório" pra realidade do sócio, não só pra escala pública. Pode revelar que Pessoal é mais perigoso (ou menos) do que assumido.

### Q7 — Preferência pessoal
**"Se VOCÊ pudesse escolher o próximo módulo do produto sem considerar nada além do que faria seu escritório (ou os de colegas) mais felizes, qual seria?"**

→ Pergunta direta. Sócio pode ter razão não-mensurável. Documenta a preferência mesmo se for cenário alternativo.

## Seção 5 — Próximos passos concretos

### Imediatos (após você ler este documento)

1. **Levi lê resumo executivo** (`docs/discovery/departamentos-resumo-executivo.md`) — 3 min
2. **Levi decide:** aceita recomendação ou abre cenário alternativo?
   - Aceita: agenda call com sócio pra validar perguntas Q1-Q7
   - Quer alternativo: discute internamente, pode pedir ajuste do mapa comparativo
3. **Agendar call com sócio** — 45-60 min, pode ser WhatsApp se ele não tiver tempo

### O que decidir depois da call com sócio

1. **Departamento escolhido** pro próximo módulo (Q1-Q5 ranqueiam)
2. **Cenário aplicável** (recomendação principal / volume primeiro / risco depois / preferência sócio)
3. **Revisão da Sprint 2.1 do Societário** (se departamento escolhido for Societário, abre como planejado; se for outro, revisa o Sprint 2.0-prep equivalente)
4. **Bloqueio remanescente:** se departamento escolhido for Societário, ainda há as 11 perguntas críticas do `societario-perguntas-socio.md` antes de Sprint 2.1 abrir efetivamente

### Estimativa de tempo até começar próximo Sprint

- Call com sócio + ajuste de plano: **3-7 dias** [estimativa]
- Sprint 2.0-discovery do departamento escolhido (se for diferente de Societário): **3-5 dias** [estimativa]
- Total até começar Sprint do próximo módulo: **1-2 semanas** [estimativa]

Se departamento escolhido é Societário e as 11 perguntas críticas (`docs/discovery/societario-perguntas-socio.md`) forem respondidas na call (em vez de em conversa separada), o Sprint 2.1 abre logo após.

---

## Resumo da recomendação em 1 frase

**Mantenha a ordem original (Atendimento ✅ → Societário → Pessoal → Contábil → Fiscal) com Financeiro Interno intercalado entre sprints grandes a partir da metade da Fase 2, mas justifique Societário em 2º pela complexidade arquitetural progressiva (Orquestrador novo em risco médio antes de risco alto), não pelo motivo da ordem original.**
