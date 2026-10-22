# Decisão da E2: H1, H2, H6, H7 e H3/H8

## Resumo

Decisão de marc://@claude-software-architect, coaprovada por marc://@codex-software-architect na msg_18507202fa664195bb, com os ajustes registrados na seção "Coaprovação". Os critérios foram aplicados como declarados no plano (revisão 3) e no adendo de H7 e H8, sem ajuste depois da medição.

**Vocabulário das precisões:** as precisões de H2 e H6 calculadas pelo harness são acumuladas, sobre os pares com score maior ou igual ao corte de cada faixa. As precisões do ramo de recuo, que eu calculei, são por bloco exclusivo, entre um corte e o seguinte, como a UI mostra. Cada tabela indica o tipo.

| Hipótese | Resultado | Consequência |
| --- | --- | --- |
| H1 | Reprovada: alvo do 3P não admitido e Top1-alvo inconclusivo | Recuo de H1: ordem e admissão do M0, faixa pela eligibility |
| H2 | Reprovada nas variantes N1 e N2 | Calibração padrão; sem T3 |
| H6 | Reprovada nos dois ramos | Limite registrado; consulta ao humano (D10) |
| H7 | Reprovada nos dois juízes e nos dois ramos | Sem juiz; sem T2b |
| H3 e H8 | Nenhuma alternativa passa | Fica a A (LFM atual); sem T4 |

O teto de custo aceito pelo humano não é acionado, porque nenhuma alternativa com modelo novo foi adotada. A Fase C fica restrita a T2 (no ramo de recuo), T5 e T6.

## Declarações

- **Métricas interinas:** durante a Fase B, antes do julgamento, marc://@claude-software-architect viu métricas agregadas interinas no relatório do desenvolvedor: precisões de faixa, vereditos de H2 e H6 e tabelas de H3. A planilha de julgamento é cega, sem variante nem score. Nenhuma nota usou essa informação. marc://@codex-software-architect não teve acesso a essas métricas.
- **Correção de termo:** nas mensagens anteriores, chamei de "rodada de ampliação" os ciclos de julgamento, merge e reajuste que levaram os pares pendentes a 0. O termo estava errado. Esses ciclos são rodadas de cobertura do julgamento. A "rodada de ampliação" da E0 é outra coisa: acrescentar casos novos ao recorte inconclusivo até dobrá-lo. Ela não foi usada. O motivo está na seção "Ampliação".

## Base de evidência

- **Capturas:** marc 1b68a7e3f4e6 e ledgerline-en 5ae0f660527c. As 11 variantes do registro de variantes estão completas, com 0 pares pendentes nos dois corpora.
- **Julgamentos:** três rodadas de cobertura, com consenso registrado em consenso-julgamentos-e2.md. Primeira rodada: 865 pares no marc e 224 no ledgerline-en; segunda: 27 e 3; terceira: 3 no marc.
- **Comandos:** `fit` (validação aninhada em 5 folds), `calibrate` e `h3` nos dois corpora, `compare` contra a base de cada hipótese e `report`.
- **Análise auxiliar:** a precisão das faixas no ramo de recuo do ledgerline-en não é calculada pelo harness. Calculei com um script de análise que reutiliza `labelledPairsOf` do harness e aplica os cortes de produção do recuo. O script não altera nenhum arquivo do projeto.
- **Equivalência:** o report do marc marca `failed (9I)`. É a inversão conhecida da E0 entre aa4908aa e c147b8bb, as duas com grau 1. Todas as métricas da lista admitida são iguais entre M0 e produção.

## H1: score calibrado

**Critério:** nas predições externas do marc, Top1-alvo, recall de admissão e abstenção correta não inferiores ao M0, e alvos de 3P e 6I admitidos.

| Item | H1_CALIBRATED − M0 | Termo | Atende |
| --- | --- | --- | --- |
| Top1-alvo | −0,010 | inconclusivo | não |
| Recall de admissão | +0,075 | melhora | sim |
| Abstenção correta | 0 | não inferior | sim |
| Alvo do 3P (174c48b6) | não admitido: p 0,056; semanticOnly 0,049, abaixo do corte baixo | — | não |
| Alvo do 6I (034ad1bf) | admitido na faixa baixa | — | sim |

**Diagnóstico, sem efeito no critério:** precisão de admissão −0,137 (piora); exposição incidental +0,130, pior, embora o termo do relatório marque "melhora" porque não inverte o sinal. O H1 admite mais e com menos precisão.

**Veredito: reprovada.** Vale o recuo de H1: a ordem e a admissão do M0 continuam, e a faixa vem da eligibility. Cortes de produção do recuo: alta 0,99988; média 0,89584; baixa 0,02953.

Precisão externa das faixas do recuo no marc, por bloco exclusivo e só entre os admitidos pelo M0: alta 52/59 (0,881), média 34/83 (0,410) e baixa 16/81 (0,198). A faixa média fica abaixo da meta de 0,60. O plano não põe critério nessa precisão no ramo de recuo, então ela é registrada como limite.

## H2: calibração por projeto

**Critério:** para N1 e N2 no marc, a precisão de cada faixa difere no máximo 0,10 das faixas externas com rótulos reais, e pelo menos 80% dos pares admitidos ficam na mesma faixa.

Precisões acumuladas, calculadas pelo harness:

| Variante | Diferença alta | Diferença média | Diferença baixa | Mesma faixa | Veredito |
| --- | --- | --- | --- | --- | --- |
| N1 | 0,086 | 0,010 | 0,134 | 46,6% | reprovada |
| N2 | 0,005 | 0,204 | 0,450 | 14,0% | reprovada |

**Veredito:** calibração padrão para todos os projetos. A T3 não é executada. Com o recuo de H1, a calibração de `p` também deixaria de ter efeito.

## H6: faixas no segundo corpus

**Critério:** no ledgerline-en, com a calibração escolhida em H2 (a padrão), a precisão de cada faixa fica a no máximo 0,10 da meta. O harness mede a distância absoluta, nos dois sentidos. Precisão acima da meta também conta como distância.

As duas primeiras linhas usam as precisões acumuladas do harness. A terceira usa blocos exclusivos. Como todos os admitidos são relevantes, a precisão acumulada também seria 1,000 nas três faixas, e o veredito não muda.

| Ramo | Alta | Média | Baixa | Veredito |
| --- | --- | --- | --- | --- |
| H1 (p, cortes do marc) | 16/16 = 1,000 (0,100) | 28/28 = 1,000 (0,400) | 35/38 = 0,921 (0,621) | reprovada |
| Recuo do registro sobre p (cortes do próprio corpus, aninhado) | 0,900 | 0,547 | 0,302 | passaria, mas vale só no ramo do H1, que foi reprovado |
| Recuo de H1 (eligibility, cortes do marc, admitidos pelo M0) | 26/26 = 1,000 (0,100) | 9/9 = 1,000 (0,400) | 3/3 = 1,000 (0,700) | reprovada |

No ramo que vale, o de recuo, todos os 38 pares admitidos pelo M0 no ledgerline-en são relevantes. Por isso, nenhum corte por corpus consegue aproximar as faixas média e baixa das metas: qualquer corte deixa a precisão em 1,0. O recuo do registro não tem como passar.

**Veredito: reprovada.** O plano manda registrar o limite e consultar o humano (D10). A pergunta está na seção "Consulta ao humano".

## H7: juiz de admissão

**Critério:** contra a base, Top1-alvo, recall de admissão e abstenção correta não inferiores, mais um ganho: precisão de admissão com "melhora" ou exposição incidental com o intervalo inteiro abaixo de 0. Com o H1 reprovado, a base é H1_FALLBACK e valem as variantes _FALLBACK. Para registro, o ramo do H1 também está na tabela.

| Variante | Top1-alvo | Recall de admissão | Abstenção | Precisão de admissão | Exposição incidental | Veredito |
| --- | --- | --- | --- | --- | --- | --- |
| H7_JUDGE_QWEN_FALLBACK | 0, inconclusivo | 0, não inferior | não inferior | 0, não inferior | 0 | reprovada: sem ganho e Top1 inconclusivo |
| H7_JUDGE_KEV_FALLBACK | −0,010, inconclusivo | 0, não inferior | não inferior | +0,002, não inferior | 0 | reprovada: sem ganho e Top1 inconclusivo |
| H7_JUDGE_QWEN (ramo do H1) | −0,010, inconclusivo | −0,020, inconclusivo | não inferior | +0,006, não inferior | −0,020, inconclusivo | reprovada |
| H7_JUDGE_KEV (ramo do H1) | 0, não inferior | −0,005, não inferior | não inferior | +0,004, não inferior | 0 | reprovada: sem ganho |

**Veredito:** a E2 segue sem juiz. A T2b não é executada, e o teto de custo não se aplica.

## H3 e H8: sugestão de correção

**Critério:** para B, C e cada D contra A, em todos os casos dos dois corpora:

- acertos de correção e de sugestão maiores ou iguais aos de A;
- cada contador de erro indevido menor ou igual ao de A;
- soma dos erros indevidos menor que a de A.

| Alternativa | Correção certa | Correção indevida | Sugestão certa | Sugestão indevida | Soma dos erros | Veredito |
| --- | --- | --- | --- | --- | --- | --- |
| A | 14 | 13 | 3 | 119 | 132 | referência |
| B | 14 | 15 | 2 | 94 | 109 | reprovada: correção indevida 15 > 13 e sugestão certa 2 < 3 |
| C | 6 | 2 | 0 | 19 | 21 | reprovada: perde 8 correções certas e 3 sugestões certas |
| D_KEV | 14 | 100 | 0 | 5 | 105 | reprovada: correção indevida 100 > 13 |
| D_LFM | 5 | 92 | 0 | 6 | 98 | reprovada |
| D_LAYA | — | — | — | — | — | fora do estudo (entrega 1): a entrada depende do build_sequence do open-jev, dependência proibida |

Valores somados: marc com 114 casos e ledgerline-en com 40.

**Veredito:** fica a A. A T4 não é executada.

**Descoberta para a E3:** a C reduz os erros indevidos de 132 para 21, mas perde a maior parte dos acertos. A sugestão indevida de A (119) é o maior volume de erro da interpretação e merece tratamento na E3, fora desta decisão.

## Ampliação

A regra da E0 permite uma única rodada de ampliação quando um resultado é inconclusivo. Ela foi dispensada:

- **H1:** reprova pelo alvo do 3P, que é um item obrigatório. Essa reprovação não depende de nenhum intervalo inconclusivo, e casos novos não a desfazem.
- **H7:** no ramo de recuo, que é o ramo aplicável, o ganho exigido não foi demonstrado no marc. As metas do ledgerline-en também falham: Qwen 29/29, 6/6, 3/3 e Kev 27/27, 7/7, 4/4 (reprodução do Codex). Os efeitos observados são de no máximo +0,006. Isso não prova que casos novos nunca mostrariam ganho, mas a falha no segundo corpus independe da ampliação do marc.

## Latência e custo

- Sem juiz e sem modelo novo, a cadeia da E2 é a do M0 mais o cálculo da faixa. A medição de ponta a ponta, com o rótulo "medido", acontece na Fase C, depois da T2.
- O teto de custo (msg_b030c1d695a6409d9d, com as ressalvas da msg_88d8e478f40a49e19d) não é acionado.

## Escopo da Fase C com esta decisão

| Tarefa | Situação |
| --- | --- |
| T2 | Executada no ramo de recuo. A faixa vem da eligibility, com os cortes de produção do recuo. O `score` continua sendo a eligibility do M0, não um `p` calibrado. O contrato D2 (`band` e `abstained`) vale no core, no MCP, no HTTP e na CLI. Os módulos antigos de elegibilidade permanecem, porque o H1 não foi aceito |
| T2b, T3 e T4 | Não executadas |
| T5 | Faixas na UI, bloco recolhido da faixa baixa, i18n, schema 5 → 6 e Playwright CLI |
| T6 | Remoção dos scripts antigos e de `memory:quality` e `memory:benchmark` do `package.json`. O `test:benchmark` fica, porque é o executor genérico documentado em `docs/development.md` para `performance/thread-index.benchmark.mjs`; o plano o listou para remoção por engano. ADR 0011 registra o recuo e os limites; docs |
| Medição | Latência de ponta a ponta da cadeia escolhida |

## Consulta ao humano (D10)

As faixas funcionam como ordem de confiança, mas não atingem as metas de precisão fora do treino:

- **marc:** externas 0,88, 0,41 e 0,20 para as metas 0,90, 0,60 e 0,30;
- **ledgerline-en:** precisão 1,0 em todas as faixas.

No marc, a média (0,410) e a baixa (0,198) ficam fora da tolerância de 0,10. No ledgerline-en, não se observa separação entre as faixas.

**Recomendação dos aprovadores:** consultar o humano, sem conceder automaticamente. A proposta é seguir com faixas heurísticas, como indicador ordinal de confiança, sem promessa probabilística nem de melhora do motor na UI, no MCP ou nos docs. O limite fica declarado no ADR 0011, e a calibração das faixas vira tema de uma etapa posterior.

**Dependência:** T2 e T5 só começam depois da resposta do humano. A cadeia de produção é medida de ponta a ponta na Fase C.

**Se não for aprovada:** a Fase C entrega só o `abstained` e a ordem do M0, sem `band`. Isso exige revisar o D2 e o T5 antes do dispatch.

## Coaprovação

marc://@codex-software-architect coaprovou os vereditos na msg_18507202fa664195bb, com o parecer anexo parecer-codex-decisao-e2.md. A revisão reproduziu os seis compares, os dois reports, as 2.879 predições, a H2 e as contagens de H3/H8. Os ajustes pedidos foram incorporados acima:

1. A justificativa da dispensa da ampliação não afirma mais que a ampliação "não pode mudar" o resultado da H7.
2. Cada tabela identifica se a precisão é acumulada ou por bloco exclusivo.
3. A D10 vai ao humano como consulta, sem concessão automática, com as faixas tratadas como heurísticas.
4. O `test:benchmark` fica no `package.json`.
