# Departamentos — Resumo executivo

> Sprint Mapa de Departamentos, Tarefa 9.
> 1 página. Leitura em 3 min, decisão concreta no fim.

## O que descobri

- **6 departamentos mapeados** (1 feito — Atendimento, 5 a decidir — Societário, Pessoal, Contábil, Fiscal, Financeiro Interno)
- **180 linhas de matriz no total**: 38% Automatizar + 47% Assistir humano + 15% Fora de escopo
- **Padrão dominante:** o nicho contábil brasileiro tem teto natural de automação em ~60-65%; o resto é "Assistir humano" (geração de dossiê + protocolo humano). Posicionamento "amplifica equipe, não substitui" não é só marketing — é o que os dados públicos sugerem como realista
- **Nenhum departamento ficou inviável** (todos com < 21% "Fora de escopo"). Produto inteiro tem cabimento

## Recomendação de ordem

1. **Atendimento** ✅ (Fase 1, feita)
2. **Societário** — valida padrões arquiteturais novos (Orquestrador, workflow longo, Portal Adapter) em risco médio antes de aplicar em risco alto/altíssimo
3. **Pessoal/Folha** — maior dor + maior alavancagem por sprint, com padrões já validados
4. **Contábil** — núcleo do escritório, posicionar como amplificação
5. **Fiscal** — último porque maior risco regulatório; só faz sentido com plataforma madura
6. **Financeiro Interno** — em paralelo a partir do meio da Fase 2 (atende sócio do escritório, decisor único)

## Por quê (3 bullets)

- **Complexidade arquitetural progressiva.** Societário em 2º introduz Orquestrador + workflow engine + Portal Adapter em risco médio. Pessoal/Fiscal reusam o padrão já estabilizado. Errar arquitetura em risco médio é recuperável; em Fiscal pode custar caro.
- **Calendário de obrigações compartilhado emerge na ordem certa.** Pessoal gera DCTFWeb e EFD-Reinf que Fiscal consolida; Pessoal antes de Fiscal significa Fiscal reusar em vez de construir.
- **Risco de venda escala junto com confiança da plataforma.** Contábil (núcleo do contador) e Fiscal (maior risco) chegam quando escritório-cliente já confia. Atendimento + Societário + Pessoal entregam valor cedo sem ameaçar a identidade do contador.

## O que eu decidi sozinho

- **Mantida a ordem original do `escopo-produto.md`** — mas justificativa mudou. Original assumiu "Societário burocrático e baixo risco"; descoberta confirma médio-alto risco + alta complexidade. Razão pra ficar em 2º é arquitetural, não o que ficou escrito antes. Pode mudar com pergunta Q7 do sócio (preferência pessoal) ou Q1 (volume real).
- **Financeiro Interno em paralelo, não em 6º.** Razão: reusa muito de Pessoal/Contábil/Fiscal aplicados ao próprio CNPJ; ocupa pouca capacidade técnica; vende ao sócio com ciclo curto. Pode mudar se sócio achar que é distração.
- **Tier de autonomia inicial em todos os departamentos: sugestivo.** Mais conservador que Fase 1 default. Pode afrouxar caso a caso após validar.
- **Teto de % Automatizável em 60-65% é tese, não fato.** Bandinha estreita (56-66% nos 5 departamentos estimados) sugere. Sócio pode mostrar prática que contradiz.

## Onde preciso de você

**7 perguntas críticas em `docs/discovery/departamentos-recomendacao-ordem.md` §4.** Resumo:

1. Qual dept consome MAIS horas da equipe? (ranking)
2. Qual gera MAIS reclamação interna? (dor)
3. Por qual cliente sai / qual cliente entra? (diferencial vs proteção)
4. Por qual dept cliente pagaria 30% a mais? (valor percebido)
5. Qual fatura mais? Qual tem maior margem?
6. Já cobraram prejuízo por erro em obrigação acessória? Qual dept?
7. Sua preferência pessoal: qual módulo do produto te deixaria mais feliz?

Tempo estimado de conversa: **45-60 min**, pode ser WhatsApp se ele não tiver tempo de sentar.

## Risco maior se errar a ordem

**Implementar Pessoal ou Fiscal antes de Societário introduz padrões arquiteturais novos (Orquestrador, workflow engine, Portal Adapter) num departamento de risco alto/altíssimo.** Erro arquitetural em Pessoal vira incidente regulatório (multa eSocial, exposição trabalhista); em Fiscal vira incidente fiscal (multa multiplicadora 50-225%, sanção CFC).

Se a opção for "Volume primeiro" (Pessoal em 2º), o trade-off é maior alavancagem mensal × maior risco arquitetural no primeiro deploy pós-Atendimento. Vale só se sócio responder Q1+Q2 sinalizando claramente que DP é a dor #1.

## Próximo passo

**Agendar call com sócio (45-60 min) pra validar perguntas Q1-Q7.**

Após a call:
- Aceita recomendação principal → próximo Sprint = **Sprint 2.1 Fundações Societário** (mas ainda bloqueado pelas 11 perguntas críticas do `societario-perguntas-socio.md`; pode juntar tudo na mesma call estendida pra 90 min)
- Aceita cenário "Volume primeiro" (Pessoal em 2º) → próximo Sprint = **Sprint 3.0-discovery Pessoal** (3-5 dias antes do Sprint 3.1)
- Aceita cenário "Risco depois" (Financeiro Interno antes) → próximo Sprint = **Sprint 6.0-discovery Financeiro Interno** (3-5 dias)

Tempo total até começar próximo módulo: **1-2 semanas** [estimativa].

---

## Anexos (documentos do sprint, na ordem de leitura recomendada)

1. **Este documento** — resumo
2. `docs/discovery/departamentos-recomendacao-ordem.md` — fundamenta a recomendação + cenários alternativos + perguntas pro sócio
3. `docs/discovery/departamentos-mapa-comparativo.md` — espinha técnica (tabela + 3 quadrantes + 10 padrões)
4. `docs/discovery/departamentos/` — 6 fichas detalhadas (Atendimento + 5 outros)
5. `docs/discovery/departamentos-apendice-tecnico.md` — pra Levi/Claude Code abrirem Sprint X.0-discovery depois
