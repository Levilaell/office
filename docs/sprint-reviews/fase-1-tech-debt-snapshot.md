# Fase 1 — Snapshot consolidado de tech-debt

> Snapshot fechado em **2026-05-19** ao fim do Sprint 1.6.
> Fonte canônica continua sendo `docs/tech-debt.md` — este arquivo é um
> recorte categorizado por urgência pra Fase 2.

## Estado de fim de Fase 1

- **TDs fechados na Fase 1:** 5 (TD-001, TD-002, TD-004, TD-017, TD-022, TD-027)
- **TDs abertos persistidos:** 22 itens
- **TDs persistidos no Sprint 1.6:** TD-030, TD-031, TD-032 (do Sprint 1.3 que nunca foram), TD-033, TD-034, TD-035 (novos do 1.6)
- **TDs ainda só em sprint-review (não persistidos):** zero — todos foram reconciliados

## Categorização por urgência pra Fase 2

Convenção:
- 🔴 **Bloqueia Fase 2** — resolver antes de começar Societário (Sprint Fase 2-prep)
- 🟡 **Cedo na Fase 2** — não bloqueia mas vale resolver na primeira metade da Fase 2
- 🟢 **Fase 3+** — pode esperar; só atacar se virar reclamação

---

### 🔴 Bloqueia Fase 2 (Sprint Fase 2-prep)

| ID | Título | Estimativa | Por que bloqueia |
|---|---|---|---|
| TD-012 | `database.types.ts` editado à mão | 30 min | Próximos sprints vão criar mais tabelas e o drift aumenta o risco de bug invisível. Rodar `pnpm db:types --linked` + commitar é o primeiro passo. |
| TD-019 | Coordenador subscreve `message.received` direto | médio (~4h) | Coordenador atual classifica TODA mensagem inbound como Atendimento. Quando Pessoal/Fiscal entrar, vai roteamento errado. Introduzir `message.routed` + Roteador na cadeia. |
| TD-032 | Suite formal de RLS em tools do Atendimento | médio (~4h) | Padrão de tools (`getAccountSnapshot`, `getObligationsForAccount`...) será replicado em todos os departamentos. Cobertura de RLS via teste de 2 tenants concorrentes evita regressão em massa. |

**Total estimado:** ~1 dia de trabalho dedicado.

### 🟡 Cedo na Fase 2 (Sprint 2.1+)

| ID | Título | Estimativa | Motivo |
|---|---|---|---|
| TD-003 | Eventos `task.*`/`approval.*` carregam delta, não snapshot | ~4h | Vai amplificar quando UI mostrar mais entidades concorrentes — Societário tem mais aprovações que Atendimento. |
| TD-006 | `.env.local` duplicado em 3 apps | ~2h | Voltou a doer no Sprint 1.5; vai doer mais quando agent-runtime ganhar mais variáveis específicas (Calendar, etc). |
| TD-013 | Webpack Next não resolve `.js` em shared-domain | médio | Próximo refactor de TS config dos packages — alinhar moduleResolution. |
| TD-015 | Eval do Coordenador roda em replay puro | médio (~1 dia) | Mudança de prompt sem eval real degrada accuracy silenciosamente. Workflow scheduled rodando bateria com LLM real + cassette gravado. |
| TD-018 | conversations sem `assigned_to` nem status `waiting_human` | médio (~3h) | Query "todas as conversations aguardando humano" hoje exige scan de metadata — vai escalar mal. Refactor antes de adicionar dashboards. |
| TD-026 | Draft órfão pending em send_failed | médio | Volume baixo Fase 1 absorve; quando canais reais (WhatsApp Evolution) entrarem, taxa de falha de envio sobe. Status `send_failed` dedicado + retry. |
| TD-029 | Janela <50ms entre read-and-send permite duplicate send | médio (~3h) | Quando segundo tenant com 3+ operadores chegar, race vira incidente real. Padrão "claim atomic → send → complete". |

**Total estimado:** ~4 dias.

### 🟢 Fase 3+ ou sob demanda

| ID | Título | Tags |
|---|---|---|
| TD-005 | Script `seed-existing-tenants.ts` aponta pra URL errada | DX |
| TD-007 | Turbo dev sai com "0 successful" | cosmético |
| TD-008 | ESLint 8 deprecated | dep |
| TD-009 | Peer dep do Clerk v7 no Next 15 | dep |
| TD-010 | Naming inconsistente de ADRs | docs |
| TD-011 | `docs/adrs/README.md` sem seções por status | docs |
| TD-014 | CI do PR #2 não pegou quebra de build | CI |
| TD-016 | Catálogo de intents como constante (não tabela) | extensibilidade |
| TD-020 | Pre-classify determinístico mínimo | custo |
| TD-021 | `leads.primary_contact_id` sem FK (`contacts` não existe) | schema |
| TD-023 | `leads` sem unique partial index | data integrity |
| TD-024 | `schedule-parser` não converte horário em Date | Fase 2 (Calendar) |
| TD-025 | `display_settings` sem `commercial_lead_name` | UX texto |
| TD-028 | Diff de edição salvo em JSONB mas UI só mostra "editado" | UX |
| TD-030 | Catálogo de tipos de obligation/document como constante | extensibilidade |
| TD-031 | Storage de arquivos pra `documents` ainda não existe | feature |
| TD-033 | HUD da sala Atendimento fixo (não viewport-aware) | UX canvas |
| TD-034 | Modo demo sem auto-login | demo |
| TD-035 | Cleanup de tenant demo é manual | demo |

**Total estimado:** ~3-5 dias se atacar tudo (mas não vale tudo, só sob demanda).

---

## Sugestão de ordem de ataque

### Sprint Fase 2-prep (antes de começar Societário)

1. **TD-012** primeiro — rodar `pnpm db:types --linked` + commitar antes de tocar em qualquer schema novo. 30 min.
2. **TD-019** — introduzir `message.routed` + Roteador na cadeia inbound. Coordenador subscribe filtered by `destination_department`. Sem esse, segundo departamento quebra. ~meio dia.
3. **TD-032** — suite de RLS pras tools. Garante que padrão se mantém em Societário/Pessoal/Fiscal. ~meio dia.

### Sprint 2.1 (primeira metade Fase 2)

4. **TD-018** — coluna `assigned_to` + status `waiting_human`. Refactor de `act.ts` pra setar status em vez de metadata.
5. **TD-029** — claim atomic no /decide. Sprint pré-condição: identificar todos os endpoints que rodam fluxo "read → side effect → update" sem claim.
6. **TD-006** — single source `.env.local` na raiz. Trabalho mecânico mas vai economizar fricção em todos os sprints subsequentes.

### Sprint 2.2-2.3 (segunda metade Fase 2)

7. **TD-003** — migrar eventos pra snapshot completo. Volume vai justificar.
8. **TD-015** — workflow eval scheduled com LLM real. Pré-condição pra evoluir prompts confiavelmente.
9. **TD-026** — status dedicado `send_failed` + retry, junto com integração WhatsApp real.

### Sob demanda (sem trigger arquitetural)

10. Tudo do bloco 🟢 — atacar individualmente quando virar reclamação OU agrupar num "sprint de DX" se Levi quiser pagar dívida.

---

## TDs novos descobertos no processo de consolidação

Durante este levantamento, identifiquei que TDs 023-025 do Sprint 1.3 (Catálogo
de obligation/document, Storage de arquivos, Suite formal de RLS) ficaram só
no self-review e nunca foram persistidos em `docs/tech-debt.md`. Sprint 1.6
persistiu como TD-030, TD-031, TD-032.

Sprint 1.5 já tinha persistido TD-021 do Sprint 1.3 ("Draft + envio direto"
temporário) implicitamente quando fechou TD-022 — comentário no review do 1.5
documenta. Sem ação adicional.

---

## Conclusão

Fase 1 termina com **22 TDs abertos**, dos quais **3 bloqueiam Fase 2** e
exigem ~1 dia de trabalho no Sprint Fase 2-prep antes de Societário começar.
Outros 7 valem resolver cedo na Fase 2 (~4 dias somados). O restante é
oportunista.

Saúde da dívida técnica: ✅ controlada. Nenhum item compõe risco de produção
em volume Fase 1 (1 cliente real). A Fase 2 começa com base estável desde
que TD-019 (roteamento de departamentos) e TD-032 (RLS suite) sejam
endereçados antes de Societário entrar — o resto pode acumular sem
amplificar.
