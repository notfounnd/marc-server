# Entrega 1b da E3: correções B1 a B8 do harness

Autoria: claude-dev, executado como Haiku 5.5 em xhigh, confirmado pelo humano. Base: parecer do Codex (msg_895b510eac054a4ebf) e artifact `parecer-codex-harness-e3-entrega-1.md`. Decisões aplicadas: as da mensagem de autorização da T1d.

## Resultado

- Os oito achados foram corrigidos e cobertos por testes novos. A suíte completa passou: 953 de 953 (eram 934).
- Validação: `pnpm validate` exit 0, `pnpm build` ok, typecheck com o tsconfig do scratchpad sem erros, `pnpm test` 953 de 953.
- Manifest de produção `b96e41ce…` conferido antes e depois: intacto.
- Mudança de identidade: `E3_CAPTURE_CHANNELS` passou de `e3-v1` para `e3-v2`. Capturas E3 novas têm outro captureId. Capturas `e3-v1` (nenhuma pontuada existe) falham com mensagem clara em `assertCatalogOf`, sem fallback para os canais.

## B1: interpretação só com a camada 0

- `scripts/memory-eval/capture-plan.ts`: `interpretationRowsOf` lê as linhas com `store.readRows(info, generation, { layers: INTERPRETATION_LAYERS })`, a mesma chamada de `src/core/memory/recall-support.ts:55`. `planCase` usa essas linhas em `buildMemoryQueryCandidates`.
- Teste: `test/memory-eval-t1d-guards.test.ts`. Um registro só da camada 1 não é lido.
- Limite: o teste confirma a leitura por camada, não a lista final de candidatos.

## B2: escopo por depth

- `scripts/memory-eval/capture-scope.ts`: `scopeRecordIdsOf` calcula grupos e `matrixScope` para cada depth 0, 1 e 2, e une os resultados. Em cada depth, as passagens de um grupo escolhido são as das camadas até d (`catalogRowsAt`).
- Grupos conhecidos e de evidência entram como antes, sem mascarar a lacuna.
- Teste: `test/memory-eval-t1d-funnel.test.ts`. O finalista só na depth 0 mantém a passagem de camada 0 que os canais não alcançam, com 31 grupos novos na depth 2.

## B3: universos separados

- Canais definem candidatos, fusão e sinais densos. Passagens para budget e all vêm do catálogo: `CatalogRow` em `src/core/memory/funnel-groups.ts`, com recordId, kind, layer e vetor. O catálogo sai dos registros e vetores que a captura já persiste, então o formato da captura não mudou; o que mudou foi a versão (`e3-v2`), que entra na identidade.
- `src/core/memory/funnel-run.ts`: `FunnelCaseInput.catalog` por grupo. `PASSAGE_SELECTORS` lê o catálogo até a camada da depth. `consolidatedPassages` reusa `consolidateThreads` e `rerankingEvidence`, com o fallback identity-only do M0.
- `src/core/memory/semantic-ranking.ts`: só exportado `rerankingEvidence`, sem mudar comportamento.
- `scripts/memory-eval/replay.ts`: `catalogOf` monta o catálogo a partir da captura, e `assertCatalogOf` falha com o motivo para capturas E3 sem `e3-v2`.
- Testes: evidência fora dos canais selecionada por ALL_PASSAGES; grupo identity-only pedido pelo ALL_CANDIDATES, como no M0; passagem fora do topo do canal não entra na consolidação.

## B4: complemento sem sobrescrita

- `scripts/memory-eval/capture-complement.ts`: nunca sobrescreve uma chave existente, nem por recordId nem por texto. `pendingOf` pontua cada texto uma vez e reusa score já existente. Os casos alterados são gravados em `cases/<id>.json` e em `capture.json`.
- `scripts/memory-eval/capture.ts` (`complementRoundsOf`): o resume preserva `complementRounds`, então o log continua append-only.
- Testes (`test/memory-eval-t1d-complement.test.ts`): texto repetido pontuado uma vez; segundo complemento sem pontuar nada; sequência captura, complemento e resume sem modelos (casos e rodadas preservados).

## B5: gate com production recall

- `scripts/memory-eval/capture-gate.ts`: `gateOf` soma matriz e production recall por caso, e `productionRecallPairsOf` mede o recall com reranker de zeros, sem pontuar. `capture-count.ts` e `capture.ts` usam a mesma função.
- Teste: matriz abaixo de 12 h e total acima recusa antes de pontuar, e o `--count-only` marca `refused` pelo total.

## B6: sinais densos do canal

- `src/core/memory/funnel-admission.ts`: `candidateOf` usa as passagens do canal (consolidação de M0, até 3). A evidência escolhida e o melhor score do reranker saem das passagens selecionadas, em separado.
- Testes: com a mesma melhor passagem, ampliar a seleção não muda a eligibility (budget frente a all). Com P = 3 e as passagens do topo do canal, o resultado é o mesmo de antes; os testes de funil existentes passaram sem mudar valores esperados.

## B7: parada por qualquer faixa alta

- `src/core/memory/funnel-run.ts`: `stopAfter` (agora exportado) para em qualquer admitido com faixa alta; no modo `high-or-medium`, também em faixa média.
- Teste: primeiro médio e segundo alto param na camada 0.
- Limite: o teste cobre a regra; o cenário de ponta a ponta com `runFunnel` não foi montado.

## B8: célula exigida compartilhada

- `scripts/memory-eval/required-cells.ts` (novo): `requiredLayersOf` (camadas até a depth que o índice tem, e a camada 0 de thread) e `presentLayersOf`. Usado pelo worksheet (`judgments.ts`, `pendingCellsOf`) e pela avaliação (`metrics.ts`, `pendingPairs`).
- A avaliação confere a célula da camada exigida, sem herdar o grau do summary. `replay.ts` guarda `presentLayers`, e `evaluation.ts` (`caseInputsFor`) passa os graus por camada. Replay antigo sem `presentLayers` vale como só camada 0.
- Teste: o cenário do Codex (G com grau 1 no summary, passagem de artifact na camada 1 sem julgamento, DEPTH1) é incompleto. Com a célula julgada, fica completo.

## Extra: rótulo da classificação vetorial

- `scripts/memory-eval/vector-invariance.ts`: o rótulo agora diz "efeito da composição do índice; lote como hipótese não isolada".
- O JSON da T1c-c (`.marc/cache/memory-eval-e3/t1c/bm25-invariance.json`) não foi regenerado. Mantém o rótulo antigo.

## Arquivos

- Novos: `scripts/memory-eval/required-cells.ts`, `scripts/memory-eval/capture-gate.ts`, `test/memory-eval-t1d-funnel.test.ts`, `test/memory-eval-t1d-guards.test.ts`, `test/memory-eval-t1d-complement.test.ts`, `test/memory-eval-t1d-required.test.ts`.
- Alterados em `src/core/memory`: `funnel-run.ts`, `funnel-admission.ts`, `funnel-groups.ts`, `semantic-ranking.ts` (só export).
- Alterados em `scripts/memory-eval`: `capture-scope.ts`, `capture-plan.ts`, `capture-complement.ts`, `capture-count.ts`, `capture.ts`, `capture-layers.ts`, `replay.ts`, `variants.ts`, `metrics.ts`, `evaluation.ts`, `judgments.ts`, `vector-invariance.ts`.
- Em `test`: `memory-funnel-fixtures.ts` (catálogo nas fixtures).

## Riscos e limites

- B1 e B7 têm teste de regra, não de ponta a ponta com o pipeline completo.
- O canal vetorial da T1c-c segue com a causa atribuída ao lote, não isolada.
- Captura E3 real não foi feita; nada foi pontuado nem contado nesta etapa.
- Escopo com o catálogo: a matriz cobre as passagens do catálogo até a depth, então o número de pares por caso pode crescer. Medir na T2 com a contagem nova.
