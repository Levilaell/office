import type { AgentTier } from '@office/shared-config/constants';

export interface PromptDefinition {
  id: string;
  version: string;
  description: string;
  tier: AgentTier;
  testedAt: string | null;
  render: (input: Record<string, unknown>) => string;
}

export const examplePrompt: PromptDefinition = {
  id: 'example.health-check',
  version: '0.0.1',
  description: 'Prompt placeholder usado pra validar pipeline de versionamento.',
  tier: 'triage',
  testedAt: null,
  render: () =>
    [
      'Você é um agente de exemplo operando em contexto de escritório contábil brasileiro.',
      'Nunca invente dados fiscais, regulatórios ou financeiros.',
      'Responda apenas: "ok".',
    ].join('\n'),
};

export { routerPrompt } from './router.js';
