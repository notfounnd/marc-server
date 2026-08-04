# Thread summary memory

mARC can maintain a shared semantic memory index for closed thread summaries. The feature helps agents discover prior decisions before they propose or change behavior, while keeping the chat and Markdown workspace as the product source of truth.

## Source of truth

Only closed-thread `SUMMARY.md` content is indexed. When available, the canonical title is read from `CHAT.md` and stored with the summary records, but message bodies are not indexed. Artifacts, docs, rules, and agent profiles are not part of the memory corpus.

The committed index is derived data:

```text
.marc/
  memory/
    manifest.json
    <LanceDB files>
```

The source remains:

```text
.marc/
  threads/
    <thread-id>/
      SUMMARY.md
```

If `.marc/memory/` is deleted, it can be rebuilt from the summaries.

## Local retrieval models

mARC owns the retrieval contract for this shared index. The default implementation is local and offline after preparation. It uses three Transformers.js models with separate responsibilities:

- `Xenova/multilingual-e5-small` runs as int8 from `onnx/model_int8.onnx` and retrieves semantic candidates with E5 `passage:` and `query:` prefixes;
- `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1` runs the unquantized `onnx/model_O4.onnx` variant to rerank retrieved passages against the submitted query;
- `onnx-community/LFM2.5-350M-ONNX` runs the Q4 interpreter from `onnx/model_q4.onnx` and its external `onnx/model_q4.onnx_data` file to select a corrected query from a closed candidate set before retrieval.

The model files are not committed. They live in the ignored local cache:

```text
.marc/cache/memory-models/
```

Run `memory_prepare` once per machine, or use the CLI:

```bash
marc memory prepare
```

`memory_prepare` prepares and validates all three local model caches without rebuilding the index. `memory_status` checks cached files without loading model weights. Rebuild readiness requires the E5 retriever and mMARCO reranker; search readiness additionally requires the query interpreter and a `ready` or `stale` index. Readiness checks require the configured model files, including the exact O4 reranker and both Q4 interpreter files, so partial downloads and inactive variants are not treated as ready.

## Provider lifecycle

The retriever, reranker, and query interpreter each run in an isolated Node child process per workspace. Consecutive operations reuse the relevant worker during its idle window: embedding and reranking workers expire after 30 seconds, while the interpretation worker expires after 300 seconds.

The manager serializes requests for each worker and terminates the child process after that idle window or when the daemon closes. This returns native model allocations to the operating system. The timer is unreferenced, so a one-shot CLI recall does not remain alive only because of the idle window. This lifecycle does not change the committed LanceDB snapshot or the `SUMMARY.md` source of truth.

The UI can prepare all three model caches explicitly from the selected workspace settings panel through `POST /api/workspaces/:workspaceId/memory/prepare`. The daemon does not prepare or download models automatically.

## Query interpretation

Recall defaults to `queryMode: "auto"`. Before embedding the query, mARC derives a Unicode vocabulary from the active memory generation and creates at most one deterministic alternative to the original query. Candidate generation uses Damerau-Levenshtein distance of at most one and corpus frequency, without language-specific word lists. URLs, `marc://` references, paths, and tokens containing digits or underscores are excluded from typo correction.

Candidate `0` is always the original query. The LFM interpreter can only select one of the two allowed numeric indexes. Invalid output receives one guarded retry. Another invalid response, model failure, or worker failure falls back to candidate `0`. Edit-distance and corpus-frequency signals only create typo candidates; they do not score or rank historical threads.

Candidate provenance controls how a selected alternative is applied. When the original spelling is absent from the closed-summary corpus, a selected typo correction becomes the effective query automatically. When the original spelling already exists in the corpus, mARC keeps the original query effective and exposes the selected alternative only as a suggestion. Corpus presence is an ambiguity signal, not proof that either spelling is correct.

Callers can pass `queryMode: "literal"` to bypass interpretation. Recall responses expose `originalQuery`, `effectiveQuery`, `suggestedQuery`, `mode`, and `correctionApplied`. The embedding retriever and mMARCO reranker both consume `effectiveQuery`.

## UI search depth

The UI uses the existing workspace memory recall route and shares the same candidate and eligibility policy as MCP. MCP keeps its default `limit` of `5`. The UI requests up to `50` results because its purpose is to give a human a broader view of relevant closed-thread history.

Workspace settings persist `memory.searchRetryDepth` as an integer from `0` through `3`, with `0` as the default. Every newly submitted UI query starts at depth `0`. If a depth returns no results, the UI can continue automatically through the configured depth:

```text
0: 100 candidates
1: 200 candidates
2: 300 candidates
3: 400 candidates
```

When a result or empty result remains below the maximum depth, the UI exposes `Deep retry` below the search content. Each click issues exactly one candidate depth after the last depth that actually completed, independent of the configured automatic retry limit. The automatic loop stops at its first result. The first request interprets the query; automatic and manual retries reuse its effective query in literal mode, so deeper retrieval never reinterprets or changes the correction. A new query resets interpretation and starts again at depth `0`.

Depth controls candidate-pool size only; it does not relax semantic eligibility. At depths `0`, `1`, `2`, and `3`, each dense and lexical channel requests up to `100`, `200`, `300`, and `400` candidates, respectively. Lexical matches cannot make an otherwise ineligible thread eligible. The `minScore` input was removed from the CLI, MCP, and HTTP recall contracts; callers cannot use it to change the eligibility threshold.

When correction is applied, the UI shows the effective query and offers `Search instead for <original query>`. When a corpus-backed spelling produces a suggested alternative, the UI keeps the literal result and offers `Search for <suggested query>`. In each case, only the alternate query text is a link; it uses the same auxiliary typography as the surrounding interpretation text. Following it starts a new literal search from depth `0`. The versioned per-workspace localStorage snapshot preserves only the latest query, interpretation, configured retry limit, last executed depth, and compact result. Snapshots from older schema versions are discarded because they do not prove which depth actually completed.

## Rebuild flow

Memory rebuilds operate on closed-thread `SUMMARY.md` files. The core exposes two modes:

- `incremental` is the normal reconciliation path. It embeds only new or changed summary records and removes records whose source summary disappeared.
- `full` rebuilds the entire derived snapshot. It remains an explicit manual operation for recovery or provider-contract changes.

CLI rebuild remains explicit and synchronous. It should run after a thread is closed or a `SUMMARY.md` changes:

```bash
marc memory status
marc memory rebuild
marc memory rebuild --mode full
```

Both modes scan `.marc/threads/*/SUMMARY.md`, use manifest hashes to determine their work, write LanceDB data under `.marc/memory/`, and publish a new `manifest.json` only after the derived index operation succeeds. The manifest contract is `schemaVersion: 6` with `retrievalContract: "field-aware-hybrid-v2"`. The corpus separates one thread identity record from sentence-aware content passages of at most 320 mMARCO tokens with a 48-token overlap. Passages retain section context, while title identity is embedded once per thread. LanceDB stores separate full-text indexes for title, summary text, and title prefixes; prefix search is requested only for a single whitespace-delimited query term. Incremental reconciliation requires the current schema and retrieval contract; a missing or incompatible generation requires an explicit full rebuild. Embedding uses sequential bounded batches. `memory.embeddingBatchSize` defaults to `4` records and accepts even values from `2` through `16`.

The daemon and UI add background rebuild for interactive use:

- workspace settings are stored per workspace in `.marc/marc.config.json`;
- `memory.autoRebuild` defaults to `true`;
- automatic rebuild only runs when rebuild readiness is true, which requires the E5 retriever and mMARCO reranker but not the query interpreter;
- automatic rebuild is considered only for `missing` or `stale` memory and always uses `incremental` mode;
- `degraded` memory waits for manual action and never enters an automatic retry loop;
- manual rebuild from the CLI, UI, MCP, and HTTP API defaults to `incremental`, while `full` requires an explicit mode selection;
- the UI uses the existing `POST /api/workspaces/:workspaceId/memory/rebuild` route with an optional `mode` body field;
- the workspace settings panel exposes the shared batch-size setting as a slider from `2` to `16` records;
- the workspace settings panel exposes search retry depth from `0` to `3` and a manual purge action for unused model files and index generations;
- background prepare and rebuild requests are deduplicated per workspace inside the daemon;
- memory rebuild execution is guarded by a cache-backed workspace lock shared by daemon, MCP, and CLI;
- a concurrent memory rebuild request does not queue another run; it reports `rebuilding` while the active owner continues;
- stale rebuild lock metadata is recovered before status checks or new rebuild attempts.

Manual purge is available from the CLI and UI HTTP route, not as an MCP tool. It preserves the active memory generation and configured production model files, removes inactive generations and unused model artifacts, and optimizes the active LanceDB table. Purge, prepare, recall, and rebuild use the shared per-workspace memory-operation lock; rebuild also uses the rebuild lock observed by status checks.

Workspace settings are structured machine configuration. Markdown remains the source of truth for mARC knowledge, threads, summaries, rules, messages, and artifacts.

If a background rebuild fails, `/api/status` reports memory as `degraded` with `lastError`. Existing snapshots remain derived state and are not treated as source of truth.

`memory_status` also checks the shared rebuild lock. It can report `rebuilding` while another process owns the rebuild, without loading the model or touching the embedding provider.

The manifest records:

- schema version;
- retrieval contract;
- build timestamp;
- embedding provider metadata;
- model, dimensions, distance, and quantization metadata;
- summary hashes and record IDs.

If the embedding contract or passage schema changes, run a full rebuild. The current identity-and-passage format requires manifest schema version `6` and retrieval contract `field-aware-hybrid-v2`. Changing only the query interpreter does not invalidate the vector generation. Vectors from different providers or dimensions are not mixed.

## UI indicator

The daemon exposes summary-memory health per workspace through `/api/status` at `modules.memory.workspaces`.

The UI renders that state on each workspace card:

- `DatabaseCheck`: memory is ready and current.
- `DatabaseBackup`: memory is stale, missing, or waiting for the local model cache.
- `DatabaseZap`: memory model preparation or rebuild is running.
- `DatabaseX`: memory is incompatible or degraded.

This indicator is separate from `Connected`, which is daemon/token health, and `Synced`, which is the browser's last successful UI refresh.

The selected workspace detail view exposes workspace settings from the same header action area used by thread artifacts. Its memory controls are `Automatic memory rebuild`, `Prepare models`, `Incremental rebuild`, `Full rebuild`, current memory status, and the last error when present.

When a browser is connected through the daemon event stream, the daemon watches only memory rebuild lock transitions for registered workspaces. It emits `workspace-changed` when the lock becomes active or inactive, so the existing status refresh can show `DatabaseZap` during rebuilds started from UI, MCP, or CLI. The monitor stops when no UI client is connected.

## UI search

The UI can search the same summary-memory index used by `memory_recall`. This is not a separate text search index.

The search panel is available only when workspace memory is `ready` or `stale`. A stale index can still be queried, but the UI warns that recent summaries may be missing. `missing`, `model_missing`, `incompatible`, `preparing`, `rebuilding`, and `degraded` states block the search action.

Search runs only when the user presses Enter or the search button. It does not run on every keystroke because recall must generate an embedding for the query with the local provider. A persistent daemon can reuse the provider during the short idle window described above.

The UI stores only the latest search snapshot in local browser storage and overwrites that slot after each completed search. It does not maintain a search history.

## Recall flow

Agents should call `memory_recall` before proposing or developing behavior that may overlap historical decisions:

```text
memory_recall(query: "implement interface token rotation")
```

The tool returns a compact memory pack:

- relevant thread IDs and titles;
- matching summary text;
- final ranking score;
- reason for the match, including ranking signals when available;
- canonical `marc://` thread reference;
- next actions.

Recall embeds the effective query with E5 and retrieves identity records and content passages in separate dense channels. It also queries field-aware FTS over title and summary text; a title-prefix channel is added only for a single whitespace-delimited query term. The mMARCO O4 cross-encoder reranks up to three passages per thread using the canonical title, optional section, and passage text. Semantic eligibility is computed from dense retrieval and reranker evidence before lexical ranking signals are applied. Only semantically eligible threads are returned, but title, summary, and applicable title-prefix matches can reinforce the ordering of those eligible threads. The final limit is applied after thread consolidation.

This ranking is a read-time projection only. It does not change the `SUMMARY.md` source of truth or the committed `.marc/memory/` snapshot format.

When a result is relevant, the agent should read the referenced thread before reopening or contradicting the historical decision.

## Quality benchmark

Run the opt-in local quality suite against a schema v6 generation with the required local model caches prepared. A full rebuild is required when migrating an older or incompatible generation:

```bash
pnpm run memory:quality -- --workspace <path>
```

The suite interprets each curated query once and reuses its effective query across the selected depths. By default it evaluates all cases at depths `0` through `3` with the `hybrid-prefix` strategy. It reports interpretation metadata, graded relevance, eligibility, ordering metrics, and observational duration. It does not test O4 score invariance across embedding batches or worker TTL behavior. The suite is not part of the normal unit-test command because it requires the local model cache and workspace memory generation.

The quality command accepts `--workspace <path>`, `--family <name>`, `--query <exact-query>`, `--depth 0|1|2|3`, `--strategy baseline|hybrid-exact|hybrid-prefix`, and `--interpret-only`. The default strategy queries title and summary FTS, and also title-prefix FTS for a single whitespace-delimited term. `hybrid-exact` omits title-prefix FTS; `baseline` uses dense retrieval and reranking without lexical channels. `--interpret-only` skips retrieval and reranking.

A separate 30-query evaluation on August 4, 2026 returned 27/30 Top-1 and 28/30 Top-10. Those measurements are historical results for that sample, not current validation or an accuracy guarantee.

Use the separate model matrix only for controlled retriever and reranker experiments:

```bash
pnpm run memory:benchmark -- --workspace <path>
```

The matrix runs the `baseline`, `retriever-base`, `reranker-bge`, and `base-bge` profiles in separate processes. Each profile re-embeds rows into an `InMemoryMemoryVectorStore`; the profile run selects the `baseline` quality strategy, whose lexical search is empty. The matrix therefore compares dense model profiles and does not exercise production LanceDB FTS or hybrid-prefix ranking. It preserves the production generation. Results are written to `.marc/cache/memory-model-benchmark/latest.json` by default. Experimental model files remain isolated under `.marc/cache/memory-models/experiments/` and are not active production models.

The matrix is intentionally exhaustive and CPU-intensive. Its duration does not represent normal recall latency. Long runs can use `--detach`, and an interrupted matrix can use `--resume` to preserve completed profiles.

## MCP tools

| Tool | Use |
|---|---|
| `memory_prepare` | Prepare the local interpreter, retriever, and reranker caches. |
| `memory_status` | Check whether the committed memory index is ready, stale, missing, incompatible, or waiting for the local model. |
| `memory_rebuild` | Rebuild `.marc/memory/` from `SUMMARY.md` files. |
| `memory_recall` | Retrieve relevant historical summaries for a development intent. |

All memory tools are gated by `workspace_bootstrap`.
