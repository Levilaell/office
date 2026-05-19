# Societário — Mapeamento de portais governamentais

> Sprint Fase 2.0-discovery, Tarefa 2.
> Foco: portais que aparecem nas obrigações catalogadas em
> `societario-obrigacoes.md`. Distinção crítica: **API oficial documentada**
> vs **portal web autenticado** vs **mix parcial**.
> Quando estabilidade ou documentação são marcadas com `[estimativa]`,
> exigem confirmação técnica em prova de conceito.

## Resumo do catálogo

| # | Portal | Esfera | Acesso | Auth | Estabilidade |
|---|---|---|---|---|---|
| 1 | gov.br (SSO) | Federal | OAuth/OIDC | E-mail + senha / cert. digital / biometria | Estável |
| 2 | Receita Federal — eCAC | Federal | Portal web auth | Certificado digital A1/A3 ou gov.br | Muda eventualmente |
| 3 | Receita Federal — Consulta CNPJ pública | Federal | API web + scraping | Pública | Estável |
| 4 | Portal Redesim | Federal | Portal web + API parcial | Certificado A1 | Muda eventualmente |
| 5 | Simples Nacional (PGDAS-D / Portal Simples) | Federal | Portal web auth | Código de acesso ou cert. | Estável |
| 6 | Portal do Empreendedor (MEI) | Federal | Portal web | E-mail + senha + dados pessoais | Estável |
| 7 | DCTFWeb / eSocial / EFD-Reinf | Federal | Portal web + APIs lote | Cert. digital ou procuração eletrônica | Muda eventualmente |
| 8 | JUCESP (Junta Comercial SP) | Estadual SP | Portal web + integrador VRE | Cert. A1 + login | Muda eventualmente |
| 9 | JUCERJA (RJ) | Estadual RJ | Portal web | Cert. A1 + login | Muda frequentemente |
| 10 | JUCEMG (MG) | Estadual MG | Portal web + integrador SIARE | Cert. A1 + login | Muda eventualmente |
| 11 | JUCESC (SC) | Estadual SC | Portal web | Cert. A1 + login | Muda eventualmente |
| 12 | JUCERGS (RS) | Estadual RS | Portal web | Cert. A1 + login | Muda eventualmente |
| 13 | JUCEPAR (PR) | Estadual PR | Portal web | Cert. A1 + login | Muda eventualmente |
| 14 | DREI / Receita do CNPJ pós-Junta | Federal | Integração nativa Redesim | Cert. A1 + DBE | Muda eventualmente |
| 15 | Prefeitura SP — NFS-e + CCM | Municipal SP | Portal web auth + API parcial | Cert. A1 ou senha web | Muda eventualmente |
| 16 | Prefeitura RJ — Carioca Digital + NFS-e | Municipal RJ | Portal web | Cert. A1 ou senha | Muda eventualmente |
| 17 | Prefeitura BH — BH-ISS / NFS-e | Municipal BH | Portal web | Cert. A1 ou senha | Muda eventualmente |
| 18 | Prefeitura POA — Nota Legal POA | Municipal POA | Portal web | Cert. A1 ou senha | Muda eventualmente |
| 19 | ConectaJusbr (consulta processos) | Federal/Tribunais | API REST | Cert. A1 ou login | Estável |
| 20 | Sefaz estadual (Inscrição Estadual) | Estadual (cada UF) | Portal web | Cert. A1 + login | Variável por UF |

**Total catalogado: 20 portais** (cobre mínimos exigidos + extensões).

---

## Federais

### 1. gov.br (SSO federal)

- **Nome:** Portal Único de Serviços Públicos do Governo Federal
- **Esfera:** Federal
- **Cobertura:** identidade digital unificada do cidadão e empresa pra acessar serviços públicos federais (e crescentemente estaduais)
- **Tipo de acesso:** OAuth 2.0 / OpenID Connect — SSO federado
- **Autenticação:** e-mail + senha, certificado digital, biometria facial, ou gov.br App
- **Estabilidade:** estável — produto maduro, fortemente investido pelo governo
- **Documentação pública:** sim, em `https://www.gov.br/governodigital/pt-br/identidade` (não inventar URLs — checar antes de usar)
- **Casos de uso (T1):** quase todas obrigações exigem login gov.br como pré-requisito (Receita, Redesim, Simples) — atualmente competindo com certificado direto
- **Observações:**
  - Selos de confiabilidade (Bronze/Prata/Ouro) determinam acesso a quais serviços
  - Captcha eventual; biometria facial em casos específicos
  - SSO permite reaproveitar autenticação entre múltiplos portais federais

### 2. Receita Federal — Centro Virtual de Atendimento (eCAC)

- **Nome:** e-CAC — Centro Virtual de Atendimento
- **Esfera:** Federal
- **Cobertura:** todos os serviços fiscais federais — situação cadastral, débitos, parcelamentos, certidões, DCTFWeb, eSocial (espelho), DARF, etc.
- **Tipo de acesso:** portal web autenticado; algumas operações com APIs parciais (lote de eventos eSocial/Reinf)
- **Autenticação:** certificado digital A1 ou A3 do CPF, certificado A1 do CNPJ, gov.br Ouro, ou código de acesso
- **Estabilidade:** muda eventualmente — refactors visíveis a cada 2–4 anos; mas APIs lote são mais estáveis
- **Documentação pública:** parcial — APIs lote do eSocial/Reinf têm documentação técnica; portal web depende de inspeção
- **Casos de uso (T1):** atualização cadastral (#13), procuração eletrônica (#14), pré-requisito de quase todas obrigações
- **Observações:**
  - Procuração eletrônica é o vetor crítico — contador acessa em nome do cliente
  - Mudou layout em 2023 (UX revamp); processos críticos seguiram funcionando

### 3. Receita Federal — Consulta CNPJ pública

- **Nome:** Consulta Pública CNPJ (`https://www.gov.br/receitafederal/.../situacao-cadastral-cnpj` — confirmar URL atual)
- **Esfera:** Federal
- **Cobertura:** consulta livre de situação cadastral, QSA, endereço, CNAEs, regime
- **Tipo de acesso:** portal web público + endpoint de consulta (não oficial — várias APIs de terceiros indexam)
- **Autenticação:** captcha pra requests manuais; APIs de terceiros (Brasil API, ReceitaWS, etc) abstraem
- **Estabilidade:** estável — formato dos dados muda raramente
- **Documentação pública:** consulta é pública mas API oficial não existe; terceiros documentam sua própria abstração
- **Casos de uso (T1):** validação cruzada de dados em quase toda obrigação; pré-flight check antes de alteração
- **Observações:**
  - Brasil API (`brasilapi.com.br`) e ReceitaWS são consumidos amplamente; risco de rate limit
  - Receita publicou API oficial em 2024 (Integra Contador) com rate limits e cadastro obrigatório [estimativa — confirmar acesso e custo]

### 4. Portal Redesim

- **Nome:** Rede Nacional para Simplificação do Registro e da Legalização de Empresas e Negócios (Redesim)
- **Esfera:** Federal (integra estados e municípios)
- **Cobertura:** integrador único pra abertura de empresa, alterações cadastrais, baixa, viabilidade locacional — orquestra Junta + Receita + Sefaz + Prefeitura
- **Tipo de acesso:** portal web com algumas APIs parciais expostas a sistemas integradores (ERP contábil); APIs estaduais variam
- **Autenticação:** certificado digital A1 do contador ou representante legal
- **Estabilidade:** muda eventualmente — refactor estrutural em 2024 (DBE integrado) mas processo segue
- **Documentação pública:** parcial — Receita publica especificação técnica do DBE; integração full requer parceria
- **Casos de uso (T1):** abertura (#1), atualização cadastral (#13), abertura/baixa de filial (#6, #7), alterações que tocam CNPJ
- **Observações:**
  - DBE (Documento Básico de Entrada) é o veículo principal — XML assinado com certificado
  - Implementação varia por estado — alguns têm fluxo "100% online" (SP, MG), outros ainda exigem etapas presenciais
  - Software de contabilidade (Domínio, Alterdata, Sage) integra via webservice — fornecedores são parceiros credenciados

### 5. Simples Nacional / PGDAS-D

- **Nome:** Portal do Simples Nacional + PGDAS-D (Programa Gerador do DAS Declaratório)
- **Esfera:** Federal
- **Cobertura:** opção pelo Simples, apuração mensal do DAS, declaração anual DEFIS, desenquadramento
- **Tipo de acesso:** portal web autenticado; PGDAS-D tem APIs lote pra ERP contábil (Domínio, Alterdata, etc)
- **Autenticação:** código de acesso (próprio do Simples — não é eCAC) ou certificado digital
- **Estabilidade:** estável — sistema crítico, manutenção controlada; pode ter janelas de manutenção mensais
- **Documentação pública:** sim — manual técnico publicado pela RFB pra PGDAS-D
- **Casos de uso (T1):** mais ligado a Fiscal que Societário; relevante em transformação/desenquadramento MEI (#12)
- **Observações:** importante saber que MEI usa DAS-SIMEI (outro app) e desenquadramento exige saída formal do regime Simples

### 6. Portal do Empreendedor (MEI)

- **Nome:** Portal do Empreendedor (`portaldoempreendedor.gov.br`)
- **Esfera:** Federal (operado em parceria com Sebrae)
- **Cobertura:** formalização MEI, alteração de CCMEI, desenquadramento, emissão de CCMEI atualizado
- **Tipo de acesso:** portal web; sem API oficial documentada [estimativa — confirmar]
- **Autenticação:** e-mail + senha + dados pessoais (CPF + data nascimento + nome mãe) ou gov.br
- **Estabilidade:** estável — UX simples, pouca variação
- **Documentação pública:** sem documentação técnica
- **Casos de uso (T1):** MEI formalização (#10), alteração (#11), desenquadramento (#12)
- **Observações:**
  - Captcha humano frequente
  - Processo todo online — sem necessidade de Junta Comercial
  - APIs de terceiros (Brasil API) indexam consulta de CCMEI

### 7. DCTFWeb / eSocial / EFD-Reinf

- **Nome:** ecosistema integrado de declaração fiscal e trabalhista
- **Esfera:** Federal
- **Cobertura:** declaração de tributos federais, eventos trabalhistas, retenções
- **Tipo de acesso:** APIs lote (webservices) oficiais bem documentadas + portal web pra consulta/correção; eSocial tem manual técnico extenso
- **Autenticação:** certificado digital A1/A3 do empregador, do contador (com procuração eletrônica), ou e-mail/CPF + senha pra alguns níveis de eSocial
- **Estabilidade:** APIs lote muito estáveis (mudança gera versão nova co-existente); portal web muda ocasionalmente
- **Documentação pública:** sim — `gov.br/esocial/pt-br/documentacao-tecnica` para manuais XSD e exemplos
- **Casos de uso (T1):** mais Departamento Pessoal / Fiscal; pra Societário aparece em encerramento (#8) — RREO + DCTFWeb encerramento
- **Observações:**
  - Software contábil envia eventos lote — não é fluxo manual
  - Procuração eletrônica do contador é pré-requisito

### 8. Receita Federal pós-Junta (DREI / Integra Receita)

- **Nome:** integração nativa Junta → Receita via Redesim + DBE
- **Esfera:** Federal
- **Cobertura:** atualização automática de cadastro de CNPJ após alteração registrada na Junta Comercial
- **Tipo de acesso:** depende do estado — em estados com Redesim integrado, é automático; em outros, exige passo manual via DBE
- **Autenticação:** transparente (vinculado a DBE assinado)
- **Estabilidade:** muda eventualmente
- **Documentação pública:** especificação técnica do DBE em `gov.br/empresas-e-negocios` (confirmar URL)
- **Casos de uso (T1):** todas alterações registradas em Junta exigem comunicação pós-Junta à Receita
- **Observações:** prazo de 30 dias pra comunicação — multa por descumprimento

---

## Estaduais — Juntas Comerciais

### 8. JUCESP — Junta Comercial do Estado de São Paulo

- **Esfera:** Estadual (SP)
- **Cobertura:** todos atos societários registrados no estado de SP (maior densidade econômica do país — ~30% das empresas BR)
- **Tipo de acesso:** portal web (Via Rápida Empresa — VRE Digital) + integrador SIVISA pra atos eletrônicos; APIs parciais via parceria com integradores
- **Autenticação:** certificado digital A1 + login no portal JUCESP
- **Estabilidade:** muda eventualmente — refactor visível em 2022 (VRE Digital); legados ainda coexistem
- **Documentação pública:** parcial — manual de usuário publicado; especificação técnica de integração requer credenciamento
- **Casos de uso (T1):** todas alterações contratuais (#2, #3, #4, #5), abertura (#1), distrato (#8), transformação (#9), abertura/baixa filial (#6, #7)
- **Observações:**
  - VRE Digital permite ato 100% online quando todos sócios têm cert. A1 ou A3
  - Ato com firma reconhecida em cartório ainda existe e exige protocolo presencial em alguns casos
  - Tempo médio deferimento [estimativa]: 3–10 dias úteis
  - Selo Digital integra arrecadação de taxas

### 9. JUCERJA — Junta Comercial do Estado do Rio de Janeiro

- **Esfera:** Estadual (RJ)
- **Cobertura:** atos societários em RJ (segunda maior densidade)
- **Tipo de acesso:** portal web
- **Autenticação:** certificado digital A1 + login
- **Estabilidade:** muda frequentemente — registros públicos relatam quedas mais frequentes e UX inconsistente [estimativa — verificar com sócio se cliente atende RJ]
- **Documentação pública:** limitada
- **Casos de uso (T1):** mesmos atos da JUCESP, mas em RJ
- **Observações:**
  - Histórico de instabilidade afeta confiabilidade de qualquer automação
  - Processos ainda exigem protocolo presencial em casos específicos
  - Risco de captcha e 2FA por SMS em fluxos críticos

### 10. JUCEMG — Junta Comercial do Estado de Minas Gerais

- **Esfera:** Estadual (MG)
- **Cobertura:** atos societários em MG
- **Tipo de acesso:** portal web + integrador SIARE (sistema próprio do estado)
- **Autenticação:** certificado digital A1 + login no portal
- **Estabilidade:** muda eventualmente — SIARE relativamente estável
- **Documentação pública:** parcial; SIARE tem manual técnico pra integrações
- **Casos de uso (T1):** mesmos atos
- **Observações:** SIARE é um dos sistemas mais integrados via Redesim — fluxo 100% online maturo

### 11. JUCESC — Junta Comercial de Santa Catarina

- **Esfera:** Estadual (SC)
- **Cobertura:** atos societários em SC
- **Tipo de acesso:** portal web
- **Autenticação:** certificado digital A1 + login
- **Estabilidade:** muda eventualmente
- **Documentação pública:** limitada
- **Casos de uso (T1):** mesmos atos
- **Observações:** [estimativa — varidação direta com escritórios SC]

### 12. JUCERGS — Junta Comercial do RS

- **Esfera:** Estadual (RS)
- **Cobertura:** atos societários no RS
- **Tipo de acesso:** portal web
- **Autenticação:** certificado digital A1 + login
- **Estabilidade:** muda eventualmente
- **Documentação pública:** limitada
- **Casos de uso (T1):** mesmos atos
- **Observações:** [estimativa]

### 13. JUCEPAR — Junta Comercial do Paraná

- **Esfera:** Estadual (PR)
- **Cobertura:** atos societários no PR
- **Tipo de acesso:** portal web
- **Autenticação:** certificado digital A1 + login
- **Estabilidade:** muda eventualmente
- **Documentação pública:** limitada
- **Casos de uso (T1):** mesmos atos
- **Observações:** [estimativa]

---

## Municipais

### 14. Prefeitura SP — NFS-e + CCM + Alvará

- **Esfera:** Municipal (São Paulo capital)
- **Cobertura:** inscrição municipal (CCM), emissão NFS-e, alvará de funcionamento, ISS
- **Tipo de acesso:** portal web autenticado (Sistema Eletrônico Municipal) + APIs parciais pra NFS-e (sistema próprio Prefeitura SP)
- **Autenticação:** certificado digital A1 ou senha web (CCM + senha)
- **Estabilidade:** muda eventualmente — APIs NFS-e SP têm padrão ABRASF estável; portal de cadastro muda
- **Documentação pública:** sim pra NFS-e (especificação ABRASF + manual da Prefeitura SP)
- **Casos de uso (T1):** abertura (#1 — CCM), alterações de endereço/CNAE que tocam ISS (#4, #5), encerramento (#8)
- **Observações:**
  - NFS-e SP segue padrão ABRASF mas com extensões próprias
  - Prefeitura migrou pra "NFS-e Nacional" (2024+) — período de coexistência

### 15. Prefeitura RJ — Carioca Digital + NFS-e

- **Esfera:** Municipal (Rio de Janeiro capital)
- **Cobertura:** inscrição municipal, NFS-e, alvará, ISS
- **Tipo de acesso:** portal web (Carioca Digital) + APIs ABRASF
- **Autenticação:** certificado A1 ou senha web
- **Estabilidade:** muda eventualmente
- **Documentação pública:** sim pra NFS-e (ABRASF)
- **Casos de uso (T1):** mesmos da Prefeitura SP, escopo RJ
- **Observações:** [estimativa]

### 16. Prefeitura BH — BH-ISS

- **Esfera:** Municipal (Belo Horizonte)
- **Cobertura:** inscrição, NFS-e, ISS
- **Tipo de acesso:** portal web + APIs ABRASF
- **Autenticação:** certificado A1 ou senha web
- **Estabilidade:** muda eventualmente
- **Documentação pública:** parcial
- **Casos de uso (T1):** mesmos
- **Observações:** [estimativa]

### 17. Prefeitura POA — Nota Legal POA

- **Esfera:** Municipal (Porto Alegre)
- **Cobertura:** inscrição municipal, NFS-e (sistema próprio), ISS
- **Tipo de acesso:** portal web + API NFS-e
- **Autenticação:** certificado A1 ou senha web
- **Estabilidade:** muda eventualmente
- **Documentação pública:** parcial
- **Casos de uso (T1):** mesmos
- **Observações:** [estimativa]

---

## Outros relevantes

### 18. ConectaJusbr (consulta processos judiciais)

- **Esfera:** Federal / Tribunais
- **Cobertura:** consulta processual unificada nacional (PJe, e-Saj, Projudi, etc)
- **Tipo de acesso:** API REST oficial
- **Autenticação:** certificado A1 ou cadastro CNJ
- **Estabilidade:** estável — produto novo (2024+) mas mantido pelo CNJ
- **Documentação pública:** sim, em `https://www.cnj.jus.br/conecta-jus-br` (confirmar)
- **Casos de uso (T1):** não-essencial pra Societário em si, mas relevante em encerramento (#8) e transformação (#9) — verificar passivos judiciais
- **Observações:** API recente, vale pra read-only de status processual; sem ação direta

### 19. Sefaz estadual (Inscrição Estadual)

- **Esfera:** Estadual (cada UF tem o próprio)
- **Cobertura:** inscrição estadual (IE), regime ICMS, SPED Fiscal
- **Tipo de acesso:** portal web próprio de cada estado; APIs lote do SPED Fiscal padronizadas (CONFAZ)
- **Autenticação:** certificado A1 + login no portal estadual
- **Estabilidade:** variável por estado — SP, MG, PR razoavelmente estáveis; alguns estados (NE) menos
- **Documentação pública:** parcial — SPED tem documentação técnica nacional; cadastro de IE depende do estado
- **Casos de uso (T1):** abertura (#1) + alteração de CNAE (#5) que toca ICMS + abertura/baixa filial (#6, #7) + encerramento (#8)
- **Observações:** fragmentação por estado torna automação geral inviável; foco em SP/RJ/MG por densidade

### 20. Certificadoras digitais (Serasa, Soluti, Certisign, Valid, AC SafeID)

- **Esfera:** Iniciativa privada (autoridades certificadoras credenciadas pelo ICP-Brasil)
- **Cobertura:** emissão, renovação, revogação de certificados digitais A1/A3
- **Tipo de acesso:** portais próprios + APIs parciais pra parceiros credenciados
- **Autenticação:** documentos da empresa + presença física do representante (validação biométrica)
- **Estabilidade:** estável
- **Documentação pública:** sim — APIs de afiliados (ex: parceria) disponível
- **Casos de uso (T1):** certificado digital (#15)
- **Observações:**
  - Algumas certificadoras oferecem programa de afiliados / parceiros com revenue share
  - Validação presencial é gargalo intransponível — humano vai à certificadora

---

## Sumário comparativo (input pra Tarefa 3)

**Portais com API REST oficial e documentada:**
- gov.br SSO (OAuth/OIDC)
- DCTFWeb / eSocial / EFD-Reinf (lote XML)
- ConectaJusbr (read-only)
- SPED Fiscal estadual (lote XML — padronizado CONFAZ)
- NFS-e ABRASF (padrão nacional usado por várias prefeituras)
- Integra Contador (Receita — API oficial 2024+) [estimativa, validar acesso/custo]

**Portais com integração via DBE / Redesim (semi-API):**
- Redesim
- Receita Federal pós-Junta

**Portais com portal web autenticado, sem API oficial geral:**
- eCAC (Receita)
- Portal Simples Nacional
- Portal do Empreendedor (MEI)
- TODAS as Juntas Comerciais estaduais
- Portais de prefeitura (exceto NFS-e via ABRASF)

**Portais com captcha humano ou 2FA SMS:**
- Portal do Empreendedor (eventual)
- Algumas Juntas Comerciais em fluxos críticos
- Algumas prefeituras

**Portais que exigem presença física:**
- Certificadoras digitais (emissão presencial)
- Alguns cartórios em fluxos não-digitalizados (firma reconhecida pra atos antigos)

Esses agrupamentos orientam a matriz da Tarefa 3 — portais com API REST oficial são candidatos naturais a "Automatizar"; portais sem API e com mudança frequente caem em "Assistir humano"; portais que exigem presença física saem do escopo digital.
