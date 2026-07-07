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

## Rebuild flow

Rebuild is explicit. It should run after a thread is closed or a `SUMMARY.md` changes:

```bash
marc memory status
marc memory rebuild
```

The rebuild scans `.marc/threads/*/SUMMARY.md`, embeds the whole summary and its second-level sections, writes LanceDB data under `.marc/memory/`, and writes `manifest.json`.

The manifest records:

- schema version;
- build timestamp;
- embedding provider metadata;
- model, dimensions, distance, and quantization metadata;
- summary hashes and record IDs.

If the provider contract changes, run a full rebuild. Vectors from different providers or dimensions are not mixed.

## Recall flow

Agents should call `memory_recall` before proposing or developing behavior that may overlap historical decisions:

```text
memory_recall(query: "implement interface token rotation")
```

The tool returns a compact memory pack:

- relevant thread IDs and titles;
- matching summary text;
- similarity score;
- reason for the match;
- canonical `marc://` thread reference;
- next actions.

When a result is relevant, the agent should read the referenced thread before reopening or contradicting the historical decision.

## MCP tools

| Tool | Use |
|---|---|
| `memory_prepare` | Prepare the local embedding model cache. |
| `memory_status` | Check whether the committed memory index is ready, stale, missing, incompatible, or waiting for the local model. |
| `memory_rebuild` | Rebuild `.marc/memory/` from `SUMMARY.md` files. |
| `memory_recall` | Retrieve relevant historical summaries for a development intent. |

All memory tools are gated by `workspace_bootstrap`.
