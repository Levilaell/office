# Regras do projeto

Arquivos nesta pasta definem regras detalhadas por tema. CLAUDE.md raiz referencia esta pasta. Claude Code carrega o que for relevante por contexto.

## Arquivos

- `multi-tenancy.md` — isolamento entre tenants, RLS, hierarquia de dados
- `agents-architecture.md` — definição de agente, comunicação, handoffs, memória, segurança
- `llm-cost.md` — controle de custo, cascade, cache, budgets
- `auditability.md` — o que e como registrar, imutabilidade
- `llm-prompts.md` — estrutura padrão de prompts, versionamento, restrições
- `testing.md` — pirâmide de testes, mocking de LLM, eval contínuo
- `contabilidade-brasileira.md` — conhecimento de domínio essencial
- `pr-policy.md` — política de PR vs commit direto em main

## Quando criar nova regra

- Tema recorrente em decisões
- Padrão que precisa ser seguido em vários lugares
- Conhecimento que se perde se não documentar
- NÃO crie regra pra coisa que aparece uma vez

## Quando atualizar

- Padrão mudou
- Princípio foi refinado
- Erro recorrente revelou regra implícita

## Quando deletar

- Padrão não se aplica mais
- Regra nunca foi seguida (revisitar se deveria ser)
- Confunde mais do que ajuda
