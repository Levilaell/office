# Societário — Catálogo de obrigações

> Sprint Fase 2.0-discovery, Tarefa 1.
> Fonte: conhecimento público de contabilidade brasileira (Receita, Sebrae,
> sites de Juntas Comerciais, CFC, portais de prefeituras).
> Dados marcados `[estimativa]` exigem validação com o sócio antes de virar
> input de produto. Frequências por escritório de 4–15 pessoas atendendo
> 30–150 empresas-cliente — fora desse range, banda fica diferente.

## Resumo do catálogo

| # | Obrigação | Categoria | Freq.[estimativa] | Complexidade | Risco se erra |
|---|---|---|---|---|---|
| 1 | Abertura de empresa (constituição) | Constituição | Média | Alta | Alto — atraso compromete início de operação do cliente |
| 2 | Alteração contratual — capital social | Alteração | Alta | Média | Médio — multa por descumprimento de prazo |
| 3 | Alteração contratual — sócios (entrada/saída) | Alteração | Alta | Alta | Alto — questões jurídicas e tributárias |
| 4 | Alteração contratual — sede / endereço | Alteração | Alta | Baixa | Médio — gera multa em inscrições estaduais/municipais |
| 5 | Alteração contratual — CNAE / objeto social | Alteração | Média | Média | Médio — pode mudar regime tributário, alta sensibilidade |
| 6 | Abertura de filial | Expansão | Baixa | Alta | Alto — burocracia multi-estado |
| 7 | Baixa de filial | Encerramento parcial | Baixa | Média | Médio — passivos podem migrar pra matriz se mal feito |
| 8 | Distrato / encerramento de empresa | Encerramento | Baixa | Alta | Alto — débitos remanescentes, responsabilidade dos sócios |
| 9 | Transformação societária (LTDA ↔ SA, ME → EPP) | Mudança jurídica | Baixa | Alta | Alto — complexo jurídica e tributariamente |
| 10 | MEI — formalização | Constituição | Alta (na entrada) | Baixa | Baixo — processo simplificado, baixo impacto |
| 11 | MEI — alteração cadastral | Alteração | Média | Baixa | Baixo |
| 12 | MEI — desenquadramento | Mudança jurídica | Média | Média | Médio — exige nova constituição como ME |
| 13 | Atualização cadastral CNPJ (Quadro Societário, Capital, Endereço) | Atualização | Alta | Baixa | Baixo — porém atraso gera multa Receita |
| 14 | Procuração eletrônica eCAC | Acesso | Alta (recorrente) | Baixa | Baixo |
| 15 | Certificado digital (orientação + renovação) | Acesso | Anual por cliente | Baixa | Médio — sem cert., empresa não cumpre obrigação |

**Total catalogado: 15 obrigações** (acima do mínimo de 12).

---

## 1. Abertura de empresa (constituição)

**Descrição:** processo completo de criação de uma nova pessoa jurídica — desde a definição do tipo societário (LTDA, EIRELI revogada em 2021 — agora LTDA unipessoal ou SLU, SA, SS) até a obtenção de CNPJ ativo, inscrições estaduais/municipais e licenças básicas.

- **Frequência [estimativa]:** média — 1–4 aberturas/mês por escritório médio
- **Complexidade:** alta — múltiplos órgãos, ordem importa, erros são caros
- **Documentos:**
  - Contrato social (ou estatuto pra SA)
  - Documentos pessoais dos sócios (CPF, RG, comprovante residência)
  - Certidão negativa de débito federal dos sócios
  - Comprovante de endereço da sede + IPTU (validação imobiliária)
  - Definição de CNAEs (atividade)
  - Definição de capital social e integralização
- **Portais/órgãos:**
  - Redesim (integrador federal — viabilidade, DBE, Receita)
  - Junta Comercial estadual (registro do contrato + NIRE)
  - Receita Federal (CNPJ)
  - Prefeitura (inscrição municipal, CCM em SP, alvará de funcionamento)
  - Secretaria estadual da Fazenda (inscrição estadual, se aplicável — comércio, indústria, transporte interestadual)
- **Tempo total [estimativa]:** 5–20 dias úteis no melhor caso, podendo estender 30+ dias quando há exigência de vistoria local ou alvarés especiais (vigilância sanitária, bombeiros)
- **Valor cobrado [estimativa]:** R$ 800–R$ 2.500 por abertura, varia por porte e atividade
- **Riscos se errar:**
  - CNAE errado → enquadramento tributário errado → revisão fiscal cara
  - Capital subdimensionado → sócios respondem com bens pessoais em SLU
  - Atraso na inscrição municipal → cliente abre conta bancária com atraso

## 2. Alteração contratual — capital social

**Descrição:** aumento ou redução de capital. Aumento por integralização (sócios trazem dinheiro/bens) ou capitalização de lucros. Redução é mais sensível (exige publicação, prazo de impugnação por credores).

- **Frequência [estimativa]:** alta — aparece em quase toda empresa em crescimento; pode ser anual ou semestral
- **Complexidade:** média — formulário definido, mas erros de cálculo de quotas são comuns
- **Documentos:**
  - Alteração contratual assinada por todos os sócios (com firma reconhecida ou certificado digital A1)
  - Balanço patrimonial atualizado (em alguns casos)
  - Comprovante de integralização (TED, recibo, laudo se bens)
- **Portais/órgãos:**
  - Junta Comercial estadual
  - Receita Federal (atualização cadastral DBE pós-Junta)
- **Tempo total [estimativa]:** 3–10 dias úteis na Junta + 1–3 dias na Receita
- **Valor cobrado [estimativa]:** R$ 400–R$ 900
- **Riscos:** atraso pode invalidar operações que dependem do capital atualizado (concorrências, abertura de crédito bancário), multa por descumprimento de prazo de comunicação à Receita

## 3. Alteração contratual — sócios (entrada/saída)

**Descrição:** mudança no quadro societário — admissão de novo sócio, retirada de sócio, falecimento de sócio (com sucessão), cessão de quotas. Envolve aspectos jurídicos (acordo de sócios, cláusulas de não-concorrência), tributários (ganho de capital), trabalhistas (sócio que era admin).

- **Frequência [estimativa]:** alta — comum em empresas de famílias e em transições
- **Complexidade:** alta — exige análise jurídica caso a caso, não é mecânico
- **Documentos:**
  - Alteração contratual (com cláusulas específicas: valor cessão, forma de pagamento)
  - CPF/RG do novo sócio + comprovante residência + ficha cadastral
  - Comprovante de pagamento da cessão (relevante pra Receita — ganho de capital)
  - Certidões negativas do sócio que entra (federal, estadual, municipal, trabalhista)
- **Portais/órgãos:**
  - Junta Comercial
  - Receita Federal (atualização QSA)
  - Inscrição estadual (se aplicável)
  - Em alguns casos: DARF de ganho de capital
- **Tempo total [estimativa]:** 5–15 dias úteis
- **Valor cobrado [estimativa]:** R$ 600–R$ 2.000 (varia se envolve consultoria jurídica)
- **Riscos:**
  - Cessão sem cálculo correto de ganho de capital → fiscalização Receita posterior
  - Sucessão sem inventário concluído → bloqueio da alteração
  - Sócio retirante mantém responsabilidade tributária por até 2 anos (CTN) — cliente final precisa entender

## 4. Alteração contratual — sede / endereço

**Descrição:** mudança do endereço da empresa. Pode ser dentro do mesmo município, entre municípios do mesmo estado, ou entre estados (mais complexa — re-inscrição estadual/municipal).

- **Frequência [estimativa]:** alta — quase toda empresa muda de sede em algum momento
- **Complexidade:** baixa (mesmo município) a média (interestadual)
- **Documentos:**
  - Alteração contratual
  - Comprovante novo endereço (IPTU, contrato locação)
  - Pra interestadual: certidões fiscais da empresa
- **Portais/órgãos:**
  - Junta Comercial (origem e destino, se interestadual)
  - Receita Federal (DBE)
  - Prefeitura (nova inscrição municipal)
  - Sefaz estadual (nova inscrição estadual, se aplicável)
- **Tempo total [estimativa]:** 5–15 dias úteis intramunicipal; até 30+ dias interestadual
- **Valor cobrado [estimativa]:** R$ 300–R$ 1.500
- **Riscos:** continuar emitindo NF com endereço antigo gera glosa e potencial autuação; atraso em re-inscrição estadual paralisa emissão de NF-e

## 5. Alteração contratual — CNAE / objeto social

**Descrição:** mudança nas atividades exercidas pela empresa. Inclusão de novo CNAE, exclusão, mudança de CNAE principal. Pode ter impacto tributário significativo (mudança de regime, anexo do Simples, alíquotas ICMS/ISS).

- **Frequência [estimativa]:** média — empresas pivotam ou ampliam atividades
- **Complexidade:** média — exige análise prévia de impacto tributário
- **Documentos:**
  - Alteração contratual com novo objeto
  - Estudo de viabilidade tributária (recomendado mas não obrigatório)
- **Portais/órgãos:**
  - Junta Comercial
  - Receita Federal
  - Prefeitura (revisão CCM, se mudar ISS)
  - Sefaz (revisão IE, se mudar ICMS)
- **Tempo total [estimativa]:** 5–15 dias úteis
- **Valor cobrado [estimativa]:** R$ 500–R$ 1.500
- **Riscos:** novo CNAE pode desenquadrar do Simples Nacional (atividade vedada — Anexo IV exclusivamente intelectual, factoring, atividades financeiras); CNAE errado gera multa do CFOP errado em NF

## 6. Abertura de filial

**Descrição:** criação de filial — estabelecimento secundário da mesma pessoa jurídica em endereço diverso da sede. Pode ser no mesmo município, outro município, ou outro estado (mais comum o último — expansão geográfica).

- **Frequência [estimativa]:** baixa — só clientes em crescimento; 0–3 por escritório/ano
- **Complexidade:** alta — multi-estado significa lidar com 2 Juntas, 2 Sefaz, 2 prefeituras
- **Documentos:** alteração contratual (sede instituindo filial), comprovante endereço da filial, definição de CNAE da filial (pode ser diferente da matriz), capital destacado se aplicável
- **Portais/órgãos:**
  - Junta Comercial do estado da sede (averbação)
  - Junta Comercial do estado da filial (registro)
  - Receita Federal (CNPJ da filial — derivado da matriz)
  - Prefeitura do município da filial
  - Sefaz do estado da filial (IE própria)
- **Tempo total [estimativa]:** 15–45 dias úteis
- **Valor cobrado [estimativa]:** R$ 1.500–R$ 3.000
- **Riscos:** atraso em IE estadual da filial paralisa operação local; recolhimento errado de ICMS entre estados gera autuação

## 7. Baixa de filial

**Descrição:** encerramento de filial. Empresa continua existindo (matriz + outras filiais). Requer extinção de inscrições estaduais/municipais da filial, finalização de obrigações pendentes.

- **Frequência [estimativa]:** baixa — 0–2 por escritório/ano
- **Complexidade:** média — exige certidões e quitação fiscal da unidade
- **Documentos:** alteração contratual com baixa, certidões negativas (federal, estadual, municipal, trabalhista da unidade), última escrituração fiscal
- **Portais/órgãos:** Junta Comercial, Receita Federal (DBE), Sefaz, Prefeitura, INSS/eSocial (se tinha empregados)
- **Tempo total [estimativa]:** 20–60 dias úteis
- **Valor cobrado [estimativa]:** R$ 1.200–R$ 2.500
- **Riscos:** dívidas remanescentes na filial podem migrar pra matriz; eSocial mal encerrado gera apontamento permanente

## 8. Distrato / encerramento de empresa

**Descrição:** dissolução total da pessoa jurídica. Processo mais longo e sensível do societário. Envolve quitação de todos passivos, distribuição de patrimônio remanescente, baixa em todos órgãos.

- **Frequência [estimativa]:** baixa — 1–5 por escritório/ano em condições normais; pode disparar em crises
- **Complexidade:** alta — qualquer dívida descoberta posterior responsabiliza ex-sócios
- **Documentos:**
  - Distrato social (assinado por todos sócios)
  - Balanço de encerramento
  - Certidões negativas (federal, estadual, municipal, trabalhista, FGTS, INSS, CND geral)
  - DCTF/EFD com indicador de "encerramento"
  - Eventual demissão de funcionários (rescisão TRCT)
- **Portais/órgãos:**
  - Junta Comercial
  - Receita Federal (baixa CNPJ)
  - Sefaz, Prefeitura
  - eSocial, FGTS, INSS
  - DCTFWeb final
- **Tempo total [estimativa]:** 30–180 dias úteis (CNDs costumam ser o gargalo)
- **Valor cobrado [estimativa]:** R$ 1.500–R$ 4.000+
- **Riscos:** ex-sócios respondem ilimitadamente por débitos descobertos após baixa (CTN art. 135); processo mal feito é incidente jurídico

## 9. Transformação societária

**Descrição:** mudança no tipo jurídico — LTDA virando SA, EPP virando ME, ME virando SLU, etc. NÃO é nova empresa: CNPJ se mantém. Mas tudo muda em volta (governança, escrituração, obrigações).

- **Frequência [estimativa]:** baixa — 0–2 por escritório/ano
- **Complexidade:** alta — exige reformulação completa de governança, eventual obrigatoriedade de auditoria externa, mudança de regime tributário
- **Documentos:** ata de transformação + novo estatuto (se virou SA) ou novo contrato (se virou outra forma), aprovação unânime, balanço de transformação
- **Portais/órgãos:** Junta Comercial, Receita Federal, eventual CVM (se virar SA aberta — fora do escopo de pequeno escritório)
- **Tempo total [estimativa]:** 20–60 dias úteis
- **Valor cobrado [estimativa]:** R$ 2.000–R$ 5.000+ (geralmente consultoria jurídica acoplada)
- **Riscos:** governança da nova forma não respeitada gera nulidades; mudança de regime tributário sem estudo prévio gera prejuízo

## 10. MEI — formalização

**Descrição:** registro como Microempreendedor Individual via Portal do Empreendedor. Processo simplificado, online, sem intervenção de Junta Comercial. Limite de faturamento R$ 81 mil/ano (regra atual).

- **Frequência [estimativa]:** alta — escritório que atende MEI tem volume significativo; em escritório que NÃO foca em MEI, baixíssima
- **Complexidade:** baixa — formulário guiado
- **Documentos:** CPF, RG, comprovante endereço, e-mail, celular ativo
- **Portais/órgãos:** Portal do Empreendedor (gov.br/Sebrae), Receita Federal (CCMEI)
- **Tempo total [estimativa]:** minutos a 1 hora
- **Valor cobrado [estimativa]:** R$ 100–R$ 250 (mais por orientação e setup que pelo ato em si)
- **Riscos:** baixíssimos; processo fail-safe; cliente errar dados é o principal

## 11. MEI — alteração cadastral

**Descrição:** mudança de nome fantasia, endereço, atividade, ou capital do MEI. Feito via Portal do Empreendedor.

- **Frequência [estimativa]:** média
- **Complexidade:** baixa
- **Documentos:** CCMEI atual + novos dados
- **Portais/órgãos:** Portal do Empreendedor
- **Tempo total [estimativa]:** minutos
- **Valor cobrado [estimativa]:** R$ 80–R$ 200
- **Riscos:** baixos

## 12. MEI — desenquadramento

**Descrição:** MEI que excedeu limite de faturamento, contratou mais de 1 funcionário, ou exerce atividade vedada precisa migrar pra ME (LTDA Unipessoal ou EI). Não é só baixar MEI — é abrir empresa nova.

- **Frequência [estimativa]:** média — cresce com taxa de sucesso dos clientes MEI
- **Complexidade:** média — desenquadramento online é simples, mas a constituição da ME nova é trabalho cheio
- **Documentos:** comunicação de desenquadramento + todos documentos de abertura de ME
- **Portais/órgãos:** Receita Federal (Simples Nacional / desenquadramento) + Redesim + Junta Comercial + Prefeitura
- **Tempo total [estimativa]:** 10–25 dias úteis
- **Valor cobrado [estimativa]:** R$ 600–R$ 1.500
- **Riscos:** continuar emitindo NF como MEI após exceder limite gera autuação Receita

## 13. Atualização cadastral CNPJ

**Descrição:** atualização rotineira de dados cadastrais da empresa que não exigem alteração contratual — telefone, e-mail, situação especial (em processo de baixa), porte, optante de tributação. Feita via DBE no portal Redesim.

- **Frequência [estimativa]:** alta — várias por ano por cliente quando há mudanças menores
- **Complexidade:** baixa
- **Documentos:** dados a atualizar + certificado digital A1 do contador ou representante legal
- **Portais/órgãos:** Redesim (DBE) → Receita
- **Tempo total [estimativa]:** 1–5 dias úteis
- **Valor cobrado [estimativa]:** R$ 100–R$ 350 (muitas vezes embutido no honorário mensal)
- **Riscos:** baixos, mas atraso na atualização gera multa (R$ 100/mês por situação não comunicada — RFB)

## 14. Procuração eletrônica eCAC

**Descrição:** cliente final dá procuração pro contador acessar e-CAC, eSocial, DCTFWeb e outros sistemas em nome dele. Realizada pelo cliente com certificado digital. É pré-condição pra praticamente toda operação no Atendimento e nos outros departamentos.

- **Frequência [estimativa]:** alta — exigida na entrada de todo cliente e renovação periódica
- **Complexidade:** baixa (tecnicamente) mas alta sensibilidade
- **Documentos:** certificado digital do cliente, dados do procurador (CPF/CNPJ do escritório)
- **Portais/órgãos:** eCAC (Receita Federal), portais espelho (eSocial, DCTFWeb usam mesma procuração)
- **Tempo total [estimativa]:** minutos
- **Valor cobrado [estimativa]:** embutido em honorário mensal; setup R$ 100–R$ 300 quando ato isolado
- **Riscos:** procuração mal estruturada → contador não consegue cumprir obrigação no prazo; revogação acidental → mesma coisa

## 15. Certificado digital — orientação e renovação

**Descrição:** o escritório raramente emite certificado digital (isso é certificadora — Serasa, Soluti, Certisign, AC SafeID), mas orienta o cliente na escolha (A1 vs A3, validade 1 vs 3 anos), agenda emissão presencial quando necessário, e gerencia renovação antes do vencimento.

- **Frequência [estimativa]:** anual por cliente — renovação ou emissão inicial
- **Complexidade:** baixa
- **Documentos:** documentos do cliente (CNPJ, CPF do representante)
- **Portais/órgãos:** certificadora escolhida (Serasa, Soluti, Certisign, Valid, AC SafeID, etc)
- **Tempo total [estimativa]:** 30 min agendamento + emissão presencial 30 min + instalação 30 min
- **Valor cobrado [estimativa]:** repasse da certificadora (~R$ 200–R$ 450 A1, R$ 250–R$ 500 A3) + serviço de gestão R$ 50–R$ 150
- **Riscos:** cliente sem certificado válido NÃO consegue cumprir obrigação digital. Calendário de vencimento crítico.

---

## Padrões transversais observados (input pra Tarefa 3)

Após catalogar, padrões que aparecem repetidamente:

1. **Junta Comercial é o gargalo central** das obrigações de alteração. Variabilidade entre estados (JUCESP vs JUCERJA vs JUCEMG) cria fragmentação.
2. **Redesim é o ponto de orquestração** federal mais relevante — integra viabilidade, DBE, Receita.
3. **Certidões negativas** (federal, estadual, municipal, trabalhista) reaparecem em quase toda obrigação grande (encerramento, abertura de filial, transformação).
4. **Atos de MEI são distintos** — Portal do Empreendedor é unificado, simples, online. Não usa Junta Comercial.
5. **Prazo de comunicação à Receita pós-Junta** (geralmente 30 dias) é fonte recorrente de multa quando esquecido.
6. **Certificado digital** é pré-requisito implícito de quase tudo digital — gerenciá-lo é serviço transversal.
7. **Cessão de quotas com ganho de capital** é gatilho de obrigação fiscal acoplada (DARF) — operação que parece só societária tem cauda fiscal.

Esses padrões orientam a matriz de decisão da Tarefa 3 — categorias de obrigação caem em buckets parecidos.
