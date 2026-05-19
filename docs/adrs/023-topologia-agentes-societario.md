# ADR-023: Topologia de agentes do departamento Societário

Data: 2026-05-19
Status: aceito (condicional — premissas dependem de validação com sócio na pré-Sprint 2.1)

## Contexto

A Fase 2 abre o segundo departamento da plataforma: **Societário/Legalização**. ADR-010 fixou o modelo de 3 camadas + supervisor (Roteador global → Coordenadores → Especialistas) na Fase 1 com Atendimento. A pergunta da Fase 2: o mesmo molde cabe no Societário ou a natureza do departamento exige adaptação?

A matriz de decisão do Sprint Fase 2.0-discovery (`docs/discovery/societario-matriz-decisao.md`) mostra:

- **53,3% das combinações (obrigação × portal) são "Assistir humano"** — agente prepara documento, monta checklist, monitora prazo; humano efetua o ato no portal.
- **31,1% são "Automatizar"** — predominantemente APIs federais (Receita pós-Junta, consultas públicas, ConectaJusbr) e operações internas (cálculo, calendário, geração de documento).
- **15,6% são "Fora de escopo"** — transformação societária, distrato com complexidade jurídica, atos físicos do cliente.

Implicações relevantes pra topologia:

1. **Processos de longa duração** (5–180 dias úteis). Abertura de empresa: 5–20 dias. Encerramento: 30–180 dias. Não cabe num turno de chat.
2. **Múltiplos passos com dependências** — gerar documento → coletar assinaturas → protocolar na Junta → aguardar deferimento → atualizar Receita pós-Junta. Cada passo pode dormir dias.
3. **Múltiplos portais com semânticas próprias** — JUCESP ≠ JUCERJA ≠ JUCEMG; Prefeitura SP ≠ Prefeitura BH; Receita ≠ Sefaz. Esconder a fragmentação atrás de uma abstração comum melhora reuso e teste.
4. **Volume de "Assistir humano" exige UI rica** — operador humano é parte ativa do fluxo. Agente NÃO substitui — colabora.
5. **Coexiste com Atendimento** — cliente final pergunta "como faço alteração de capital?" pelo WhatsApp; resposta vem de Atendimento, mas se cliente confirma "quero iniciar", handoff vai pra Societário.

Aplicar Atendimento sem adaptação subutiliza essa natureza assíncrona e multi-passo.

## Decisão

Topologia híbrida com **4 papéis** no departamento Societário, organizados em duas dimensões: comunicação síncrona (chat-like) e processo assíncrono (workflow de longa duração).

### Camada 0 (existente, sem mudança)

**Roteador global** continua classificando mensagens externas em departamento de destino. Quando classifica `destination_department='societario'`, emite `message.routed` no bus. Nenhum trabalho novo de roteamento — apenas garantir que o prompt do Roteador já reconhece intents societários (sprint pré-2.1 valida com mais exemplos).

### Camada 1 — Coordenador Societário

Análogo ao Coordenador de Atendimento (ADR-016) — papel conversacional. Subscreve `message.routed` filtrado por `destination_department='societario'`. Sonnet 4.

Responsabilidades:

- **Classificar intent fino** dentro do departamento. Taxonomia inicial (refinar na Sprint 2.1):
  - `consulta` (cliente pergunta "como funciona alteração de capital?") → responde direto
  - `iniciar_processo` (cliente quer começar um ato — alteração de capital, abertura de filial, etc) → instancia `legal_process`, delega Orquestrador
  - `acompanhar_processo` (cliente pergunta "como tá meu processo de abertura?") → consulta domínio, responde com status atual
  - `urgente_juridico` (caso fora de padrão — sucessão, litígio, transformação complexa) → escala humano direto

- **Manter contexto de conversa** — `conversations.intent_current` igual ao padrão de Atendimento.

- **Despachar handoffs** internamente via state do subgraph LangGraph (Especialista Documental, Especialista Operacional) ou via bus pra Orquestrador (cross-process porque o processo tem vida própria).

### Camada 2 — Orquestrador de Processo Societário

**Esse é o agente novo da Fase 2 — não tem análogo na Fase 1.** Não é conversacional; é process manager. Sonnet 4.

Cada `legal_process` instanciado tem um Orquestrador atribuído. O Orquestrador é responsável por:

- **Conhecer o template do processo** (ex: "abertura de empresa" = 7 passos; "alteração contratual de capital" = 4 passos).
- **Avançar passos quando dependências satisfeitas** (ex: só dispara o passo "comunicar Receita" quando o passo "deferimento na Junta" tiver `status=concluido`).
- **Gerar ações pra humano** — se passo é "Assistir humano", Orquestrador cria item de trabalho (`approvals` ou `process_steps.requires_human=true`) e aguarda.
- **Disparar passos automatizados** — chamar Especialista Documental pra gerar documento, chamar tool de portal pra consultar status na Junta, etc.
- **Monitorar prazos** — agendar polling, alertar humano antes do vencimento.
- **Escalonar** — se passo trava (humano não age em N dias, portal retorna erro inesperado, prazo legal por vencer), publica `approval.created` com prioridade pro Supervisor.

Implementação: o Orquestrador é um **agente persistente por processo** — não é um turn-a-turn como o Coordenador. Ele é "acordado" por eventos (timer, callback de portal, ação humana concluída) e roda um turno curto, decidindo o próximo passo. Custo de LLM controlado porque turnos são raros (1 a cada dias, não a cada segundos).

**Decisão técnica adjacente:** Orquestrador roda como um BullMQ job recorrente + state em `legal_processes`/`process_steps`. NÃO é Temporal nesta fase. ADR-022 (workflow engine) discute se isso muda.

### Camada 3 — Especialistas

Subgraph dentro do Coordenador (LangGraph), análogo ao padrão Fase 1. Acionados in-process pelo Coordenador ou via tool call pelo Orquestrador (cross-process via bus).

**Especialista Documental** (default — Sonnet 4). Gera documentos (contratos, minutas de alteração, distratos, atas, dossiês de certidão). Tem ferramentas: templates versionados, validador de cláusulas, integração com `legal_documents` (status, versão).

**Especialista Operacional** (default — Sonnet 4). Responde dúvidas regulatórias do cliente final (similar ao Operacional de Atendimento). Pode ler domínio compartilhado (CNPJ, accounts, processos em curso) read-only.

**Especialista Jurídico** (critical — Opus 4.7). Acionado em casos sensíveis: cessão de quotas com ganho de capital, alteração que pode desenquadrar do Simples, dúvida sobre cláusula contratual atípica. Caro por turno mas raro. Pode escalar humano direto se confidence baixa.

### Camada de suporte — Portal Adapters (NÃO são agentes)

Espelha o padrão ChannelAdapter do Atendimento (ADR-015). Cada portal externo (Receita, JUCESP, JUCERJA, JUCEMG, Prefeitura SP, Prefeitura RJ, etc) tem um adapter em `packages/shared-domain/portals/`.

Contrato mínimo (esboço — definição final na Sprint 2.4):

```typescript
interface PortalAdapter {
  readonly portal: PortalId;
  readonly capabilities: PortalCapabilities;
  
  authenticate(session: PortalSession): Promise<void>;
  healthCheck(session: PortalSession): Promise<PortalHealth>;
  
  // Read-only universal
  query<T>(operation: PortalQuery): Promise<T>;
  
  // Write quando aplicável (a maioria não tem)
  submit?(operation: PortalSubmission): Promise<SubmissionResult>;
}

interface PortalCapabilities {
  supportsApiSubmit: boolean;     // Receita pós-Junta = true; JUCESP = false
  supportsApiQuery: boolean;       // ConectaJusbr = true; Portal Empreendedor = false
  requiresCertificate: 'A1' | 'A3' | null;
  documented: boolean;             // documentação pública oficial?
}
```

Adapters NÃO são agentes — são bibliotecas determinísticas chamadas por tools dos agentes (Orquestrador e Especialistas). Sem LLM dentro deles. Vantagens:
- Teste sem mockar LLM.
- Adapter "Receita pós-Junta via DBE" sai do caminho da maioria dos atos.
- Adapter "JUCESP read-only por NIRE" cobre confirmação de deferimento pra muitas obrigações.
- Adicionar Junta de outro estado = adicionar adapter; agentes não mudam.

### Canais de input

Societário recebe demandas por **três caminhos**:

1. **Handoff do Coordenador de Atendimento** (caminho dominante na Fase 2). Atendimento detecta intent societário ("quero alterar capital", "como abro filial?"), executa `handoff.requested` com payload `{destination_department='societario', context, source_conversation_id}`. Coordenador Societário recebe e continua a conversa no mesmo `conversation_id` (ou abre nova vinculada, decisão da Sprint 2.1).

2. **Iniciação direta pelo operador humano** via UI dedicada — `/dashboard/societario/processos/novo`. Operador escolhe template (abertura, alteração de capital, etc), seleciona `account`, preenche parâmetros mínimos. Backend cria `legal_process` e atribui Orquestrador.

3. **Trigger automático por calendário ou evento de domínio** — vencimento de certificado digital próximo dispara processo de renovação assistida; mudança de CNAE detectada no DBE de outra obrigação dispara revisão tributária. Calendário e detectores são determinísticos; Orquestrador roda o fluxo.

**Caminho NÃO suportado na Fase 2:** cliente final iniciando processo diretamente sem mediação. Mantém princípio "human-in-the-loop forte" — Coordenador ou operador escritório precisa confirmar.

## Alternativas consideradas

### Opção A — Espelhar Atendimento sem adaptação

Coordenador + 2–3 especialistas (operacional, documental, jurídico). Sem Orquestrador.

**Rejeitada** porque agente conversacional turn-a-turn não modela bem processo de longa duração. Sem Orquestrador, ou o Coordenador precisa virar persistente (mistura responsabilidades), ou processo é levado externamente (volta a "humano faz tudo manual"). Subutiliza valor da automação dos passos automáticos da matriz.

### Opção B — Apenas Orquestrador-de-processos, sem Coordenador conversacional

Toda interação vira processo desde o primeiro turno.

**Rejeitada** porque consulta simples ("como funciona alteração de capital?") não é processo — é dúvida. Forçar processo introduz overhead e fricção pro cliente. Coordenador conversacional preserva ergonomia de chat enquanto Orquestrador lida com processo formalmente iniciado.

### Opção C (escolhida) — Híbrido (Coordenador conversacional + Orquestrador de processo + Especialistas + Adapters)

Documentada acima.

### Opção D — Especialistas independentes sem coordenação central, supervisor amarra contexto

Mais flexível, mais arquitetura distribuída.

**Rejeitada** pelo mesmo motivo que ADR-010 rejeitou mesh puro: debug em incidente vira impossível ("quem causou esse loop?"), prompts difusos, ausência de ponto único pra aplicar budgets e aprovações. Já temos Supervisor (ADR-010) — não precisa de outro modelo.

## Consequências

**Positivas:**

- Coordenador Societário herda padrão estabelecido (ADR-016): handoff entre departamentos, classificação de intent, modo shadow, tiers de autonomia funcionam por construção.
- Orquestrador como abstração isolada permite evoluir o modelo de processo (Temporal, Step Functions) sem refactor de agentes. ADR-022 explora opções.
- Portal Adapters reusam padrão de ChannelAdapter (ADR-015). Adicionar Junta de estado novo = adicionar adapter, não mudar agentes.
- Especialista Jurídico em tier crítico (Opus 4.7) acionado raramente — controle de custo via cascade.
- Schema `legal_processes` (ADR-024) compartilhado entre Orquestrador e UI operacional — single source of truth.
- Agente persistente por processo evita LLM em loop infinito (BullMQ com semantics de delayed jobs).

**Negativas:**

- Mais conceitos pra equipe entender (Coordenador vs Orquestrador). Mitigação: documentação clara separando "comunicação síncrona" (chat) de "processo assíncrono" (workflow); diagrama em `docs/architecture/societario-topology.md` (criar na Sprint 2.1).
- Risco de "qual agente lida com isso?" durante implementação. Mitigação: regra clara — se é conversa, Coordenador; se é processo iniciado, Orquestrador; sempre via bus, nunca direto.
- Cross-talk entre Orquestrador e Coordenador (cliente pergunta no meio do processo "como tá?") exige sincronização. Mitigação: Coordenador consulta `legal_processes` direto via tool read-only; Orquestrador NÃO conversa com cliente — Coordenador é canal de comunicação único.
- Portal Adapters podem virar muitos (10+ até fim da Fase 2). Manutenção exige disciplina — cada adapter tem owner técnico claro.

**Restrições de implementação:**

- Coordenador Societário SEMPRE consulta domínio antes de responder — não inventar status de processo. Tool `getLegalProcessSnapshot` é obrigatória.
- Orquestrador NUNCA fala direto com cliente final. Comunicação cliente ↔ Orquestrador passa pelo Coordenador via `conversations`.
- Especialista Jurídico tem budget mais alto que outros (Opus é caro) mas com hard stop em N turnos. Loops aqui são caros.
- Portal Adapters NÃO carregam credenciais inline — `portal_sessions.secrets_ref` aponta pra secrets manager (mesma regra do ChannelAdapter, ADR-015).
- Adicionar agente especialista novo na Fase 2 é trivial (adicionar node ao subgraph); adicionar Orquestrador novo (ex: especializado em encerramento) exige ADR — não fazer sem razão clara.

## Decisões deixadas pra próximas sprints

- **Templates de processo** (ordem dos passos, dependências exatas, prazos): Sprint 2.2 desenha os 3–5 primeiros templates (Alteração de Capital, Alteração de Sócios, Atualização Cadastral CNPJ, Abertura de Empresa, Abertura de Filial — definir prioridade exata com sócio).
- **Contrato exato do `PortalAdapter`** (capacidades, tipos): Sprint 2.4 quando primeiro portal real entra.
- **Quantos Especialistas exatos no MVP da Fase 2**: estimativa 2–3; ajusta na Sprint 2.2 conforme templates exigem.

## Quando reverter

- Se na Sprint 2.2, primeiro template real (com sócio validando o fluxo) mostrar que Orquestrador precisa virar "stateful por turno" com mais estado do que `process_steps.next_action` cabe → considerar adoção antecipada de Temporal (gatilho de ADR-022 dizer "sim, Temporal").
- Se >3 templates de processo divergirem tanto que Orquestrador único vire árvore de switch impossível de manter → considerar Orquestrador especializado por categoria de processo (criar ADR sucessor).
- Se Coordenador + Orquestrador gerarem latência/custo dobrado sem ganho funcional → considerar unificar (Coordenador absorve papel de "iniciar processo" mas mantém modelo de turn-a-turn) e usar Temporal como "processo persistente puro" sem agente dedicado.

## Vínculo com ADRs adjacentes

- **ADR-010** (orquestração 3 camadas): este ADR estende o modelo adicionando "agente persistente por processo" como variação válida da Camada 2.
- **ADR-014** (escopo Atendimento Fase 1): Coordenador Societário é simétrico ao Coordenador de Atendimento.
- **ADR-015** (ChannelAdapter): Portal Adapters seguem o mesmo padrão de abstração — design orientado ao adapter mais restritivo.
- **ADR-016** (Coordenador como camada de roteamento): Coordenador Societário subscreve `message.routed` filtrado por `destination_department='societario'`.
- **ADR-017** (modo shadow + tiers): mesmas semânticas se aplicam — tier do tenant configura comportamento do Coordenador. Aprovação humana em "Assistir humano" usa `approvals` (ADR-006) com semantics de processo, não `message_drafts`.
- **ADR-024** (schema `legal_processes`): esquema necessário pra esta topologia funcionar — define exatamente o que Orquestrador manipula.
- **ADR-022** (workflow engine — condicional): justificado pela complexidade de processos multi-passo. Avalia se BullMQ basta ou se Temporal entra.
