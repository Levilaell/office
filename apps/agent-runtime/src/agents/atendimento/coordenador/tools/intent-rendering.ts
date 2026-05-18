// =============================================================================
// Renderização do catálogo de intents pro prompt do Coordenador.
//
// Lista plana, agrupada por categoria, com slug + display name. Mantém o
// catálogo legível pelo LLM sem inflar o prompt com explicações detalhadas
// — o LLM só precisa saber QUE slugs existem; as regras de escolha vivem
// nas instruções do prompt.
// =============================================================================

import {
  ATENDIMENTO_INTENTS,
  type AtendimentoIntentDefinition,
} from '@office/shared-domain';

const CATEGORY_LABELS: Record<string, string> = {
  operacional: 'Operacional (cliente já contratado)',
  comercial: 'Comercial (lead novo ou em qualificação)',
  administrativo: 'Administrativo (cobrança e cadastro do escritório)',
  social: 'Social (interação curta sem demanda)',
  especial: 'Especial (urgência, fora de escopo, casos não-textuais)',
};

const CATEGORY_ORDER: ReadonlyArray<string> = [
  'operacional',
  'comercial',
  'administrativo',
  'social',
  'especial',
];

export const renderIntentsForPrompt = (): string => {
  const byCategory: Record<string, AtendimentoIntentDefinition[]> = {};
  for (const intent of ATENDIMENTO_INTENTS) {
    const cat = intent.category;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(intent);
  }

  const sections: string[] = [];
  for (const cat of CATEGORY_ORDER) {
    const items = byCategory[cat];
    if (!items || items.length === 0) continue;
    sections.push(`## ${CATEGORY_LABELS[cat] ?? cat}`);
    for (const item of items) {
      sections.push(`- \`${item.slug}\` — ${item.displayName}`);
    }
    sections.push('');
  }
  return sections.join('\n').trim();
};
