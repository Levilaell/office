# Societário — Perguntas pro sócio (discovery)

> Sprint Fase 2.0-discovery, Tarefa 7.
> Perguntas que SÓ o sócio responde — input direto na Sprint 2.1 e nos
> templates iniciais. Sócio pode responder em texto livre ou marcar
> "não sei" / "não aplicável".
> Onde apropriado, perguntas referenciam o # da linha da matriz
> em `societario-matriz-decisao.md`.

## Instruções pro sócio

Não precisa responder tudo. Responder no que tiver opinião firme. Itens marcados como críticos no fim de cada bloco são os que mais impactam a próxima sprint.

---

## A. Frequência e valor (impacta priorização)

1. **Quantas alterações contratuais o escritório protocola por mês?** (média dos últimos 6 meses serve)
2. **Qual tipo de alteração mais aparece — capital, sócios, sede, CNAE?** Ordenar de mais comum pra menos comum.
3. **Quantas aberturas de empresa por mês?** (incluindo MEI separado)
4. **Quantos MEI o escritório atende hoje?** (separado de ME/LTDA)
5. **Quanto vocês cobram, em média, por uma alteração contratual completa de uma LTDA pequena?** (banda — de R$ X a R$ Y)
6. **Qual é a obrigação societária que dá MAIS dor de cabeça operacional?** Não a mais lucrativa — a que mais consome tempo da equipe.
7. **Qual obrigação societária dá maior margem (mais lucrativa relativa ao tempo gasto)?**
8. **Há sazonalidade clara em algum tipo de obrigação societária?** (ex: aberturas concentram em dezembro/janeiro?)

**Críticas:** #1, #2, #5, #6 — dimensionam volume real e identificam dor primária.

---

## B. Cobertura geográfica (define ordem de Juntas/prefeituras)

9. **Em qual estado fica a maioria dos clientes?** (ranking dos 3 principais)
10. **Tem cliente fora de SP/RJ/MG/SC/RS/PR?** Se sim, em quais estados e qual % do total.
11. **Tem cliente com filial em outro estado da matriz?** (= operação interestadual no portfólio)
12. **Em quais municípios os clientes estão concentrados?** (a Prefeitura desses municípios é onde primeiro vamos integrar)
13. **A maioria dos atos atuais vão pra qual Junta?** JUCESP? JUCEMG? Outra?

**Críticas:** #9, #13 — definem ordem de implementação dos Portal Adapters (ADR-023).

---

## C. Infraestrutura atual (define integrações)

14. **Vocês usam certificado A1 ou A3?** Predominância.
15. **Qual certificadora é a preferida?** (Serasa, Soluti, Certisign, Valid, AC SafeID, outro)
16. **Vocês têm parceria com alguma certificadora?** (revenue share, programa de afiliado)
17. **Qual ERP/sistema contábil vocês usam hoje?** (Domínio? Alterdata? Sage? Questor? Conta Azul? Omie?)
18. **O ERP atual integra com algum portal governamental via API?** (especificamente: emite DBE, faz comunicação pós-Junta automática? polling de status?)
19. **Vocês usam algum sistema dedicado de societário hoje?** (ContaSimples, Vox Contábil, Cabofy, outro?)
20. **Tem alguma operação societária que vocês contratam terceiro pra fazer hoje?** (ex: contrato de advogado pra alterações complexas)

**Críticas:** #14, #17, #18 — definem viabilidade técnica do ADR-024 e dos Portal Adapters.

---

## D. Decisão de fronteira (filtra escopo de produto)

21. **Qual obrigação societária você NUNCA confiaria num robô?** Quer humano sempre no loop, mesmo que seja tier autônomo.
22. **Qual obrigação societária você ACEITARIA mais autonomia?** (= candidatas a tier `autonomo` ou `semi-autonomo` no início da Fase 2)
23. **Qual obrigação seria perfeita se viesse "pronta pra um clique humano final"?** (= candidato ideal pro padrão "Assistir humano" da matriz)
24. **Tem caso recente em que portal governamental mudou e quebrou processo manual?** Qual portal e o que aconteceu?
25. **Como vocês monitoram hoje o "deferimento na Junta"?** (operador entra no portal todo dia? cliente avisa?)
26. **Qual sinal vocês usam pra confirmar que CNPJ foi atualizado pós-Junta?** (consulta CNPJ pública? recebe e-mail da Receita? olha no eCAC?)
27. **Tem caso em que erro em societário gerou prejuízo grande (multa, retrabalho, cliente perdido)?** Conta a história.

**Críticas:** #21, #23 — definem onde NÃO ser ambicioso vs onde focar.

---

## E. Validação da matriz (depende da prática)

> Perguntas específicas pra linhas da matriz com **Confiança: Média**. Cada item lista o # da linha em `societario-matriz-decisao.md`.

28. **Linha #5 (Sefaz estadual em abertura de empresa):** quantas das aberturas atuais exigem IE? (só comércio/indústria/transporte exigem — banda %?)
29. **Linha #7, #10, #13, #16, #23, #36 (Receita Federal pós-Junta automática):** vocês confiam em uma comunicação automática à Receita assim que NIRE deferido? Ou preferem que humano confirme antes?
30. **Linha #9 (DARF de ganho de capital em cessão de quotas):** com que frequência cessão envolve ganho de capital tributável (e não permuta de quotas)? Banda alta/média/baixa.
31. **Linha #12 (alteração de sede interestadual):** quantas por ano? Considerado caso raro ou recorrente?
32. **Linha #17 (revisão CCM/IE pós-mudança de CNAE):** o cliente lembra de fazer isso ou frequentemente passa? (i.e., vale agente automatizar lembrete?)
33. **Linha #21 (Prefeitura + Sefaz destino em abertura de filial):** vocês têm clientes que abriram filial nos últimos 2 anos? Em quais estados?
34. **Linha #26 (Distrato — Receita baixa CNPJ):** distratos costumam travar em qual passo? (CNDs? eSocial? Sefaz?)
35. **Linha #28 (Sefaz/Prefeitura em distrato):** atualmente vocês fazem tudo internamente ou terceirizam parte?
36. **Linha #29-30 (Transformação societária — fora de escopo):** quantas por ano? Compromete se NÃO automatizar?
37. **Linha #33 (Desenquadramento MEI — Portal Simples):** com que frequência aparece? E vocês cobram quanto por isso?
38. **Linha #44 (Polling de status na Junta):** se agente pudesse "olhar 3x ao dia se a JUCESP deferiu", isso traria valor? Hoje quanto tempo vocês perdem checando manualmente?

**Críticas:** #29 (Receita pós-Junta automática) — confirma maior bloco de "Automatizar" da matriz. Se sócio quer humano sempre antes da Receita, 7 linhas da matriz mudam pra "Assistir humano".

---

## F. Negociação comercial (alimenta pricing/MVP)

39. **Onde vocês ganham margem maior em Societário hoje?** Ato específico, perfil de cliente, ou volume?
40. **Tem cliente que pagaria premium por Societário automatizado?** (preço atual + 30-50%)
41. **Você venderia o Societário como módulo separado ou só como parte do pacote completo da plataforma?**
42. **Qual é o maior gargalo HOJE em escalar vendas de Societário?** (capacidade do time? marketing? processo manual?)

**Críticas:** #39, #40 — definem se a primeira monetização da Fase 2 vale priorizar.

---

## Resumo (volta pro Levi consolidar com sócio)

Total: **42 perguntas** distribuídas em 6 blocos.

Mínimo de "respondidas" que destrava Sprint 2.1: **A1, A2, A5, A6, B9, B13, C14, C17, D21, D23, E29.**

Esses 11 itens em particular definem:
- Volume real (A) e geografia (B) → primeiro template e primeiro adapter
- Stack atual (C) → integração possível com ERP existente
- Fronteira de produto (D) → tier de autonomia inicial e onde NÃO mexer
- Receita pós-Junta automática (E29) → se 7 linhas de "Automatizar" da matriz permanecem ou viram "Assistir humano"

Tempo estimado de resposta do sócio: **30-60 min** se for cooperativo, 1 sessão.
