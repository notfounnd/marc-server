# Entrega 1 da E4: T1 e T2

Autor: claude-dev (developer). Principal: claude-software-architect. Status: **pendente de revisão do principal**.

## Resumo

- **T1 (herdada, aprovada pelo principal):** `memory_deep` no core (`deep.ts` e `deep-*.ts`), filtro `readRows({ threadId })`, `memoryReferenceOf`, resolução de thread no core, ferramenta MCP e CLI `marc memory deep`. Nenhuma alteração nesta entrega.
- **T2 (esta entrega):** harness do marc-deep. Dataset com escopo e graus por trecho, corpus marc-deep, kMax na captura, julgamento por trecho, `deep-run`, `deep-worksheet` e testes.

## T2: mudanças

**Novos**
- `scripts/memory-eval/source-group.ts`: `groupIdOfSource` (movida de `capture-scope.ts`), `corpusPathOf` e `PASSAGE_ID_PATTERN`.
- `scripts/memory-eval/dataset-deep.ts`: regras `scope-only-deep`, `scope-thread-not-closed`, `scope-source-types-invalid`, `deep-evidence-outside-scope`, `passage-grade-out-of-range`, `passage-judgment-key-invalid` e `passage-judgment-unknown-source`.
- `scripts/memory-eval/judgments-passage.ts`: chave `passage:<passageId>`, `checkPassageKey`, `passageRaterOf`, `withoutPassageKeys` e `mergePassageGrades`, com kappa próprio.
- `scripts/memory-eval/deep-variants.ts`: DEEP, DEEP_ALL, DEEP_COSINE e DEEP_BUDGET (`runDeepVariants`). Par ausente vira incompleto.
- `scripts/memory-eval/deep-metrics.ts`: Success@5, MRR@5, P@5, saturados e conformidade de escopo. Grau ausente nos cinco primeiros vira incompleto.
- `scripts/memory-eval/deep-classes.ts`: `classifyFailure`, com a precedência segmentation, admission/pool, cap e ordering, e `alsoTruncated`.
- `scripts/memory-eval/deep-protocol.ts`: `protocolOf` (14 casos: 4 sem escopo e 10 com escopo, mais escopo acima de 232) e `gateOf`, que só vale com protocolo completo.
- `scripts/memory-eval/deep-run.ts`, `deep-report.ts` e `deep-worksheet.ts`.
- `scripts/memory-eval/datasets/marc-deep.json` (sem casos) e `marc-deep.corpus.json` (62 threads fechadas em 2026-10-28).
- `test/memory-eval-deep-*.test.ts`, `test/memory-eval-deep-fixtures.ts` e `test/fixtures/memory-eval/capture-ids-e3.json`.

**Alterados (mudança mínima)**
- `dataset.ts`: estilo `deep`, `scope`, `passageJudgments`, `CorpusName` com `marc-deep`, `EVIDENCE_STYLES`, `missingTargetRule` isenta deep.
- `capture-scope.ts`: `scopeEvidenceGroupIdsOf`, que põe o grupo de escopo só no cálculo do escopo.
- `capture-plan.ts`: kMax do contexto (padrão E3_K_MAX).
- `capture-fingerprint.ts`: kMax só quando diferente de 30; `scope` em `queryFingerprintCases` só quando definido.
- `capture.ts`, `capture-count.ts` e `capture-types.ts`: kMax em `CaptureOptions` e `CaptureContext`.
- `judgments.ts`: `cellKeyOf` e `gradeOfCell` aceitam célula de trecho; `parseRater`, `mergeJudgments` (com `--capture`), `serializeDataset` e `withCellGrades`.
- `cli.ts`: `marc-deep` em CORPORA (kMax 0), kMax na captura, `merge-judgments --capture`, comandos `deep-run` e `deep-worksheet`, e `replayInputsOf` exportada só para o check de replay.

## Checks

- `pnpm validate`: exit 0 (lint, prettier e typecheck). O prettier reformatou só os arquivos de teste novos. `src/` e `scripts/` não mudaram.
- `pnpm build`: exit 0.
- `pnpm test`: 1141 de 1141 (1097 do T1 mais 44 da T2).
- Harness: 477 de 477 testes `memory-eval`.
- `memory:eval validate`: marc com 137 casos, 56 threads pinadas e 0 issues; ledgerline-en com 79, 30 e 0; marc-deep com 0, 62 e 0.
- Replay M0,DEPTH2, pelo caminho de `replayCommand` num script do scratchpad, sem escrita no cache: marc `87cd2e4d96f7` com sha256 `ec3eb25e…` igual; ledgerline `0d31bd4afd3f` com sha256 `bf872d5f…` igual.
- Manifest `.marc/memory/manifest.json`: sha256 `ae070d9a…`, íntegro. `marc.json`, `ledgerline-en.json` e seus corpus: hashes inalterados.
- Context-mode: as saídas grandes (validate, testes e replay) foram lidas via `ctx_execute`.

## Notas para o principal

1. **captureId.** O `sourceHash` guardado nas capturas E3 (`c888a91c…`) difere do atual (`8a82c6d6…`), porque o T1 alterou `src/core/memory`. As capturas existentes seguem válidas, pois o replay lê `capture.json`. O teste de captureId recompõe o fingerprint a partir dos componentes guardados e confere o `queryFingerprint` dos datasets sem escopo.
2. **Limite (7-ix).** A conferência do production check nas 62 threads só ocorre na captura real, que não foi rodada.
3. **`cellOf`** continua lendo chave de grupo. A célula de trecho é tratada em `cellKeyOf`, `gradeOfCell`, `parseRater` e `withCellGrades`.
4. **Gate.** Exige zero incompletos em todas as variantes, mais estrito que só DEEP.
5. **Tamanho.** `cli.ts` (1712 linhas), `judgments.ts` (983) e `dataset.ts` (477) já passavam de 300 linhas. Receberam só entradas mínimas.

## Riscos

- Nenhuma captura real do marc-deep foi feita. `deep-run` e `deep-worksheet` estão testados em fixture, incluindo o ponta a ponta.
- Os 14 casos e a captura são da etapa seguinte, pelos aprovadores.

Pendente de revisão do principal.
