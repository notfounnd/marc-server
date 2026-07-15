# Thread summary memory

mARC can maintain a shared semantic memory index for closed thread summaries. The feature helps agents discover prior decisions before they propose or change behavior, while keeping the chat and Markdown workspace as the product source of truth.

## Source of truth

Only thread `SUMMARY.md` files feed the first memory index. `CHAT.md`, artifacts, docs, rules, and agent profiles are not embedded by this feature in v1.

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

## Local embedding model

mARC owns the embedding provider contract for this shared index. The default provider is local and offline after preparation. It uses a small multilingual feature-extraction model through Transformers.js.

The model files are not committed. They live in the ignored local cache:

```text
.marc/cache/memory-models/
```

Run `memory_prepare` once per machine, or use the CLI:

```bash
marc memory prepare
```

`memory_status` does not load the model. It only checks whether the model cache and index manifest are usable.

## Provider lifecycle

`memory_recall` keeps one local embedding provider per workspace process for a
short idle window. Consecutive recalls in a persistent daemon or MCP process
reuse that provider instead of loading a new feature-extraction pipeline for
every request. The default idle timeout is 30 seconds.

The provider is discarded after the workspace becomes idle and when the daemon
closes. The timer is unreferenced, so a one-shot CLI recall does not remain
alive only because of the idle window. This lifecycle does not change the
committed LanceDB snapshot, the summary corpus, ranking, or public recall
inputs and outputs.

The UI can also prepare the model explicitly from the selected workspace settings panel through `POST /api/workspaces/:workspaceId/memory/prepare`. The daemon never prepares or downloads the model automatically.

## Rebuild flow

MCP and CLI rebuild is explicit and synchronous. It should run after a thread is closed or a `SUMMARY.md` changes:

```bash
marc memory status
marc memory rebuild
```

The rebuild scans `.marc/threads/*/SUMMARY.md`, embeds the whole summary and its second-level sections, writes LanceDB data under `.marc/memory/`, and writes `manifest.json`.

The daemon and UI add background rebuild for interactive use:

- workspace settings are stored per workspace in `.marc/marc.config.json`;
- `memory.autoRebuild` defaults to `true`;
- automatic rebuild only runs when the local model is already prepared;
- automatic rebuild is considered only for `missing` or `stale` memory;
- manual rebuild from the UI uses `POST /api/workspaces/:workspaceId/memory/rebuild`;
- concurrent prepare/rebuild requests are deduplicated per workspace.

Workspace settings are structured machine configuration. Markdown remains the
source of truth for mARC knowledge, threads, summaries, rules, messages, and
artifacts.

If a background rebuild fails, `/api/status` reports memory as `degraded` with `lastError`. Existing snapshots remain derived state and are not treated as source of truth.

The manifest records:

- schema version;
- build timestamp;
- embedding provider metadata;
- model, dimensions, distance, and quantization metadata;
- summary hashes and record IDs.

If the provider contract changes, run a full rebuild. Vectors from different providers or dimensions are not mixed.

## UI indicator

The daemon exposes summary-memory health per workspace through `/api/status` at `modules.memory.workspaces`.

The UI renders that state on each workspace card:

- `DatabaseCheck`: memory is ready and current.
- `DatabaseBackup`: memory is stale, missing, or waiting for the local model cache.
- `DatabaseZap`: memory model preparation or rebuild is running.
- `DatabaseX`: memory is incompatible or degraded.

This indicator is separate from `Connected`, which is daemon/token health, and `Synced`, which is the browser's last successful UI refresh.

The selected workspace detail view exposes workspace settings from the same header action area used by thread artifacts. Its memory controls are `Automatic memory rebuild`, `Prepare model`, `Rebuild memory`, current memory status, and the last error when present.

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
- final relevance score;
- reason for the match, including ranking signals when available;
- canonical `marc://` thread reference;
- next actions.

Recall uses vector search to find candidates, then applies local hybrid ranking before returning the final list. The ranking combines vector score, exact normalized query terms, and a small section boost for decision-oriented sections such as `Decision`, `Decisions`, `Architecture`, `Risks`, and `Validation`.

This ranking is a read-time projection only. It does not change the v1 corpus, the `SUMMARY.md` source of truth, or the committed `.marc/memory/` snapshot format.

When a result is relevant, the agent should read the referenced thread before reopening or contradicting the historical decision.

## MCP tools

| Tool | Use |
|---|---|
| `memory_prepare` | Prepare the local embedding model cache. |
| `memory_status` | Check whether the committed memory index is ready, stale, missing, incompatible, or waiting for the local model. |
| `memory_rebuild` | Rebuild `.marc/memory/` from `SUMMARY.md` files. |
| `memory_recall` | Retrieve relevant historical summaries for a development intent. |

All memory tools are gated by `workspace_bootstrap`.
