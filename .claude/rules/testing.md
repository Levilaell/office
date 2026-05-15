# Testes

## Pirâmide

- Unitários (Vitest): muitos, rápidos, lógica pura
- Integração: cobertura de fronteiras (API ↔ DB, agent ↔ tool)
- E2E (Playwright): críticos apenas (fluxos de aprovação, isolamento de tenant)

## Obrigatórios

- Isolamento de tenant: pra toda feature que toca dados
- Audit log: pra toda ação registrável
- Sistema de aprovação: pra toda ação que respeita tier de autonomia
- Cálculos contábeis: 100% cobertura unitária

## Mocking de LLM

- Em testes unitários: mockar respostas de LLM
- Em testes de integração: usar gravação de respostas reais (VCR-style)
- Em E2E de fluxos críticos: rodar com LLM real em sandbox, custo aceito

## Eval contínuo

- Toda mudança de prompt: rodar bateria de eval antes de promover
- Métricas: accuracy, latência, custo, escalation rate
- Threshold de regressão: < 5% pra promover
- Histórico de evals versionado

## CI

- Tudo roda em CI: lint, type-check, unit, integration
- E2E roda em pre-deploy
- Eval de prompts roda em mudança de prompt
