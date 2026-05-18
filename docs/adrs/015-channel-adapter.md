# ADR-015: Abstração ChannelAdapter para canais de comunicação

**Data:** 2026-05-18
**Status:** aceito

## Contexto

O Departamento de Atendimento opera em múltiplos canais de comunicação (WhatsApp, e-mail, futuramente chat web, SMS, voz). Cada canal tem semântica própria:

- WhatsApp via Evolution API: webhook reverse, sessão persistente, mensagens dentro/fora de janela, formatos de mídia próprios
- WhatsApp Cloud API: templates pré-aprovados pela Meta, janela de 24h, business verification, identidade formal
- E-mail (IMAP/SMTP): threading por Message-ID + In-Reply-To, anexos grandes, latência alta, formal
- Chat web (futuro): real-time, sessão por aba, sem identidade verificada

Acoplar o domínio do Atendimento a um canal específico cria dois problemas:

1. **Lock-in técnico:** trocar Evolution por Cloud API depois exigiria refactor profundo
2. **Departamentos futuros impactados:** Societário, Pessoal, Fiscal também usarão canais — duplicar lógica é caro

Decisão da Fase 1 (ADR retrospectivo de discussão): começar com Evolution API pra WhatsApp por velocidade de ativação e custo, com plano de adicionar provedor oficial depois.

## Decisão

Toda comunicação por canal externo passa por uma interface `ChannelAdapter` em `packages/shared-domain/channels/`.

A interface é desenhada **orientada ao adapter mais restritivo** (WhatsApp Cloud API, com templates aprovados e janelas), não ao mais permissivo (Evolution). Razão: contraindo no design, o adapter permissivo se acomoda no contrato; o oposto força refactor.

Contrato mínimo:

```typescript
interface ChannelAdapter {
  readonly channel: ChannelType;
  readonly capabilities: ChannelCapabilities;
  
  connect(session: ChannelSession): Promise<void>;
  disconnect(session: ChannelSession): Promise<void>;
  healthCheck(session: ChannelSession): Promise<ChannelHealth>;
  
  sendMessage(input: OutboundMessage): Promise<SendResult>;
  
  // Webhook ingress não está no adapter — vive em rota de API específica
  // O adapter expõe apenas normalizeInbound() chamado pelo handler de webhook
  normalizeInbound(rawPayload: unknown): NormalizedInboundMessage[];
}

interface ChannelCapabilities {
  supportsTemplates: boolean;
  supportsOutboundOutsideWindow: boolean;
  windowDurationHours: number | null;
  maxMessageSize: number;
  supportedMediaTypes: MediaType[];
}
```

**Adapters da Fase 1:**
- `EvolutionAdapter` (WhatsApp via Evolution API) — primário
- `EmailAdapter` (IMAP polling + SMTP) — secundário

**Adapters planejados (não-Fase 1):**
- `WhatsAppCloudAdapter` (Meta direto ou via provedor)
- `WebChatAdapter` (chat embed no site do escritório)

Tenant configura qual adapter usa por canal em `channel_sessions`. Múltiplos tenants podem usar adapters diferentes simultaneamente.

## Alternativas consideradas

**A) Sem abstração, código específico por canal:** menos código inicial, mas dívida certa quando segundo canal entrar. Rejeitada — Sprint 1.1 (e-mail) já valida que abstração é necessária.

**B) Abstração focada no adapter atual (Evolution):** mais simples agora, mas força refactor quando Cloud API entrar. Capacidades como "templates aprovados" e "janela de 24h" não cabem retroativamente em interface desenhada pra um canal sem essas restrições.

**C) Multi-adapter via plugin externo (adapter como pacote npm separado):** flexibilidade alta, complexidade desnecessária pra Fase 1. Reavaliar se virar marketplace.

## Consequências

**Positivas:**
- Sprint 1.1 (e-mail como segundo adapter) **valida o design** antes de produção complexa
- Adapter de Cloud API entra como trabalho isolado depois, sem tocar agentes ou domínio
- Departamentos futuros (Societário, Fiscal etc) reusam ChannelAdapter sem refactor
- Tenant pode migrar de Evolution pra Cloud API sem perder histórico (dados normalizados no banco)

**Negativas:**
- Capacidades opcionais (templates, janelas) precisam ser respeitadas em runtime — código de agente checa `capabilities` antes de chamar
- EvolutionAdapter implementa stubs/no-ops pra capacidades que não suporta (`supportsTemplates: false`)
- Webhook ingress fica fora do adapter (rotas REST específicas por canal) — separação de leitura intencional, mas exige disciplina

**Restrições de implementação:**
- Adapter NUNCA lê credenciais inline — sempre via `secrets_ref` apontando pra Vault/secrets manager
- Adapter é stateless entre chamadas; estado de sessão vive em `channel_sessions` no banco
- Adapter NÃO conhece domínio de Atendimento — só normaliza payload e expõe envio. Lógica de conversa, contato, account vive em camadas acima.
