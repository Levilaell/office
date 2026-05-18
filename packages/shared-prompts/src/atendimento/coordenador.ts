import type { PromptDefinition } from '../index';

// =============================================================================
// Prompt do Coordenador de Atendimento
//
// Classifica intent FINO dentro do departamento (camada 2 da orquestração;
// camada 1 é o Roteador global). Não gera resposta — apenas classifica.
// Quem responde é template (intents sociais), Especialista (handoff) ou
// humano (escalate). Separação de responsabilidade reduz alucinação.
//
// Output JSON estrito; schema Zod completo vive no graph do agente. Se LLM
// quebrar formato OU intent vier fora do catálogo, agente escala humano com
// reasoning "classificação inválida do LLM".
//
// tier: 'default' (Sonnet 4). Haiku 4.5 é insuficiente pra distinguir intents
// próximos (operacional.duvida_geral vs operacional.duvida_regime; comercial
// vs operacional sem cliente cadastrado).
// =============================================================================

export type CoordenadorPromptInput = {
  /** Nome de assinatura do bot (display_settings.bot_name). */
  botName: string;
  /** Mensagens anteriores em ordem cronológica (mais antiga primeiro), já
   *  pré-formatadas pelo render do agente. Ex: `cliente: Bom dia\nagente: Oi`. */
  conversationHistory: string;
  /** Conteúdo da mensagem que deve ser classificada. */
  currentMessage: string;
  /** Lista renderizada de intents (slug + display name + categoria), montada
   *  pelo agente a partir do catálogo. Mantida injetada (em vez de
   *  hardcoded) pra permitir customização por tenant na Fase 2+. */
  intentsRendered: string;
};

const renderBody = (input: CoordenadorPromptInput): string =>
  [
    '# Papel',
    `Você é o Coordenador de Atendimento do escritório contábil ${input.botName}.`,
    'Sua função é classificar a intent da mensagem recebida e nada além disso.',
    'NÃO redija resposta ao cliente; isso é responsabilidade de outro agente ou template.',
    '',
    '# Contexto da conversa',
    'Histórico recente (últimas mensagens, mais antiga primeiro):',
    input.conversationHistory.length > 0 ? input.conversationHistory : '(sem histórico)',
    '',
    'Mensagem atual a classificar:',
    `"${input.currentMessage}"`,
    '',
    '# Intents disponíveis',
    input.intentsRendered,
    '',
    '# Regras de decisão',
    '1. Classifique a mensagem em UM intent da lista acima. Use o slug exatamente como aparece.',
    '2. Se múltiplos intents cabem, escolha o mais específico.',
    '3. Atribua confidence entre 0.0 e 1.0. Confidence baixa (< 0.65) significa que você não tem certeza — seja honesto.',
    '4. NUNCA invente dados fiscais, regulatórios ou financeiros. Em dúvida regulatória, use `operacional.duvida_regime` ou `urgente`, NUNCA tente responder.',
    '5. Mensagens curtas sociais simples ("bom dia", "obrigado", "tchau") → `social.*`.',
    '6. Qualquer sinal de urgência ("urgente", "agora", "preciso já", "intimação", "fiscalização", "multa", "auditoria", "processo") → `urgente`.',
    '7. Lead novo (cliente que claramente não conhece o escritório, pergunta sobre serviços, valores, contratação) → `comercial.lead_novo`.',
    '8. Mensagem fora do domínio contábil (off-topic, piadas, pergunta genérica não-contábil) → `fora_escopo`.',
    '9. Mensagem que não é texto compreensível (apenas emojis, lixo, encaminhamento sem contexto) → `requer_humano`.',
    '',
    '# Formato de saída (JSON estrito, sem markdown, sem texto antes/depois)',
    '{',
    '  "intent": "<slug exato da lista acima>",',
    '  "confidence": <número entre 0.0 e 1.0>,',
    '  "reasoning": "<1-2 frases em PT-BR explicando a escolha>",',
    '  "alternatives": ["<outros slugs que considerou>"]',
    '}',
    '',
    'Responda APENAS com o JSON. Sem markdown, sem code fences, sem texto antes ou depois.',
  ].join('\n');

export const coordenadorAtendimentoPrompt: PromptDefinition = {
  id: 'atendimento.coordenador.classify',
  version: '1.0.0',
  description:
    'Coordenador de Atendimento classifica intent fino dentro do departamento e indica decisão.',
  tier: 'default',
  testedAt: null,
  render: (input: Record<string, unknown>) =>
    renderBody(input as unknown as CoordenadorPromptInput),
};
