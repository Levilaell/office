import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

export const getAnthropicClient = (): Anthropic => {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY ausente. Configurar antes de chamar llmCall().',
      );
    }
    client = new Anthropic({
      apiKey,
      maxRetries: 3,
      timeout: 60_000,
    });
  }
  return client;
};

// Para testes: limpa o singleton (não fechado no normal flow).
export const resetAnthropicClient = (): void => {
  client = null;
};
