# Departamentos — Mapa comparativo

> Sprint Mapa de Departamentos, Tarefa 6.
> **Documento mais importante técnico do sprint.** Toda recomendação de ordem
> (Tarefa 7) e resumo executivo (Tarefa 9) derivam daqui.
>
> Cada linha de departamento é abstraída de
> `docs/discovery/departamentos/{nome}.md`.

## Critérios de classificação aplicados (escala compartilhada)

Pra comparar é preciso medir do mesmo jeito. Os 6 departamentos foram classificados nas mesmas dimensões usando os critérios abaixo. O Atendimento (Fase 1 entregue) serve de **âncora real** — sua classificação não é palpite, é o que aconteceu.

### Volume típico (eventos processáveis por unidade de tempo)
- **Altíssimo:** contínuo, vários eventos por dia (Atendimento, Contábil)
- **Alto:** rotina mensal × N clientes (Pessoal, Fiscal)
- **Médio:** rotina mensal × 1 organização ou anual × N (Financeiro Interno)
- **Baixo:** esporádico, 1-2 por cliente/ano (Societário)

### Dor escritório (tempo da equipe + retrabalho + estresse de prazo)
- **Altíssima:** > 30% do tempo + retrabalho frequente + prazo inflexível
- **Alta:** 15-30% do tempo + retrabalho moderado + prazo apertado
- **Média:** 5-15% do tempo + retrabalho ocasional + prazo flexível
- **Baixa-Média:** < 10% do tempo + retrabalho raro

### Risco regulatório (impacto se IA errar)
- **Altíssimo:** multa pesada com multiplicador (50-225%) + sanção CFC + responsabilidade criminal em fraude (Fiscal)
- **Alto:** multa por evento + responsabilidade trabalhista + retrabalho em fiscalização (Pessoal)
- **Médio-Alto:** ato pode ser juridicamente nulo + dever fiduciário (Societário)
- **Médio:** cascateia em outro dept (Contábil → Fiscal) ou retrabalho com cliente (Atendimento)
- **Baixo:** erro interno corrigível, sem multa de Receita (Financeiro Interno)

### % Automatizável (soma "Automatizar" + 50% × "Assistir humano" / total)
Calculado direto da matriz de cada documento de departamento.

### Complexidade técnica
- **Alta:** > 3 integrações externas + workflow > 7 dias + estado persistente complexo (Societário, Contábil, Fiscal)
- **Média:** 1-3 integrações externas + workflow < 7 dias + estado simples (Pessoal, Atendimento)
- **Baixa:** 0-1 integração + síncrono + estado simples (Financeiro Interno)

### Tempo de implementação
Sprints estimados × 2-3 semanas cada. Atendimento (real) foi ~3 meses com 6-7 sprints.

---

## Seção 1 — Tabela comparativa principal

| Dept | Volume | Dor escritório | Risco regulatório | % Automatizável | Complex. técnica | Tempo estimado | Status |
|---|---|---|---|---|---|---|---|
| **Atendimento** | Altíssimo | Alta | Médio | **~73% real** | Média | **~3 m (real)** | ✅ Fase 1 |
| **Societário** | Baixo | Média | Médio-Alto | 57.5% | Alta | ~2.75 m (5 sprints) | A decidir |
| **Pessoal** | Alto | Altíssima | Alto | 56% | Média | 3-4 m (5-7 sprints) | A decidir |
| **Contábil** | Altíssimo | Alta | Médio | 63% | Alta | 4-6 m (6-9 sprints) | A decidir |
| **Fiscal** | Alto | Altíssima | Altíssimo | 62% | Alta | 5-7 m (8-12 sprints) | A decidir |
| **Financeiro Int.** | Médio | Baixa-Média | Baixo | 66% | Baixa | 2-3 m (3-5 sprints) | A decidir |

**Observações:**

- **Atendimento é o único com `%` real**, não estimado. Os outros são chute fundamentado (matrizes de 25-33 linhas por departamento).
- **Soma de tempo estimado** dos 5 restantes = **17-25 meses** se sequencial. Compatível com a estimativa macro de `escopo-produto.md` (16-20 meses pra plataforma completa, contando Fase 0 + Fase 1 já feitos).
- **Mais alto risco regulatório:** Fiscal. **Mais alto volume:** Contábil. **Maior dor:** Pessoal e Fiscal (empatados).
- **Único com Volume Baixo:** Societário — compensa parcialmente pela ausência de competição forte na automação de processos societários.

---

## Seção 2 — Quadrantes (gráficos 2x2)

Cada quadrante explora uma combinação chave de dimensões. Departamento plotado na célula mais representativa.

### Quadrante A — Volume × % Automatizável (máxima alavancagem)

Premissa: alto volume × alto % automatizável = mais horas/mês liberadas por sprint investido.

```
                            % Automatizável  →
                  Baixo (<50%)   Médio (50-60%)   Alto (>60%)
   Volume  ↓
   Altíssimo                     ─                Atendimento, Contábil
   Alto                          Pessoal          Fiscal
   Médio                         ─                Financeiro Interno
   Baixo                         Societário       ─
```

**Leitura:**
- **Top-right (sweet spot):** Atendimento (feito) e Contábil. Mais alavancagem por sprint.
- **Mid-right:** Fiscal e Pessoal. Alto volume, automatizável "alto-médio".
- **Médio**: Financeiro Interno (alto auto, mas volume médio).
- **Baixo-esquerda:** Societário (baixo volume; automatizar tudo libera menos horas).

**Implicação:** se a métrica é "horas/mês liberadas", a sequência otimizada seria Contábil → Fiscal/Pessoal → Financeiro Interno → Societário. Mas essa não é a única métrica.

### Quadrante B — Dor escritório × Risco regulatório (próximo melhor candidato)

Premissa: alta dor × baixo risco = ideal pra próximo (libera muito, expõe pouco).

```
                                Risco regulatório →
                    Baixo            Médio              Alto          Altíssimo
   Dor   ↓
   Altíssima                                            Pessoal       Fiscal
   Alta                             Atendimento, Contábil
   Média                            Societário (médio-alto)
   Baixa-Média        Financeiro Int.
```

**Leitura:**
- **Top-left (sweet spot — alta dor, baixo risco):** nenhum. Departamentos de alta dor têm risco alto por natureza no nicho contábil (regulado).
- **Mid-left:** Atendimento (alta dor, médio risco) — fez sentido como Fase 1. Contábil tem perfil similar.
- **Top-right (dor + risco):** Pessoal e Fiscal. Maior alavancagem por dor, maior risco. Exige tier conservador.
- **Bottom-left:** Financeiro Interno (baixa dor, baixo risco) — fica "seguro mas pouco impactante" do ponto de vista de venda externa.

**Implicação:** não há "free lunch" em contábil. Próximos departamentos depois do Atendimento têm trade-off explícito dor × risco. Argumenta pra **complexidade arquitetural progressiva** — introduzir padrões de Orquestrador, workflow longo, Portal Adapter num departamento de risco médio (Societário) antes de aplicar em risco alto (Pessoal) ou altíssimo (Fiscal).

### Quadrante C — Tempo de implementação × Impacto comercial (vitória rápida vs estratégia longa)

Premissa: pouco tempo × alto impacto = vitória rápida. Tempo longo só vale com alto impacto.

```
                             Tempo estimado →
                  Curto (<3m)      Médio (3-5m)        Longo (5-7m)
   Impacto    ↓
   Alto                            Pessoal, Contábil   Fiscal
   Médio       Financeiro Int.     Societário          ─
   Baixo                           ─                   ─
```

**Leitura:**
- **Top-left (vitória rápida + alto impacto):** nenhum departamento. Tempo curto vem com impacto médio (Fin. Interno) ou baixo volume (Societário).
- **Top-mid (médio tempo + alto impacto):** Pessoal e Contábil. Investimento médio com retorno alto.
- **Top-right (longo + alto impacto):** Fiscal. Vale por ser core, mas requer plataforma madura.
- **Mid-left (curto + médio impacto):** Financeiro Interno. Vitória rápida pra sócio (não pra equipe).

**Implicação:** se urgência comercial é alta, Financeiro Interno é vitória rápida pra fechar venda inicial (ao sócio); Pessoal/Contábil são investimentos médios de alto retorno.

---

## Seção 3 — Padrões observados

1. **Não há "fácil + alto valor" no nicho.** Todo departamento de alto valor (Pessoal, Contábil, Fiscal) tem risco regulatório alto. Atendimento foi a exceção e por isso foi a escolha textbook pra Fase 1.

2. **Contábil tem maior alavancagem por volume, mas é o de maior risco de venda.** É o núcleo da identidade do escritório — contador titular pode resistir à automação. Posicionamento precisa enfatizar amplificação (lançamento/conciliação), não substituição (política/fechamento).

3. **Pessoal e Fiscal são os "vingadores" da dor.** Maior dor, alto risco, maior alavancagem por sprint depois de feito. Mas exigem plataforma já madura — Orquestrador, modo shadow estrito, calendário de obrigações compartilhado, integrações maduras.

4. **Societário é o único de complexidade arquitetural alta com risco médio.** Permite validar padrões novos (Orquestrador, workflow engine, Portal Adapter) num cenário de risco menor antes de aplicar em Pessoal/Fiscal — onde erro arquitetural tem custo regulatório maior.

5. **Financeiro Interno é "leve" em complexidade técnica e baixo em risco**, mas atende um comprador diferente (o sócio do escritório, não o cliente final). Pode rodar **em paralelo** com qualquer um dos outros porque reusa muito (Pessoal/Contábil/Fiscal aplicados ao CNPJ do próprio escritório). Não disputa equipe técnica.

6. **Complexidade técnica e risco regulatório NÃO se correlacionam totalmente.** Societário tem complexidade alta com risco médio (humano sempre protocola). Pessoal tem complexidade média com risco alto. Não dá pra usar uma como proxy da outra.

7. **% Automatizável dos 5 estimados converge em 56-66%.** Bandinha estreita. Sinaliza que o tipo de departamento contábil brasileiro tem teto natural de automação em ~60-65% — o resto é "Assistir humano" (geração de dossiê + protocolo humano) ou "Fora de escopo" (ato físico, ato do cliente, decisão estratégica). Posicionamento "amplifica equipe, não substitui" não é só marketing — é o que os dados públicos sugerem como realista.

8. **Atendimento sustenta os outros, não fatura sozinho.** Mas é o **canal único** por onde dúvidas dos outros departamentos vão entrar. Maturidade do Atendimento como porta de entrada é pré-condição pra outros departamentos escalarem o atendimento humano.

9. **Calendário de obrigações compartilhado é alavancagem cruzada.** Pessoal e Fiscal geram obrigações no calendário; Atendimento e Financeiro Interno consomem (lembretes, status, cobrança). Quem implementar primeiro paga o custo da construção; quem vier depois reusa. Argumenta pra **Pessoal antes de Fiscal** (Pessoal gera DCTFWeb que Fiscal consolida).

10. **Stop rule de "Inviabilidade" NÃO disparou em nenhum departamento.** Nenhum ficou com > 60% "Fora de escopo". Distribuição mais "Fora" foi Pessoal e Atendimento (~20%) e Societário (16%). Significa: produto inteiro **tem cabimento** em todos os 5 departamentos restantes; nenhum é "não vale fazer".

---

## Seção 4 — Análise: ordem original do escopo × descobertas

### Ordem original (`docs/escopo-produto.md`)

1. Atendimento → 2. Societário → 3. Pessoal → 4. Contábil → 5. Fiscal → 6. Financeiro Interno

**Racional original** (vide `escopo-produto.md` §Camada 4):
- "Atendimento — porta de entrada, baixo risco, alto valor percebido"
- "Societário — burocrático, padronizado, baixo risco"  
- "DP/Folha — alto valor, risco médio"
- "Contábil — núcleo do escritório, risco médio-alto"
- "Fiscal — maior risco regulatório, maior diferencial, por último"
- "Financeiro Interno — independente, em paralelo a qualquer um"

### Comparação com o que as descobertas mostraram

| Item | Original | Descoberto | Confirma ou Diverge? |
|---|---|---|---|
| Atendimento primeiro | ✅ baixo risco, alto valor | ✅ 73% automatizável real, validou arquitetura | **Confirma**. Decisão acertada. |
| Societário "burocrático, padronizado, baixo risco" | Sim | Médio-alto risco (ato pode ser nulo), complexidade ALTA (Orquestrador novo, workflow engine novo, Portal Adapter novo) | **Diverge parcialmente**. Mais arriscado e mais complexo que o assumido. Mas complexidade arquitetural é introdução boa antes de Pessoal/Fiscal. |
| Pessoal "alto valor, risco médio" | Médio risco | **Alto** risco (eSocial, rescisão, multa por evento) | **Diverge**. Risco real mais alto que o assumido. Mas tier conservador resolve. |
| Contábil "núcleo, risco médio-alto" | Médio-alto risco | **Médio** risco regulatório direto, mas alto risco de venda (núcleo da identidade do escritório) | **Diverge**. Risco regulatório direto menor; risco de venda maior. |
| Fiscal "maior risco, por último" | ✅ | ✅ Altíssimo risco confirmado | **Confirma**. Último faz sentido. |
| Financeiro Interno "em paralelo" | ✅ | ✅ Reusa Pessoal/Contábil/Fiscal aplicados ao próprio CNPJ; pode rodar em paralelo | **Confirma**. |

### Diferenças que sugerem revisão da ordem

**1. Pessoal merece subir antes de Contábil.** A ordem original colocou Pessoal em 3º e Contábil em 4º — descoberto confirma essa ordem. Não muda nada aqui.

**2. Societário em 2º se mantém DEFENSÁVEL, mas pelo motivo *errado* da ordem original.** Original assumiu "burocrático, padronizado, baixo risco". Real: complexidade alta + risco médio-alto. **Mantém porque introduz padrões arquiteturais novos (Orquestrador, workflow engine, Portal Adapter) num cenário de risco controlado antes de aplicar em departamentos de risco maior.** Esse é o motivo a defender, não o original.

**3. Financeiro Interno pode aparecer mais cedo se urgência comercial for alta.** Em paralelo a qualquer um, mas com particularidade: comprador é o sócio (decisor único, ciclo curto). Pode virar **vitrine pro sócio** em uma demo comercial inicial — sócio assina pra ele mesmo primeiro, depois ativa pra clientes finais.

**4. Anti-sunk-cost teste pro Societário:** se a discovery e os ADRs do Societário **não existissem ainda**, qual ordem eu recomendaria?

Resposta honesta: **Pessoal em 2º faria mais sentido por dor e volume.** Mas a complexidade arquitetural progressiva (introduzir Orquestrador em risco médio antes de risco alto) é argumento técnico forte e independente do trabalho já feito. Conclusão: **Societário em 2º se justifica em si**, não pelo sunk cost.

### O que muda da ordem original

- Confirma Atendimento → Societário → Pessoal → Contábil → Fiscal como ordem viável
- Reposiciona Financeiro Interno: pode rodar **em paralelo** ou **mais cedo** se sócio decisor único quiser auto-servir antes de oferecer pra cliente
- Reforça que **Sociedade em 2º não é "baixo risco como original"; é "complexidade arquitetural antes de risco alto"** — ajuste de justificativa, não de posição

A recomendação completa, com cenários alternativos justificados, fica em `docs/discovery/departamentos-recomendacao-ordem.md`.

---

## Anexo — Como calcular % Automatizável

Cada matriz de departamento classifica linhas em 3 buckets: Automatizar, Assistir humano, Fora de escopo. Fórmula usada:

```
% Automatizável = (Automatizar + 0.5 × Assistir humano) / Total
```

Razão: "Assistir humano" automatiza preparação (50% do esforço), humano executa o passo final (50% do esforço). Soma ponderada estima libertação de tempo.

Aplicado a cada departamento:

| Dept | Total | Auto | Assistir | Fora | % Automatizável |
|---|---|---|---|---|---|
| Atendimento | 19 | 13 | 2 | 4 | 73% |
| Societário | 45 | 14 | 24 | 7 | 57.5% |
| Pessoal | 25 | 7 | 14 | 4 | 56% |
| Contábil | 28 | 10 | 15 | 3 | 63% |
| Fiscal | 33 | 12 | 17 | 4 | 62% |
| Financeiro Int. | 30 | 13 | 14 | 3 | 66% |

Soma de Total = 180 linhas mapeadas no sprint (Societário traz 45 do discovery anterior). Distribuição agregada: 38% Automatizar + 47% Assistir humano + 15% Fora de escopo. Posicionamento "amplifica equipe" confirmado pelos dados de todos os 6 departamentos.
