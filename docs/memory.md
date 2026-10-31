# Thread summary memory

mARC can maintain a shared semantic memory index for closed thread summaries. The feature helps agents discover prior decisions before they propose or change behavior, while keeping the chat and Markdown workspace as the product source of truth.

## Source of truth

Closed-thread `SUMMARY.md` content is indexed in layer 0. The production index also holds the other source layers: artifacts, workspace rules, and configured documents in layer 1, and chat messages of closed threads in layer 2 (see the source layers below). The default search, at depth `0`, reads layer 0 only. Use `thread_write_summary` to create a summary or revision-check an update; the Markdown file remains the source of truth. When available, the canonical title is read from `CHAT.md` and stored with the summary records. Agent profiles are never part of the memory corpus.

A summary write commits the source before refreshing derived projections. The result reports thread-index and memory projection state; an unavailable refresh does not undo the saved summary. Automatic memory rebuilds may schedule an incremental reconciliation when eligible. If memory remains pending, run `memory_rebuild` in its default incremental mode. Summary writes do not prepare or download retrieval models.

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

### Source layers and provenance

The rebuild reads source layers. Layer 0 holds closed-thread summaries. Layer 1 holds artifacts (top-level `.md` files of closed threads), the workspace rules (`.marc/RULES.md`), and configured documents. Layer 2 holds chat messages (`CHAT.md` of closed threads). The rebuild indexes the layers in `INDEXED_LAYERS`, which is `[0, 1, 2]` since the activation accepted on 2026-10-27. A rebuild with explicit layers indexes only those; the harness uses `[0]` to build the layer-0 M0 reference copy.

Every record carries its provenance: `sourceType`, `layer`, `sourcePath` (relative to the workspace root, with `/`), `authority` (`decision`, `rule`, `artifact`, `document`, or `conversation`), `lineStart` and `lineEnd`, `sourceSha256` (the hash of the source file bytes), `passageOrdinal`, `passageSha256` (the hash of the indexed text), and `passageId`. Chat records also carry `messageId` and `agentId`, and artifact records carry `artifactFileName`.

`passageId` is `<sourcePath>#<first 16 hex characters of passageSha256>`. It identifies a passage by its content. Two passages of different text in one section get different ids, the same text in one file gets the same id, and a changed text gets a new id, so judgments tied to the old text stop applying. Line numbers are only a locator for navigation: they do not identify a passage, and passages inherit the lines of their section.

Thread records use the thread ID. Other groups use reserved identifiers that the slug function never produces: `@rules` for the rules file and `@document/<sourcePath>` for each document. Repeated headings inside one source get `-2`, `-3`, and so on, so record ids stay unique.

Text normalization turns Markdown into plain text for embedding and lexical search, in this order: HTML comments are removed; fenced blocks keep their body only for `text`, `txt`, `bash`, `sh`, `shell`, `console`, or no language, and are removed otherwise, always without their delimiters (a fence is three or more backticks or tildes, indented up to three spaces, closed by the same character in a run at least as long; a fence that never closes runs to the end of the text, and a heading inside a fence does not start a section); inline code keeps its text; images keep their alt text; links keep their text and URL, and collapse to one when both are equal; line markers (headings, quotes, list items, task boxes) are removed; emphasis markers are removed only when they are not glued to a letter or digit; table separator rows are removed and pipes become spaces; horizontal rules are removed; then `#`, `>`, `*`, hyphens and underscores become spaces, as in E0, so `auto-idle` indexes as `auto idle`, `memory_deep` as `memory deep` and `Suporte a # para` as `Suporte a para`; whitespace collapses. In the E1 measurement, keeping these characters inside the text changed the order of the top threads in case A25 and dropped its top thread below the eligibility threshold, so all of them are split as in E0.

External documents are configured in `.marc/marc.config.json` under `memory.documentSources`, an array of `{ "path": "<relative path>", "authority": "normative" | "reference" }`. The default is `[]`. The settings API and the UI do not edit this list, and updates preserve it. An entry is dropped when it is not an object, when its path is empty or not a string, when its authority is neither value, when its path is absolute (including drive letters and UNC paths), when it leaves the workspace (starts with `..`), when it points into `.marc/`, or when a segment is `node_modules`. A source that is missing or is a link yields nothing, and a file must have the `.md` extension. A directory is read recursively for `.md` files up to four path segments below the source, at most 200 files per source in lexicographic order, without following links and without entering `.marc/` or `node_modules/`. Authority follows a fixed table: `normative` documents are indexed as `rule`, and `reference` documents as `document`.

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

## UI search

The UI uses the workspace memory recall route and shares the same candidate and eligibility policy as MCP. MCP keeps its default `limit` of `5`. The UI requests up to `50` results because its purpose is to give a human a broader view of relevant history.

The UI runs one search per submitted query, at the default depth `0`, which is the same candidate path as the M0 search. It sends no `depth` and offers no retry or search-depth setting. Layers `1` and `2` are not part of the UI; agents reach them through the MCP tool and the CLI (see the depth section below and ADR 0012).

Lexical matches cannot make an otherwise ineligible thread eligible. The `minScore` input was removed from the CLI, MCP, and HTTP recall contracts; callers cannot use it to change the eligibility threshold.

## Depth and corpus layers

Recall takes a `depth` from `0` through `2`, with `0` as the default. The depth counts corpus layers: depth `d` searches every layer up to `d`.

| Depth | Layers searched | Candidates |
| --- | --- | --- |
| `0` | `0`: summaries | the M0 candidate pool |
| `1` | `0` and `1`: adds artifacts, rules, and documents | the whole consolidated M0 pool of those layers (each group's identity record and up to three passages), reranked |
| `2` | `0`, `1`, and `2`: adds chat messages | the whole consolidated M0 pool of those layers (each group's identity record and up to three passages), reranked |

The MCP tool, the CLI, and the HTTP route reject depth `3` with the layer explanation. The response reports `layersSearched` with the layers that ran, and `rerankPairs` with the pairs sent to the reranker. A layer that the index does not hold is skipped. The production index has held layers `0`, `1`, and `2` since the rebuild of 2026-10-27, so depths `1` and `2` search and rerank the layers they name. The funnel and the adaptive expansion are not production paths (see ADR 0012).

When correction is applied, the UI shows the effective query and offers `Search instead for <original query>`. When a corpus-backed spelling produces a suggested alternative, the UI keeps the literal result and offers `Search for <suggested query>`. In each case, only the alternate query text is a link; it uses the same auxiliary typography as the surrounding interpretation text. Following it starts a new literal search from depth `0`. The versioned per-workspace localStorage snapshot (schema `7`) preserves only the latest query and its compact result. Snapshots from older schema versions are discarded.

## Rebuild flow

Memory rebuilds read the source layers selected for the index. By default that is every layer: the production constant `INDEXED_LAYERS` is `[0, 1, 2]` since the activation accepted on 2026-10-27, so the summaries, the artifacts, the rules, the configured documents, and the chat messages are indexed. A rebuild with explicit layers, such as `[0]`, indexes only those. The core exposes two modes:

- `incremental` is the normal reconciliation path. It embeds only new or changed summary records and removes records whose source summary disappeared.
- `full` rebuilds the entire derived snapshot. It remains an explicit manual operation for recovery or provider-contract changes.

Automatic incremental reconciliation may be scheduled after a summary write when `memory.autoRebuild` is enabled and the workspace is eligible. `memory_rebuild` remains an explicit synchronous reconciliation path when the write reports memory as pending or an automatic rebuild is disabled or unavailable. It defaults to `incremental`; use `full` only for recovery or provider-contract changes. Neither summary writes nor status checks prepare or download models:

```bash
marc memory status
marc memory rebuild
marc memory rebuild --mode full
```

Both modes scan the indexed source layers (by default `.marc/threads/*/SUMMARY.md`), use manifest hashes keyed by source path to determine their work, write LanceDB data under `.marc/memory/`, and publish a new `manifest.json` only after the derived index operation succeeds. The manifest contract is `schemaVersion: 7` with `retrievalContract: "source-layers-v1"`. The corpus separates one thread identity record from sentence-aware content passages of at most 320 mMARCO tokens with a 48-token overlap. Passages retain section context, while title identity is embedded once per thread. LanceDB stores separate full-text indexes for title, summary text, and title prefixes; prefix search is requested only for a single whitespace-delimited query term. Incremental reconciliation requires the current schema and retrieval contract; a missing or incompatible generation requires an explicit full rebuild. Embedding uses sequential bounded batches. `memory.embeddingBatchSize` defaults to `4` records and accepts even values from `2` through `16`.

Each generation uses an explicit Arrow schema: text columns are nullable `Utf8`, and vectors are nullable fixed-size lists of `Float32` values sized from the generated vectors. Missing `closedAt` and `sectionTitle` values persist as null and read back as absent; empty strings remain empty. Empty generations skip LanceDB table creation, and the manifest is published after the store operation and any applicable validation succeed.

The daemon and UI add background rebuild for interactive use:

- workspace settings are stored per workspace in `.marc/marc.config.json`;
- `memory.autoRebuild` defaults to `true`;
- automatic rebuild only runs when rebuild readiness is true, which requires the E5 retriever and mMARCO reranker but not the query interpreter;
- automatic rebuild is considered only for `missing` or `stale` memory and always uses `incremental` mode;
- `degraded` memory waits for manual action and never enters an automatic retry loop;
- manual rebuild from the CLI, UI, MCP, and HTTP API defaults to `incremental`, while `full` requires an explicit mode selection;
- the UI uses the existing `POST /api/workspaces/:workspaceId/memory/rebuild` route with an optional `mode` body field;
- the workspace settings panel exposes the shared batch-size setting as a slider from `2` to `16` records;
- the workspace settings panel exposes the automatic rebuild switch, the embedding batch size, and a manual purge action for unused model files and index generations;
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
- source type and source path of each record, with source hashes and record IDs.

If the embedding contract or passage schema changes, run a full rebuild. The current format requires manifest schema version `7` and retrieval contract `source-layers-v1`. An index built with schema `6` reports `incompatible` in status, and incremental reconciliation refuses it with `Memory schema changed. Run a full rebuild.`; run one `full` rebuild to migrate. Changing only the query interpreter does not invalidate the vector generation. Vectors from different providers or dimensions are not mixed.

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

Results are grouped by their heuristic confidence band. `High confidence` and `Medium confidence` results appear in the main list. `Low confidence` results appear in a collapsed block labelled `Show less likely results`. Each card shows its band as a signal icon in a row below the card text, aligned to the right: three bars for `high`, two for `medium`, and one for `low`, all in one neutral color. The band name (`High confidence`, `Medium confidence`, or `Low confidence`) is the native tooltip and the accessible name of the icon. The panel shows no score. An abstained search continues through the automatic depths like any other empty result, and ends with the `No results` state.

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
- source type, source path, and authority of the matched record, as optional additive fields;
- a heuristic confidence `band` per hit (`high`, `medium`, or `low`). The band orders results relative to each other. It is not a probability of relevance, and the ranking score is unchanged;
- `abstained`, which is `true` only when the search ran and admitted no thread. It reflects admission and does not depend on `limit`: a truncated list is not abstention. A recall that did not search, such as one on an unready index, a concurrent operation, or a manifest without records, reports `false`;
- next actions.

Recall embeds the effective query with E5 and retrieves identity records and content passages in separate dense channels. It also queries field-aware FTS over title and summary text; a title-prefix channel is added only for a single whitespace-delimited query term. The mMARCO O4 cross-encoder reranks up to three passages per thread using the canonical title, optional section, and passage text. Semantic eligibility is computed from dense retrieval and reranker evidence before lexical ranking signals are applied. Only semantically eligible threads are returned, but title, summary, and applicable title-prefix matches can reinforce the ordering of those eligible threads. The final limit is applied after thread consolidation.

This ranking is a read-time projection only. It does not change the `SUMMARY.md` source of truth or the committed `.marc/memory/` snapshot format. Recall searches only the layers present in the index: layer 0 by default.

When a result is relevant, the agent should read the referenced thread before reopening or contradicting the historical decision.

### Evaluation harness (memory:eval)

The evaluation harness is an opt-in offline suite that scores retrieval against curated, judged cases. It does not change `.marc/memory/`: capture reads the production manifest only to check the rebuild, and every output is written under `.marc/cache/memory-eval/`.

Run the commands in this order with `pnpm memory:eval <command> --corpus <name>`: `validate`, `capture`, `worksheet` (the raters judge the pooled pairs), `merge-judgments`, `latency`, then `report` and `compare`. `replay` is optional for `report`, which runs the replay internally; run `replay` on its own only to inspect one variant. `compare` pairs two captures of the same corpus with the same `queryFingerprint` and the same `corpusDigest`, and refuses any other pair.

Outputs:

- Each capture writes to `.marc/cache/memory-eval/<corpus>/<captureId>/`: `capture.json` (the replay input), `cases/` and `checkpoint.json` (resume state), `latency.json`, `replay-<variants>.json`, `worksheet.md` with `worksheet-template.json`, `report.json`, and `report.md`. `compare` writes `compare-*.json` to the candidate's folder.
- Merge reports (`merge-<timestamp>.json`) are written to `.marc/cache/memory-eval/<corpus>/`.
- Judgments are not stored in the capture folder. Committed judgments are written to `scripts/memory-eval/datasets/<corpus>.json`. Rater files and the consensus file are inputs kept next to the capture.

Three corpora are available:

- `marc`: 114 curated cases over a pinned set of 56 closed threads. Captures record the `corpusDigest` of the pinned threads.
- `ledgerline-en`: a fictional English corpus of 40 cases over 30 closed threads, used as a second, independent check of the harness.
- `marc-deep`: 14 cases over 62 closed threads, which include the 56 threads of `marc`. It evaluates `memory_deep` (see [memory_deep](#memory_deep) and [ADR 0013](adrs/0013-memory-deep-scoped-passages.md)).

Aggregation:

- Ratios are computed over sums: each metric is the sum of numerators divided by the sum of denominators, not the mean of per-case ratios.
- `mrr` is computed over the admitted list. `fullMrr10`, the full-list diagnostic, is limited to the top 10.
- Each metric has a `metricReach`: `admittedList` (judged over the admitted threads), `fullTop10` (judged over the top 10 of the full candidate list), or `diagnosticOnly` (reported, never decided on).

Decision vocabulary:

- The report compares D0 and ORACLE_ADMISSION against M0, metric by metric. Each row gives the difference (candidate minus M0), a 95% paired bootstrap interval, the margin, a term, and the Non-inferior column.
- The interval comes from 10,000 bootstrap resamples of the families, with seed 20261015 and nearest-rank 2.5th and 97.5th percentiles.
- The margin is 0.05 for proportions and 0.03 for ranking metrics (`mrr`, `ndcg10`, `fullMrr10`).
- The term is chosen in this order:
  - `melhora` (improves): the whole interval is above 0.
  - `piora` (worsens): the whole interval is below 0.
  - `não inferior` (non-inferior): the interval contains 0, and its lower bound is above minus the margin.
  - `inconclusivo` (inconclusive): the interval contains 0, and its lower bound is at or below minus the margin.
- The Non-inferior column is true when the lower bound is above minus the margin. It does not depend on the term, so a `piora` can still be non-inferior when the loss stays inside the margin. An `inconclusivo` result is never non-inferior, so it fails a non-inferiority criterion.
- `PRODUCTION_RECALL` appears beside M0 in its own section. It is never a decision comparison.

Attribution:

- Attribution classifies, for the M0 list at depth 0, every thread of grade 3 in a positive case. Each thread gets exactly one category, checked in this order:
  - `success`: the thread is the first admitted thread.
  - `candidate_recall`: the thread reached no channel, or it is not in the list.
  - `admission`: the thread is in the list but was not admitted.
  - `ordering`: the thread was admitted but is not first.
- The passage-selection suspect is a mark, not a category. It applies only to `admission` and `ordering` threads. It is set when the thread's best matrix score beats the best of its selected passages (at most three per thread) and would rank the thread first among the best scores of all threads. A tie does not rank first.

Equivalence:

- CA1a checks the exact path. Fed the production-layout reranker scores, the replay reproduces the production eligibility within 1e-9, with the same thread sequence. Both corpora pass it.
- CA1b checks only the admitted thread sequence against production. The reranker runs in fp16, and its scores depend on the padded length of the batch, so the matrix layout and the production layout can differ slightly. Score deltas are reported as median, p95, and max, but they do not gate.
- In `marc`, case 9I swaps two threads with the same grade (1). No metric changes, because the relevance threshold is grade 2 and a swap of equal grades does not change the discounted gain.
- M0 and `PRODUCTION_RECALL` give identical values on every metric of the admitted list. Their differences in `fullRecall10` and `fullMrr10` are structural: the production search returns only the admitted list, while M0 measures the top 10 of the full candidate list. This is not a regression.

Latency:

- Latency is measured by its own command, after the capture. Each case gets one warm-up recall and three timed samples. The free memory reported by `os.freemem` is recorded at the start and after each case.
- A capture resumed with `--resume` does not measure latency.
- The measurement of 17 October 2026 ran under typical desktop load: browser, editor, terminals, a messenger, and two code agents open and idle. The machine had 15.7 GiB of RAM, about 5.8 GiB free at the start, and idle CPU around 5%. The harness readings at the start of each run showed 14 to 17% CPU load. Future comparisons must repeat the same load condition. These numbers do not describe a minimum hardware target and do not apply to 8 GB machines.
- The first case lowers free memory by about 1.8 GiB. That drop estimates what the process takes with the models loaded.

Judgments:

- Two independent raters judged the pooled pairs. The first-round quadratic kappa was 0.683 on `ledgerline-en` and 0.395 on `marc`. The `marc` value is below the 0.6 threshold and is flagged as `kappa_below_threshold`.
- The rating scale was revised with reference examples before the consensus round.
- Disagreements were resolved by joint adjudication and recorded with `merge-judgments --consensus`. Reports keep the first-round kappa.

Baseline, measured on 17 October 2026. This is a historical measurement, not a guarantee or a current validation:

- `marc`, 114 cases: Top-1 target 0.67 for M0 and 0.94 for `ORACLE_ADMISSION`, the judged-admission upper bound. Full top-10 recall 0.917. Among the grade-3 threads, 67 succeed, 0 are candidate-recall losses, 32 are admission losses, and 14 are ordering losses. Median latency 18.2 s, p95 20.3 s.
- `ledgerline-en`, 40 cases: Top-1 target 0.882. Median latency 5.7 s, p95 6.2 s.
- The loss lies in admission and ordering, not in candidate recall.

Options and production check:

- `capture --all-layers` captures no cases. It rebuilds a temporary workspace twice, once with layer 0 and once with layers 0, 1, and 2, times each rebuild, and counts the records per layer and per source type. It writes `<corpus>/layers-<captureId>.json`, where the id is the fingerprint with every layer indexed. It uses no checkpoint and creates no capture folder. Use it to measure what more layers cost before indexing them.
- `report --without-latency` builds the report without `latency.json`. It writes `report-no-latency.json` and `report-no-latency.md`, never overwrites `report.json` or `report.md`, and renders `Latency: not measured`. Without the flag, the command still requires `latency.json`.
- `capture.json` records `productionCheck` when a production manifest is given. Its mode is `record-ids` when the production manifest has the schema version of the code, and `thread-ids` otherwise. The `thread-ids` check requires every pinned thread in the production manifest and exactly the pinned threads in the temporary manifest. The record stores both schema versions. The field is optional, so captures written before it remain readable.
- The capture id covers every TypeScript file under `src/core/memory/`, including `sources/`. The fingerprint keeps its own baseline, `[0]` (`DEFAULT_INDEXED_LAYERS` in `capture-fingerprint.ts`), not the production `INDEXED_LAYERS`: the indexed layers join the id only when they differ from `[0]`, so a capture with `[0, 1, 2]` names its layers in the id and the layer-0 baseline adds nothing. Captures made after the source layers therefore have new ids; captures made before them keep their ids but no longer match the current code.

## memory_deep

`memory_deep` returns passages with their provenance. An agent uses it when `memory_recall` points to a closed thread whose details are missing, before it reads the whole `CHAT.md`, or when it needs the exact passage it intends to cite. It has no `depth` parameter.

It has two modes:

- **With `threadId`** (a full ID or an 8-character hexadecimal suffix), it searches one closed, indexed thread. The thread's passages in the layers present form the scope, optionally filtered by `sourceTypes` (`summary`, `artifact` or `chat`). At most 232 passages reach the reranker. A thread with more passages keeps the 232 with the highest cosine similarity to the query, and the result sets `scopeTruncated` to `true`. The hits carry no `groupBand`.
- **Without `threadId`**, it searches the depth-2 pool and returns the passages of the groups that the pool admits. Each hit carries its group's confidence `groupBand` (ADR 0011). `sourceTypes` filters the output only.

`score` is the reranker's relevance, not a probability. Each passage appears once. Chat passages are intermediate context: confirm them in the thread `SUMMARY.md` or the final message before relying on them.

The reranking time grows with the passages reranked. In the E4 measurement on the marc-deep corpus ([ADR 0013](adrs/0013-memory-deep-scoped-passages.md)), the 95th percentile of scoped calls was about 35 seconds on the reference machine.

Limits and errors:

- `limit` takes an integer from 1 to 20, with a default of 5.
- With `threadId`, `sourceTypes` accepts only `summary`, `artifact` and `chat`. Rules and documents belong to their own groups.
- The thread must be closed. A thread that is still open returns `thread_not_closed`. A closed thread that the index does not hold returns `thread_not_indexed`, and `memory_rebuild` fixes it.
- Thread resolution reports `thread_not_found`, `ambiguous_thread_id` and `invalid_thread_id`, as the thread tools do.
- When the index or the models are not ready, or another memory operation holds the lock, the call returns no results and the reason in `nextActions`, as `memory_recall` does.

## MCP tools

| Tool | Use |
|---|---|
| `memory_prepare` | Prepare the local interpreter, retriever, and reranker caches. |
| `memory_status` | Check whether the committed memory index is ready, stale, missing, incompatible, or waiting for the local model. |
| `memory_rebuild` | Rebuild `.marc/memory/` from `SUMMARY.md` files. |
| `memory_recall` | Retrieve relevant historical summaries for a development intent. |
| `memory_deep` | Return passages with provenance: the passages of one closed, indexed thread with `threadId`, or the passages of the groups that depth 2 admits without it. |

All memory tools are gated by `workspace_bootstrap`.
