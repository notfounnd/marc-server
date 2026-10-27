# Entrega T2 da E3 (claude-dev): métricas, folds e decisão

Revisão do principal pendente. Relatórios em `C:\Projetos\marc\.marc\cache\memory-eval\marc\87cd2e4d96f7\t2-report.{json,md}` e em `C:\Projetos\marc\.marc\cache\memory-eval\ledgerline-en\0d31bd4afd3f\t2-report.{json,md}`.

## 1. Cobertura antes das métricas

- Worksheet com os julgamentos atuais: 0 pendentes e 0 scores ausentes, nos dois corpora.
- Verificação do manifesto da auditoria contra os julgados de antes do merge: 137 casos (marc) e 79 casos (ledgerline), 0 divergências.
- Cobertura por variante (ambos os corpora): todas completas, sem casos incompletos.
- Pendência encontrada: o referencial comum de H5 pede células de camada que a worksheet não pediu (ver seção 4).

## 2. Seleção de K e cortes, só nos folds de treino

- K: menor K da grade (8 a 30) com perda de recall ≤ 0,02 em cada profundidade, medido só no treino de cada fold.
- Cortes: `bandCutsOf` (fit.ts) sobre os pares rotulados do treino de cada fold, com a elegibilidade do M0. Corte nulo vira +∞ no funil.
- ledgerline-en: K = 20 em todos os folds, regra atendida. Produção: K = 20.
- marc: K = 30 (K_max) em todos os folds, regra **não atendida**: recall ≈ 0,93 a 0,95 nas três profundidades. Produção: K = 30, não atendida. Pelo plano, isso exige decisão do humano (D10).

## 3. Tabelas de decisão (referência comum, folds por K e cortes do treino)

**marc** (margem de H4 com top-1: 0,05; de H4 recall: −0,02)

| Hipótese | Escopo | Diferença | IC | Termo |
|---|---|---|---|---|
| H4 top-1, FUNNEL_D2 vs ALL_PASSAGES_D2 | total | 0,0000 | [−0,0388; 0,0396] | não inferior |
| H4 top-1 | implicit | 0,0645 | [−0,0645; 0,1935] | inconclusivo |
| H4 top-1 | layer | −0,0667 | [−0,1667; 0,0000] | inconclusivo |
| H4 top-1 | adaptive-trap | 0,0000 | [0; 0] | não inferior |
| H4 recall (finalistas vs todos os candidatos) | total | −0,0634 | [−0,0906; −0,0373] | **piora** (falha) |
| H4 sobrevivência por passageId | layer + adaptive-trap | 0,727 (16/22) | [0,545; 0,909] | **abaixo de 0,90** (falha) |
| H5 ADAPTIVE vs DEPTH0 | — | **bloqueada**: 510 células pendentes do lado de DEPTH0 (85 casos; camadas 1: 230, 2: 280) | — | — |

- Armadilhas: 2 de 8 casos pararam antes da camada da evidência (critério: no máximo 1). Falha.
- Auditoria: 274 pares sorteados, 4.572 externos, mediana 34 por caso, **3 achados** (confere com o handoff).
- Determinismo de `layersSearched` (ADAPTIVE, duas execuções): 0 divergências em 137 casos.
- Perdas de evidência: 6 (listadas no JSON, com passagens e posição em FUNNEL_D2 e ALL_PASSAGES_D2).

**ledgerline-en**

| Hipótese | Escopo | Diferença | IC | Termo |
|---|---|---|---|---|
| H4 top-1 | total e todos os escopos | 0,0000 | [0; 0] | não inferior |
| H4 recall | total | 0,0000 | [0; 0] | não inferior |
| H4 sobrevivência | layer + adaptive-trap | 1,000 (29/29) | [1; 1] | atende |
| H5 ADAPTIVE vs DEPTH0 | — | **bloqueada**: 76 células pendentes do lado de DEPTH0 (49 casos; camadas 1: 5, 2: 71) | — | — |

- Armadilhas: 0 de 8 casos pararam antes da evidência.
- Auditoria: 158 pares sorteados, 1.324 externos, mediana 17 por caso, **0 achados** (confere com o handoff).
- Determinismo: 0 divergências em 79 casos.

## 4. Pendência que bloqueia H5 (decisão necessária)

O referencial comum de H5 usa a profundidade máxima das duas variantes (2). Os grupos que DEPTH0 alcança precisam de células das camadas 1 e 2 nessa profundidade, e a worksheet não as pediu, porque o alcance foi calculado com a profundidade de cada variante. Com isso, as linhas de H5 não são calculadas. Opções: (a) estender a worksheet com as células do referencial comum de H5 e julgar 510 (marc) e 76 (ledgerline) células; ou (b) decidir outra forma de referência para H5. Não calculei H5 com dado incompleto.

## 5. Rebuild do marc (cópia temporária, camadas [0, 1, 2], batch padrão)

- Índice das camadas [0, 1, 2]: 149,6 s; processo inteiro, com a camada [0] antes: 176,8 s.
- Pico de RSS da árvore de processos: 2.741 MB, com 8 processos.
- Workspace temporário em `%TEMP%`; `C:\Projetos\marc\.marc\memory` intocado. O PID raiz (23820) encerrou sozinho.
- Ressalva: a máquina de medição não é a de referência do humano.

## 6. Checks

- `pnpm validate`: código 0. `pnpm build`: código 0. `pnpm test`: 1009 passam, 0 falham.
- Typecheck de `scripts/` (tsconfig auxiliar): código 0.
- Mudança em `src/`: somente `src/core/memory/funnel-run.ts` (campo aditivo `finalists` por passo); teste de determinismo e de finalistas passam.
