# 0012 - Memory depth counts corpus layers, and the funnel stays out of production

## Decision

Memory recall takes a `depth` from `0` through `2`, and the depth counts corpus layers:

- layer `0` holds closed-thread summaries;
- layer `1` adds artifacts, the workspace rules, and documents;
- layer `2` adds chat messages;
- depth `d` searches every layer up to `d`. Depth `0` is the M0 search, unchanged.

The query interpretation reads layer `0` only, so the vocabulary of depth `0` depends on layer `0` alone and does not change with the chat or with the activation of layers `1` and `2`. Depths `1` and `2` rerank the whole consolidated M0 pool of the layers they search (each group's identity record and up to three passages), with no funnel and no candidate budget. The MCP tool, the CLI, and the HTTP route accept `0` through `2` and reject `3` with the same explanation of the layers. The default is `0`.

The activation was accepted on 2026-10-27: `INDEXED_LAYERS = [0, 1, 2]` (`src/core/memory/sources/index.ts`). The UI and the default depth still search layer `0` only. Depths `1` and `2` now search the layers they name, instead of behaving as depth `0`. As the context notes, the index statistics now include the other layers, so depth-`0` results can differ slightly from the T5 history. The production rebuild with layers `[0, 1, 2]` ran on 2026-10-27 (full mode, status ready, 343 manifest records: 61 in layer 0, 221 in layer 1, and 61 in layer 2).

The user interface runs one search at depth `0`. It does not send a depth, and it has no retry ladder and no search-depth setting. The candidate funnel (`runFunnel`, `selectFinalists`, and the budget `B`) and the adaptive expansion (`ADAPTIVE`) stay in the evaluation harness under `scripts/memory-eval/`. They are not production code paths. They are available for a later evaluation, after the study of models.

## Context

The E3 program tested whether a funnel under a fixed budget, with an adaptive expansion over depths, could carry the layered search within the UI latency limit. The evaluation on the pinned corpora gave these results:

- marc, recall of the finalists against all candidates (margin −0.02, K = 30, the maximum of the grid): −0.063, interval [−0.091; −0.037]. The rule for K was not met on any fold;
- marc, evidence survival by passage id (criterion 0.90): 0.727 with cosine, and 0.773 with cosine-fts, the single fallback. Both fail;
- marc, adaptive expansion (H5) against depth 0: the top-1 gain is positive, +0.122 with interval [0.022; 0.223], and the recall gains are positive for the implicit and layer cases. The incidental exposure gets worse, −0.163 with interval [−0.296; −0.049], and the correct abstention on negatives is inconclusive, −0.214 with interval [−0.429; 0.000]. Two of eight adaptive traps stop before the evidence layer, on a grade-1 result with score 1.0. H5 fails;
- ledgerline-en: the funnel and the adaptive expansion pass their criteria, with K = 20 and 29 of 29 surviving evidences. This is not enough to adopt them on one corpus, and the decision for the product stays conservative.

The E2 M0 baseline is frozen as captures `1b68a7e3f4e6` (marc) and `5ae0f660527c` (ledgerline-en). DEPTH0 is not identical to that history, because the BM25 statistics and some layer-0 vectors change when the index also holds layers 1 and 2. Its acceptance is non-inferiority on the common cases, with the E0 rule (δ 0.05, paired bootstrap by family, and an inconclusive result fails). On 114 common marc cases and 40 ledgerline-en cases, Top-1 on the target, the implicit recall, and the correct abstention are non-inferior, with no difference in the admitted sets.

The high confidence band sits at the saturated tail of the reranker score. Its cut is close to `1` on every fold, so the band admits few results. The confidence bands are recorded in ADR 0011.

## Consequences

- The hit contract is the same for every group kind. `groupId` is always present. `groupKind` is `thread`, `rules`, or `document`. `threadId` and `summaryPath` appear only for thread groups. `reference` follows the best evidence: a summary links to the thread, a chat message to the message, an artifact to the message and the file, and rules or documents to their source path. `nextActions` follow the group kind, and only thread groups suggest reading the thread. `layersSearched` lists the layers that ran, and `rerankPairs` counts the pairs sent to the reranker.
- The layered search is available to agents through the `depth` of the MCP tool and the CLI. The HTTP route also accepts it, for other clients. The UI does not send it.
- The layers `1` and `2` are searched by the MCP tool and the CLI at depths `1` and `2`. The UI does not use them. The production index has held layers `0`, `1`, and `2` since the rebuild of 2026-10-27.
- The funnel, the budget, and the adaptive expansion do not serve any user path. Reopening them requires a new evaluation, with a new decision and a new frozen baseline.
- Latency, measured on the reference machine in one execution (2026-10-25; 30 cases by id, one warm-up and three timed recalls per path, interleaved per case, 90 timed samples per path; every recall sent the same pairs as the replay):
  - UI path (depth 0, length order, index with layer `0`): median 11,814 ms, p95 12,905 ms.
  - M0 reference (depth 0, input order, the order before E3): median 18,221 ms, p95 19,574 ms.
  - MCP path (depth 2, layers `0`, `1`, and `2`, reported only): median 18,131 ms, p95 22,327 ms.
  - UI/M0 median ratio: 0.648. The criterion of 1.2 times the M0 median passes.
  - The 5 s reference is not met by the UI path (11,814 ms) or by the MCP path (18,131 ms). It is informational and is left to the model study; it does not decide any gate.
  - The MCP latency is measured on this machine only, and it does not decide the MCP contract.
- Activation latency, measured on the reference machine in one execution (2026-10-27) with the same protocol. The UI and MCP paths ran on a copy indexed with `INDEXED_LAYERS = [0, 1, 2]`, and the M0 reference ran on a copy with layer `0` only:
  - UI path (depth 0, length order, index with layers `0`, `1`, and `2`): median 12,090 ms, p95 13,085 ms.
  - M0 reference (depth 0, input order, index with layer `0`): median 18,417 ms, p95 20,223 ms.
  - MCP path (depth 2, reported only): median 18,531 ms, p95 22,681 ms.
  - UI/M0 median ratio: 0.656. The criterion of 1.2 times the M0 median passes on the activated index.
  - The M0 pairs match the replay in 30 of 30 cases. The UI pairs differ from M0 by −7 to +2 per case (mean 117.2 against 118.0), because the BM25 statistics of the mixed index change the layer-0 pool.
