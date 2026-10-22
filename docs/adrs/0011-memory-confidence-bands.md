# 0011 - Memory confidence bands are heuristic, and calibration is deferred

## Decision

Memory recall reports a heuristic confidence band for each hit (`high`, `medium`, or `low`) and an `abstained` flag for each result. The bands use the production cut points of the M0 eligibility fallback, and the ranking score stays the M0 eligibility. Neither the bands nor any UI, MCP, CLI, or documentation text state a probability, a precision, or a guaranteed improvement of the retrieval engine.

## Context

The evaluation of the calibrated score (E2) rejected the candidate models for ranking and admission:

- the calibrated score (H1) did not admit the target thread of case 3P, a required criterion, and its Top-1 target comparison against M0 was inconclusive, so the M0 ordering and admission remain, with bands from the eligibility;
- the per-project calibrations (H2) failed the band-precision and same-band criteria on the marc corpus;
- the bands on the second corpus (H6) failed on both branches: every admitted thread there is relevant, so no cut point reaches the medium and low targets;
- the semantic judges (H7) did not show the required gain in admission precision or incidental exposure, so no judge is added;
- no alternative interpretation strategy (H3 and H8) met the correction and suggestion counters of the current interpreter, so the interpreter is unchanged.

With the H1 fallback, the bands are derived from the production `fallbackCuts` of the marc fit, recorded in `fit.json`:

| Cut | Value |
| --- | --- |
| high | 0.9998832326558279 |
| medium | 0.8958386806238463 |
| low | 0.029530510370742287 |

The low cut is below the M0 admission threshold of 0.5, so every admitted thread below the medium cut is in the low band. The measured band precision on the marc corpus is 0.88 for high, 0.41 for medium, and 0.20 for low, each over its exclusive block. These values come from the external predictions of the nested cross-validation, not from the training folds. The ledgerline-en corpus shows no separation between bands. The maintainers were asked whether heuristic bands are acceptable without a precision promise, and approved them as a heuristic confidence signal.

## Consequences

- `MemoryRecallHit` carries `band`, and `MemoryRecallResult` carries `abstained`. Both are additive to the core, MCP, HTTP, and CLI outputs.
- `abstained` is `true` only when the search ran and admitted no thread. A recall that did not search (an unready index, a concurrent operation, or a manifest without records) reports `false`. The UI continues the automatic depth sequence for both cases.
- The UI shows high and medium results in the main list and low results in a collapsed block. It shows no score.
- Calibration of the bands for individual projects is a future topic. It needs new labelled evidence and a new decision.
- The live recall path trusts the daemon response in the UI, as the rest of the UI does. Only the stored search state is validated, so an invalid band in a live response is shown as received; this is a recorded limit.
