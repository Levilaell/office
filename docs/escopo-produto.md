# Escopo de Engenharia — Plataforma de Agentes de IA para Escritórios Contábeis

## Visão de produto

Plataforma multi-tenant que oferece a escritórios contábeis brasileiros uma operação completa de agentes de IA organizados em departamentos, com interface visual de "escritório virtual" onde o cliente vê os agentes operando lado a lado com sua equipe humana.

**Posicionamento:** "Multiplique a capacidade do seu escritório contábil com uma operação de IA que trabalha junto com sua equipe — não no lugar dela."

**Cliente ideal de entrada:** escritórios contábeis brasileiros de 4-15 pessoas que cresceram e travaram em capacidade. Expansão futura: solo e médio.

**Modelo de negócio:** assinatura mensal por departamento ativado, com tiers conforme tamanho do escritório.

---

## Princípios de design (não-negociáveis)

1. **Plataforma, não produto.** Adicionar departamento novo é configuração + lógica de domínio, não reescrita de infra.
2. **Estado compartilhado, agentes especializados.** Departamentos consultam modelo de dados unificado do cliente final. Impede contradição.
3. **Determinismo onde possível, IA onde necessário.** Agente decide, workflow executa. IA pra interpretação/julgamento; código pra cálculos/execuções.
4. **Human-in-the-loop por design.** Toda ação de impacto externo passa por aprovação humana configurável.
5. **Auditabilidade total.** Todo evento, prompt, resposta de modelo, ação tomada é registrado imutavelmente. Requisito regulatório.
6. **Multi-tenant desde o dia 1.** Platform → Tenant (escritório) → Account (cliente final) → Entity (operações da empresa cliente).
7. **Autonomia configurável em tiers.** Cliente escolhe entre níveis predefinidos (manual / sugestivo / semi-autônomo / autônomo) por agente. Não liberdade absoluta.

---

## Stack tecnológica definitiva

### Frontend
- **Next.js 14+** (App Router) com TypeScript
- **React + Tailwind CSS** + shadcn/ui pra componentes
- **PixiJS** pra canvas isométrico do "escritório virtual"
- **Socket.io client** pra eventos em tempo real
- **TanStack Query** pra estado de servidor
- **Zustand** pra estado local

### Backend
- **Next.js API routes** pra endpoints rápidos (CRUD, auth flows)
- **Serviço Node.js separado** pra runtime de agentes (Express/Hono) — evita timeout serverless
- **LangGraph.js** como framework de orquestração de agentes
- **Bull/BullMQ** (Redis) pra filas de tarefas
- **Temporal** pra workflows determinísticos de longa duração (introduzir na Fase 2+)

### Dados
- **Supabase** (Postgres + Storage + Realtime) — banco principal e storage
- **pgvector** (extensão do Postgres) pra embeddings/memória semântica
- **Redis** (Upstash ou Railway) pra cache, filas, pub/sub

### Autenticação
- **Clerk** com Organizations habilitado pra multi-tenancy
- Mapeamento: Clerk Org = Tenant (escritório); Clerk User = pessoa; roles via Clerk metadata

### IA / LLM
- **Claude (Anthropic)** como modelo principal
  - Sonnet 4 pra maioria das tarefas
  - Opus 4.7 pra decisões críticas e raciocínio complexo
  - Haiku 4.5 pra triagem, classificação rápida, geração simples
- **OpenAI** como fallback secundário
- **Langfuse** pra observabilidade de LLM (self-hosted ou cloud)

### Infraestrutura
- **Fase inicial:** Railway (deploy simples, dev experience boa)
- **Pós-MVP:** Fly.io (multi-região, melhor pra serviços com estado) ou AWS São Paulo
- **CDN:** Cloudflare na frente de tudo
- **CI/CD:** GitHub Actions

### Observabilidade
- **Langfuse** pra LLM tracing
- **Sentry** pra erros de aplicação
- **Better Stack** ou **Grafana Cloud** pra logs e métricas
- **PostHog** pra analytics de produto

---

## Arquitetura em 7 camadas

### Camada 1: Infraestrutura e plataforma
Fundação genérica, sem domínio contábil.

- Gateway de API (Next.js routes + middleware)
- Autenticação via Clerk com Organizations
- RBAC granular (owner_tenant, manager, operator, end_client, ai_supervisor)
- Banco multi-tenant (row-level security no Supabase)
- Object storage versionado
- Filas e pub/sub via Redis
- Workflow engine (Temporal a partir da Fase 2)
- Observabilidade unificada por trace_id

### Camada 2: Orquestração de agentes (kernel)
Coração da plataforma.

- **Runtime de agentes:** abstração com identidade, papel, ferramentas, escopo, prompts versionados, métricas
- **Bus de eventos interno:** agentes publicam, outros subscrevem. Sem chamadas diretas (evita acoplamento e loops)
- **Memória em 3 camadas:** tarefa (efêmera), conversa (média), semântica (vetor)
- **Sistema de handoff:** protocolo formal de transferência entre agentes
- **Supervisor/orquestrador:** agente meta que monitora, detecta loops, escala pra humano
- **Limites/budgets:** teto de tokens, turnos, custo por tarefa por agente

### Camada 3: Domínio contábil compartilhado
Modelo de dados que TODOS departamentos consultam — garante coerência.

- **Cliente final canônico:** cadastro, regime tributário, sócios, funcionários, contas, sistemas, preferências
- **Calendário de obrigações:** todas obrigações fiscais/trabalhistas/societárias por empresa cliente
- **Histórico unificado:** linha do tempo única de toda interação
- **Base de conhecimento normativa:** legislação, jurisprudência, procedimentos internos, indexada vetorialmente
- **Repositório documental:** documentos classificados, extraídos, versionados

### Camada 4: Departamentos (módulos de domínio)
Cada um registra agentes no kernel e opera sobre domínio compartilhado.

**Ordem de implementação (do menor pro maior risco):**

1. **Atendimento/Relacionamento** — porta de entrada, baixo risco, alto valor percebido
2. **Societário/Legalização** — burocrático, padronizado, baixo risco
3. **Departamento Pessoal/Folha** — alto valor, risco médio
4. **Contábil** — núcleo do escritório, risco médio-alto
5. **Fiscal** — maior risco regulatório, maior diferencial, por último
6. **Financeiro Interno do Escritório** — independente, em paralelo a qualquer um

Cada módulo expõe: agentes, ferramentas específicas, regras de aprovação, painel visual.

### Camada 5: Integrações externas

- **Sistemas contábeis BR:** Domínio Sistemas, Alterdata, Sage, Questor, Conta Azul, Omie (priorizar por base de clientes)
- **Governo:** eSocial, EFD-Reinf, DCTFWeb, Receita Federal, Junta Comercial, Prefeituras (RPA onde não tem API)
- **Bancos:** Open Finance pra conciliação
- **Comunicação:** WhatsApp Business API, e-mail (SMTP/IMAP), SMS
- **Documentos:** Google Drive, OneDrive, Dropbox

### Camada 6: Interface visual (escritório virtual)

**MVP:**
- Canvas isométrico 2D simples com PixiJS
- Cada departamento = uma sala
- Agentes = avatares com estados visuais (ocioso, trabalhando, esperando aprovação, em erro)
- Mensagens entre agentes = balões
- Tarefas = itens visíveis sendo manipulados
- Painéis sobrepostos (UI tradicional) pra ações reais
- Toggle entre modo "escritório" (visual) e "operacional" (tabelas, filtros)

**Evolução pós-MVP:**
- Animações mais ricas
- Customização de avatares por tenant
- "Construção" do escritório conforme cliente ativa departamentos
- Modo apresentação pra demos comerciais

### Camada 7: Operação interna do produto

- Painel de saúde da plataforma (métricas por tenant, alertas, incidentes)
- Sistema de prompts versionados (rollback, A/B)
- Eval contínuo (testes de regressão automáticos)
- Cockpit de intervenção (entrar manualmente quando agente trava)
- Faturamento e métricas de negócio (uso, custo LLM, margem por cliente)

---

## Modelo de dados conceitual

```
Hierarquia:
platform → tenants (escritórios) → accounts (clientes finais) → entities

Tabelas core:
- tenants, accounts, entities
- users, roles (via Clerk + tabela de mapeamento)
- agents (instâncias ativas), agent_runs, agent_messages
- tasks, task_history
- documents, document_extractions
- obligations, obligation_executions
- interactions (comunicações com cliente final)
- approvals (pendentes/realizadas)
- audit_log (imutável)
- prompts (versionados)
- evaluations (resultados de testes)
- agent_policies (níveis de autonomia por agente por tenant)
- knowledge_base (vetorial, particionada por tenant)
```

Row-level security no Supabase garante isolamento por tenant_id em toda tabela.

---

## Sistema de autonomia configurável

Cada agente, por tenant, tem um nível configurado:

- **Manual:** agente sugere, humano executa tudo
- **Sugestivo:** agente prepara ação, humano aprova antes de executar
- **Semi-autônomo:** agente executa ações de baixo risco, escala alto risco
- **Autônomo:** agente executa tudo dentro do seu escopo, registra pra auditoria

Configuração via UI no painel do tenant. Defaults conservadores por departamento (Fiscal começa em sugestivo, Atendimento em semi-autônomo, etc).

---

## Pricing inicial (esboço — refinar com sócio)

- **Tier Solo (1-3 pessoas):** R$ 497-997/mês, 2 departamentos
- **Tier Pequeno (4-15 pessoas):** R$ 1.997-3.997/mês, todos departamentos básicos
- **Tier Médio (15-50 pessoas):** R$ 4.997-9.997/mês, todos departamentos + customização
- **Setup fee** por integração com sistema contábil legacy
- **Cobrança adicional** por volume (cliente final processado, documentos analisados, etc)

---

## Roadmap macro

### Fase 0 — Fundações (3-4 meses)
Infra, kernel de agentes, modelo de dados, autenticação, observabilidade, interface visual básica, sistema de aprovação. Sem isso, qualquer departamento vira tech debt.

**Deliverables:**
- Plataforma multi-tenant funcionando
- 1 agente "hello world" rodando ponta a ponta
- UI de escritório com 1 sala demonstrável
- Sistema de aprovação humana funcional
- Auditoria completa

### Fase 1 — Atendimento (2 meses)
Primeiro módulo, baixo risco. Valida arquitetura.

### Fase 2 — Societário (2 meses)
Valida RPA e integrações governamentais.

### Fase 3 — Departamento Pessoal (3 meses)
Primeiro módulo de alto valor comercial. Validação real de produto-mercado.

### Fase 4 — Contábil (3 meses)
Núcleo do escritório.

### Fase 5 — Fiscal (3-4 meses)
Coroa. Maior risco, maior valor.

### Fase 6 — Financeiro Interno + polimento (1-2 meses)
Atende o próprio escritório.

**Total:** ~16-20 meses pra plataforma completa. Em paralelo: marketplace de templates, integrações adicionais, evolução visual, otimização de custo.

---

## Riscos críticos a mitigar

1. **Erro de IA com impacto regulatório** — mitigação: human-in-the-loop forte no Fiscal, auditoria total, seguro de responsabilidade
2. **Custo de LLM explodir** — mitigação: budgets por agente, modelo cascade (Haiku → Sonnet → Opus), cache agressivo de prompts repetidos
3. **Loops entre agentes** — mitigação: supervisor monitora, limite de turnos, timeouts
4. **Integração frágil com sistemas legacy brasileiros** — mitigação: começar pelos 2-3 sistemas mais usados pela base de clientes do sócio
5. **Adoção lenta por medo da equipe humana** — mitigação: posicionamento "amplifica equipe", não substitui; UI mostra colaboração
6. **Vazamento de dados entre tenants** — mitigação: RLS no Supabase, testes automatizados de isolamento, auditoria de acesso

---

## Decisões em aberto (pra resolver com sócio)

- Quais 2-3 sistemas contábeis legacy priorizar nas primeiras integrações
- Pricing exato e estrutura de tiers
- Política de SLA por tier
- Modelo de onboarding (self-service vs implementação assistida vs híbrido)
- Estratégia de pricing pra setup fee
