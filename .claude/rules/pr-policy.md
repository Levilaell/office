# Política de PR vs commit direto em main

## Princípio

PR existe pra ter gate humano em mudança não-trivial. Pra mudança trivial e mecânica, PR vira fricção sem ganho de segurança — você aprovaria sem ler com cuidado mesmo.

A regra distingue **mudança que merece revisão** de **mudança que só precisa de CI verde**.

## Quando vai PR (default)

- Features novas (qualquer tamanho)
- Refactor de qualquer tamanho
- Mudança em schema, migration, types gerados
- Mudança em multi-tenancy, auth, RLS, audit
- Mudança em wrapper LLM, prompts, agentes
- Mudança em CI, GitHub Actions, hooks
- Bump de dependência maior (major ou minor com breaking)
- Mudança em config do monorepo (turbo.json, pnpm-workspace, tsconfig base, eslintrc)
- Qualquer sprint planejado (mesmo curto)
- ADRs novos
- Mudança em CLAUDE.md raiz que afeta comportamento (regras de código, agentes, multi-tenancy, etc)

## Quando pode commit direto em main

**Todas as condições devem ser satisfeitas:**

1. **Trivialidade técnica:** < 30 linhas de diff, mudança mecânica (rename, remove caractere, ajuste de string), lógica não-controversa
2. **Detecção rápida de erro:** se errar, build/lint/test quebra na hora (segundos)
3. **Escopo seguro:** não toca nenhum item da lista "vai PR"
4. **Validação local completa:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` rodados local e verdes ANTES do push
5. **Confiança no critério:** se tem qualquer dúvida se cabe na regra, vai PR

**Casos típicos:**
- Fix de typo em comentário, doc, mensagem de erro
- Fix de import path / extensão de arquivo
- Fix de lint trivial (warning quebrado, formatação)
- Atualização de README/CLAUDE.md/docs sem mudança de código
- Fix de env var faltando em `.env.example`
- Remoção de console.log esquecido
- Atualização de tech-debt.md (adicionar, fechar, comentar TD)
- Bump de patch que só corrige bug

## Forma do commit direto

Commit message deve sinalizar que é hotfix direto:

```
fix(<escopo>): <descrição>

Hotfix direto em main (<motivo>: trivial / mecânico / validado local).
```

Exemplo:
```
fix(shared-domain): remove .js extensions from relative imports

Hotfix direto em main (mecânico, validado local com pnpm build).
```

## CI

Mesmo em commit direto, CI tem que passar. Se virar vermelho após push direto, **prioridade máxima**: ou rollback (`git revert <hash> && git push`) ou fix imediato.

Nunca deixe main vermelha. PR existe pra evitar isso; commit direto exige cuidado extra.

## Dúvidas comuns

**"Esse fix é trivial, posso direto?"** Se você está perguntando, vai PR. A regra é pra casos onde a trivialidade é óbvia.

**"Mas é só uma linha"** — número de linhas não é critério único. Uma linha mudando RLS policy é PR. 25 linhas mudando typo em comentário é commit direto.

**"CI vai pegar"** — CI pega depois de pushed. PR pega antes. Pra mudança não-trivial, "antes" importa.

**"E se rollback for difícil?"** — então não era candidato a commit direto. Vai PR.

## Anti-patterns

- Marcar como "trivial" pra escapar de revisão de mudança que tem impacto
- Pular validação local porque "é só uma linha"
- Commit direto em main durante sprint ativo (espere mergear o branch do sprint primeiro)
- Empilhar vários "fixes triviais" em commit único — se acumulou, vira PR

## Reverter regra

Se essa política gerar incidentes (mudança trivial que quebrou produção, padrão sendo abusado, etc), volta pra "PR sempre". Regra serve até parar de servir.
