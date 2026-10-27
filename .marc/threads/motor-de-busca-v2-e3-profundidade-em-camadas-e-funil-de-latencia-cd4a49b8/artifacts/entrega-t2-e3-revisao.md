# Entrega T2 da E3 (revisão 2): métricas, folds e decisão

Revisão após as decisões do principal: referencial de H5 pela opção (b), reavaliação única da sobrevivência com `cosine-fts` (mesmo P e mesmo K), critério das faixas com recuo 1, armadilhas, recall no K = 30 e curva acima de 30. Esta revisão substitui as seções 3 e 4 da entrega anterior, que davam H5 como bloqueada. Nada mudou em capturas, datasets ou `.marc/memory`.

Relatórios: `C:\Projetos\marc\.marc\cache\memory-eval\marc\87cd2e4d96f7\t2-report.{json,md}` e `t2-report-cosine-fts.{json,md}`; `C:\Projetos\marc\.marc\cache\memory-eval\ledgerline-en\0d31bd4afd3f\` (mesmos nomes).

## 1. Vereditos (E0: δ = 0,05; inconclusivo reprova; recall de H4 com margem −0,02)

| Hipótese | marc (cosine) | marc (cosine-fts) | ledgerline-en |
|---|---|---|---|
| H4 top-1, FUNNEL vs ALL_PASSAGES | não inferior (0,0000) | não inferior (−0,0163) | não inferior (0,0000) |
| H4 recall dos finalistas (margem −0,02) | **piora** (−0,0634) | **piora** (−0,0634) | não inferior (0,0000) |
| H4 sobrevivência por passageId (meta ≥ 0,90) | **falha** (16/22 = 0,727) | **falha** (17/22 = 0,773) | atende (29/29) |
| H5 top-1 total | melhora (+0,1220) | melhora (+0,1057) | melhora (+0,3425) |
| H5 recall total (admissionRecall) | melhora (+0,1610) | melhora (+0,1648) | melhora (+0,2700) |
| H5 exposição incidental | **piora** (−0,1626, invertida) | **piora** (−0,1870, invertida) | não inferior (+0,0959, invertida) |
| H5 abstenção correta nos negativos | **inconclusivo** (−0,2143) | **piora** (−0,2857) | não inferior (0,0000) |
| Armadilhas (≤ 1 parada antes da evidência) | **falha** (2 de 8) | **falha** (2 de 8) | atende (0 de 8) |
| Determinismo de layersSearched | 0 divergências em 137 | 0 em 137 | 0 em 79 |

**H5 falha no marc** pela exposição incidental e pela abstenção. No ledgerline passa em todos os critérios. A exposição é métrica de dano (1 quando um caso positivo admite grau ≤ 1): a tabela mostra a diferença **base − candidato**, então valor positivo significa que ADAPTIVE expõe menos.

**K do marc**: K = 30 (máximo da grade) em todos os folds, regra de recall **não atendida** (recall 0,937 a 0,943 por profundidade). Pelo plano, isso vai ao humano como D10. ledgerline-en: K = 20 em todos os folds, regra atendida.

## 2. Referencial comum de H5 (opção b, texto literal do plano)

- Relevância do referencial: máximo do grau **julgado** entre as camadas no conjunto comum; numerador limitado à profundidade acessível da variante; célula de camada não julgada não bloqueia nem vira zero.
- Células de referência não julgadas (informativo, não bloqueia): marc 510 (cosine) e 505 (cosine-fts); ledgerline-en 76. H4: 0.
- Cobertura própria das sete variantes: completa nos dois corpora e nos dois modos, sem casos incompletos.
- Lacuna de camada (diagnóstico): marc tem 30 de 332 grupos relevantes com lacuna (47 células sem julgamento, em 23 casos). ledgerline-en tem 2 de 103 (2 células, 2 casos).

## 3. Seleção de K e cortes (só nos folds de treino)

**marc**: K = 30 em todos os folds (não atendida). Cortes do modo cosseno:

| Fold | Corte high | Corte medium | Pares de treino ≥ high (positivos; precisão) | Pares de treino ≥ medium (positivos; precisão) |
|---|---|---|---|---|
| 0 | 0,9999935 | 0,9226 | 44 (40; 0,909) | 126 (76; 0,603) |
| 1 | 0,9999982 | 0,9268 | 42 (38; 0,905) | 125 (75; 0,600) |
| 2 | 0,9999935 | 0,9432 | 41 (37; 0,902) | 115 (69; 0,600) |
| 3 | 0,9999982 | 0,9765 | 40 (36; 0,900) | 110 (66; 0,600) |
| 4 | 0,9999935 | 0,9906 | 36 (33; 0,917) | 93 (56; 0,602) |

**ledgerline-en**: K = 20 em todos os folds (atendida). Cortes high ≈ 0,9999999996 em todos os folds; pares de treino ≥ high: 10 (9 positivos), 5 (5), 11 (10), 14 (13), 14 (13). Cortes medium: 0,2500; 0,7098; 0,2192; 0,2192; 0,4084.

**Corte high degenerado (explicação)**: o corte é não nulo, então a meta de precisão 0,9 é atingível, mas só na cauda saturada do reranker. Entre 36 e 44 pares de treino por fold têm precisão 0,90 a 0,92, e a faixa alta admite só esses extremos. Por isso a faixa alta é quase vazia: marc tem 64 resultados de ADAPTIVE na faixa alta em 137 casos (52 em FUNNEL_D2, 55 em ADAPTIVE_HM); ledgerline-en tem 25. No recuo 1, os cortes por profundidade também saturam: marc tem corte high ≈ 1,0 em D0, D1 e D2, e medium ≈ 0,9999 em D1 e D2.

## 4. Faixas: precisão externa da faixa alta de ADAPTIVE contra DEPTH0 admitido

| Corpus | Modo | Diferença | IC | Termo |
|---|---|---|---|---|
| marc | cosine (cortes por fold) | +0,4922 | [0,3521; 0,5485] | melhora |
| marc | cosine (recuo 1: cortes por profundidade) | +0,4976 | [0,3554; 0,5607] | melhora |
| marc | cosine-fts | +0,4780 | [0,3289; 0,5359] | melhora |
| ledgerline-en | cosine (cortes por fold) | +0,3153 | [0,1667; 0,5355] | melhora |
| ledgerline-en | recuo 1 | +0,2928 | [0,0000; 0,3000] | não inferior (limite inferior 0,0000, não estritamente positivo) |

O critério da faixa passa nos dois corpora pelo corte por fold. O recuo 1 não muda o marc e, no ledgerline, fica em "não inferior" porque o limite inferior é exatamente zero.

## 5. Sobrevivência por passageId e perdas

- marc, cosine: 16 de 22 (0,727; IC [0,545; 0,909]). Perdas: Y01, Y03, Y06, Y08, Y11 e J04 (seis).
- marc, cosine-fts: 17 de 22 (0,773; IC [0,591; 0,909]). Perdas: Y01, Y03, Y06, Y08 e J04 (cinco). Y11 sobrevive.
- Nos dois modos, as perdas de Y01, Y03 e Y11 são de corte de passagem (o grupo é finalista na posição 1 e a passagem de evidência não entra). Y06, Y08 e J04 perdem o grupo no K.
- ledgerline-en: 29 de 29 nos dois modos.

## 6. Armadilhas (adaptive-trap)

marc (cosine): 2 de 8 paradas antes da camada da evidência (meta: no máximo 1). Ambas param na camada 0 com um resultado de **grau 1** na faixa alta, de score 1,00000:

| Caso | Parou na camada | Camada da evidência | Disparo (grupo, grau, score, faixa) |
|---|---|---|---|
| J01 | 0 | 1 | oportunidade-ordenar-threads-mais-novas-no-topo-394a14b9, 1, 1,00000, alta |
| J07 | 0 | 1 | oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1, 1, 1,00000, alta |

Demais casos (camada de parada, disparo): J02 (1, corrigir-corrida-de-startup-no-teste-de-auto-idle-do-daemon-504e1898, grau 1); J08 (1, mesmo grupo, grau 3); J05 (2, oportunidade-indicador-visual-de-memory-na-interface-174c48b6, grau 2); J03, J04 e J06 chegam à camada 2 sem disparo.

Top-1 e Top-3 em 8 casos: ADAPTIVE 3 e 4 (cosine) e 2 e 4 (cosine-fts); DEPTH2 5 e 5 nos dois modos. Os dois disparos precoces são justamente pares no topo saturado (score 1,00000), um deles de grau 1: o corte alto admite um resultado irrelevante.

ledgerline-en: 0 de 8 paradas antes da evidência; ADAPTIVE e DEPTH2 com Top-1 5 e Top-3 7.

## 7. Recall no K de cada fold e relevantes perdidos (marc, cosine, K = 30)

- Recall por profundidade: D0 0,9429; D1 0,9403; D2 0,9366.
- Relevantes perdidos: D0 = 12; D1 = 19; D2 = 21 (9 deles de grau 3 em D2). A lista completa, com caso, grupo, grau, posição pela fusão e posição pelo denso, está no JSON (`lostRelevant`) e no Markdown do relatório.
- ledgerline-en: nenhum relevante perdido nas três profundidades.

## 8. Curva exploratória acima de 30 (só informação)

Não é calculável com a matriz atual. Para K acima de 30, o funil com B = 6K pede pares que a captura não pontuou (ela foi feita com B = 232):

| K | B exigido (3K ≤ ⌊B/2⌋) | Casos incompletos D0/D1/D2 |
|---|---|---|
| 40 | 240 | 127 / 132 / 130 de 137 |
| 50 | 300 | 137 / 137 / 137 |
| 60 | 360 | 137 / 137 / 137 |
| 57 (máximo de candidatos em D2) | 342 | 137 / 137 / 137 |

Nenhum recall é reportado onde há casos incompletos. Calcular a curva exige novas pontuações do reranker, o que foge desta tarefa.

## 9. Determinismo, auditoria e checks

- Determinismo (ADAPTIVE, duas execuções): 0 divergências em 137 (marc) e em 79 (ledgerline-en).
- Auditoria: marc, 274 pares sorteados, 4.572 externos, mediana 34 por caso, 3 achados. ledgerline-en, 158 pares, 1.324 externos, mediana 17, 0 achados.
- `pnpm validate`: código 0. `pnpm build`: código 0 (aviso de tamanho de chunk já existente). `pnpm test`: 1009 passam, 0 falham. Testes focados do T2: 12 passam. Typecheck de `scripts/`: código 0.
- As saídas de validação foram revisadas diretamente via Bash; o context-mode não foi usado nesta etapa.
- Mudanças nesta revisão: só em `scripts/memory-eval/` (`t2-run.ts`, `cli.ts`) e nos testes, nenhuma em `src/`. Sem Git, sem datasets, sem captures, sem `.marc/memory`.

## 10. Decisões pendentes

1. D10: K do marc (K = 30, regra não atendida). Expandir a grade exige novas pontuações da captura.
2. H5 falha no marc por exposição incidental e abstenção. É preciso decidir se o critério é reabrido ou se ADAPTIVE é reprovado nesse corpus.
3. H4 falha por recall (margem −0,02) e por sobrevivência (< 0,90). Esses dois critérios vão ao principal, junto com a regra de corte de passagem.
