# Entrega T-worksheet, revisada (claude-dev)

Substitui a versão anterior deste artifact e a mensagem msg_7cd598e6a8ab4159a4. Revisão do principal: F1, F2 e F3.

## F1: alcance de DEPTH perdido na worksheet

- Causa: a replay base de `worksheetCommand` (`scripts/memory-eval/cli.ts`) não recebia `vectors`. DEPTH1 e DEPTH2 usam o funil (`requireFunnel`), que sem vetores lança `MissingFunnelInputs`. A variante ficava incompleta, com resultados vazios e `judgedDepth` 0. `reachDepthsOf` lia só isso, e o alcance sumia sem erro.
- Evidência: replay in-memory com M0, D0, DEPTH0 e DEPTH1 sem vetores dá `DEPTH1=0/0`. Com os vetores dá `DEPTH1=1/56` e `DEPTH2=2/56`. As células de camada passam de 0 para 1485 (camada 1) e 1433 (camada 2), conferidas com as funções exportadas e com o arquivo do replay.
- Correção: a replay base recebe `vectors` (cli.ts, `worksheetCommand`). Além disso, `completeResultsOf` (`scripts/memory-eval/judgments.ts`, antes de `reachDepthsOf`) recusa uma variante incompleta, em vez de descartar o alcance em silêncio.
- Avaliação: `judgedDepthOfCase` (`evaluation.ts`, linha 74) é a mesma função usada pela worksheet. `pendingPairs` usa `reachEntries` com `plan.requireAdmitted`, a mesma regra de `variantReachThreads`. `required-cells.ts` é a mesma regra nos dois lados. `pendingCellsOf` e `presentLayersOf` não mudaram.
- Testes: `test/memory-eval-worksheet-depth.test.ts`. DEPTH1 pede a célula da camada 1 para o grupo que alcança; DEPTH0 não pede camada alguma. Replay sem vetores faz a worksheet recusar.

## F2: superconjunto por donos de pares

- `src/core/memory/funnel-run.ts`: `FunnelStepSummary.admitted` (campo aditivo, linhas 81 a 97) é preenchido em `runFunnel` (linhas 141 a 150). Sem mudança de ordem, admissão, orçamento ou saída.
- Escopo do campo: expõe os grupos admitidos por passo, não os finalistas não admitidos. Esses são filtrados dentro de `admittedOf`, em `funnel-admission.ts`, fora do escopo autorizado. A regra de alcance dos variantes de funil lê só os admitidos (`requireAdmitted: true`), e o resultado da replay já é só admitidos. Então a lista por passo é a entrada exata da regra.
- `exhaustiveReachOf` (`scripts/memory-eval/variants.ts`, linha 395) aplica `reachEntries(plan.requireAdmitted)` a cada passo. Saíram o uso de `steps[].scored/cached` e o parâmetro `groupOf`.
- Prova de saída inalterada: replay real de FUNNEL_D2, ALL_PASSAGES_D1 e ALL_CANDIDATES_D2 (k=12, cosine) antes e depois da mudança. JSON idêntico nos 137 casos (1538 resultados). Os pares pontuados não aparecem na saída da replay; `pairsRequested` e `pairsUnique` resumem essa parte.
- Teste novo: `test/memory-eval-worksheet-funnel.test.ts`, "every group that a step admits is reached at that step's depth". Os testes de `src/` seguem verdes.

## F3: medida nos dois corpora (worksheet do recorte C ficou no disco)

marc (87cd2e4d96f7):

| Recorte | Pendentes | Camada 0 | Camada 1 | Camada 2 | Sem score |
|---|---|---|---|---|---|
| A: só DEPTH | 3514 | 596 | 1485 | 1433 | 16 |
| B: DEPTH + FUNNEL + ALL_PASSAGES + ALL_CANDIDATES | 3680 | 622 | 1548 | 1510 | 16 |
| C: tudo, com ADAPTIVE e ADAPTIVE_HM | 3680 | 622 | 1548 | 1510 | 16 |

ledgerline-en (0d31bd4afd3f): A, B e C dão 1366 pendentes (camada 0: 399; camada 1: 200; camada 2: 767) e 0 sem score.

- C = B no marc: o alcance exaustivo das ADAPTIVE (647 pares caso-grupo na grade, 616 na profundidade 2) já está contido no alcance de B. No ledgerline, o corpus tem 30 threads e o alcance de DEPTH2 já cobre a pool.
- As 16 linhas sem score do marc (camada 0: 2; camada 1: 12; camada 2: 2) escolheram o trecho por cosseno. Com as camadas 1 e 2 entrando, passagens fora do escopo fechado do caso caem nesse recuo.
- Arquivos da worksheet do recorte C: `C:\Projetos\marc\.marc\cache\memory-eval\marc\87cd2e4d96f7\worksheet.md` e `C:\Projetos\marc\.marc\cache\memory-eval\ledgerline-en\0d31bd4afd3f\worksheet.md`, com os templates ao lado.

## Verificações

- `pnpm validate`: código 0. O prettier reformatou dois testes novos. Nenhum outro arquivo do escopo foi tocado.
- `pnpm build`: código 0.
- `pnpm test`: 978 passam, 0 falham (eram 975).
- Testes focados: 108 passam (worksheet, judgments, e3, t1d, memory-funnel).
- Typecheck de `src` e `test`: código 0. Typecheck de `scripts/` pelo tsconfig auxiliar: código 0.

## Riscos e limites

- `FunnelStepSummary` ganhou um campo. Os consumidores atuais são o funil e os testes; nenhum compara o objeto de passo por igualdade.
- O rastro por passo não traz os finalistas não admitidos. Isso é deliberado, pelo escopo autorizado, e não muda nenhum variante atual.
- O pendente do marc subiu para 3680 por causa das camadas 1 e 2, que estavam ausentes da worksheet. A avaliação lê as mesmas células, e isso é o esperado.
- Pedir uma variante incompleta na worksheet agora para com erro, em vez de sair em silêncio.
- Pendente de revisão do principal.
