# MCP tools

mARC exposes grouped MCP tool names in `{prefix}_{action}` format. Legacy aliases are intentionally avoided.

## Transport and protocol compatibility

The MCP command runs over stdio and serves only protocol revision `2026-07-28` through the official `@modelcontextprotocol/server` SDK. It rejects legacy initialization. Discovery requests use an `_meta` envelope with `io.modelcontextprotocol/protocolVersion` and `io.modelcontextprotocol/clientCapabilities`; `clientInfo` is optional. Clients may call `tools/list` without discovering first.

The server reports `name: "marc"` and the version from the package manifest. Discovery and tool-list results declare `resultType: "complete"`, `cacheScope: "private"`, and `ttlMs: 0`. All 25 tools are registered independently of bootstrap state. Bootstrap-gated calls return a JSON text result with `isError: true` and `error.code: "bootstrap_required"` until the caller confirms the current workspace bootstrap.

Unknown JSON-RPC methods or tool names use protocol errors. Tool input validation and domain failures return tool results with `isError: true` and sanitized error text. The process-wide limiter accepts up to 60 tool calls in each fixed one-second window; excess calls are rejected immediately and are not queued. See [the migration note](mcp-migration-2026-07-28.md) for wire examples and shutdown behavior.

## Bootstrap protocol

mARC must be configured per target repository. The CLI argument `--workspace` is the repository that owns the `.marc/` folder for that MCP server.

Do not configure mARC as a user/global MCP server with one fixed `--workspace`. That makes unrelated repositories share the same mARC project.

The first mARC action in a session or workspace should be:

```text
workspace_bootstrap
```

`workspace_bootstrap` initializes the workspace if needed, refreshes mARC recommendations, reads `INSTRUCTIONS.md`, reads `RULES.md`, and returns a payload that includes:

```json
{
  "bootstrap": {
    "confirmed": true,
    "nextInput": {
      "bootstrapConfirmed": true
    }
  },
  "agents": {
    "count": 1,
    "registered": [
      {
        "id": "<profile-id>",
        "role": "<role>",
        "model": "<model>",
        "description": "<profile description>"
      }
    ]
  }
}
```

After that, gated tools must be called with:

```json
{
  "bootstrapConfirmed": true
}
```

Reuse the current workspace contract while it remains known. Rerun `workspace_bootstrap` only when bootstrap context is missing, stale, or uncertain.

If a gated tool is called without the flag, it returns `bootstrap_required` and tells the agent to call `workspace_bootstrap`.

## Free tools

| Tool | Use |
|---|---|
| `workspace_bootstrap` | Start or recover mARC context for the current session. |
| `marc_helper` | Ask for tool guidance, examples, and efficient workflows. |
| `workspace_update_recommendations` | Refresh managed mARC guidance files without overwriting project-specific custom rules; this does not establish or restore bootstrap context. |

## Workspace tools

| Tool | Use |
|---|---|
| `workspace_register` | Initialize `.marc/` and register the project with the daemon when configured. |
| `workspace_unregister` | Remove this workspace from the daemon registry without deleting `.marc/`. |
| `workspace_info` | Return the workspace bound to this MCP process. |
| `workspace_read_rules` | Read `.marc/RULES.md`. |
| `workspace_status` | Read workspace health, including thread index and summary-memory state. |
| `workspace_audit` | Audit mARC workspace content for structural compliance across rules, messages, artifacts, references, agents, and preflight checks. |

`workspace_audit` is an on-demand compliance tool. It does not run automatically for every message, it does not fix files, and it does not judge semantic quality. Use it before critical plans, before development, before conclusion, before closing a thread, or when a user asks for a structural quality check.

Supported scopes are `all`, `rules`, `messages`, `agents`, `references`, `artifacts`, and `preflight`. Use `threadId`, `messageId`, `severity`, and `maxFindings` to keep output compact.

The `rules` scope reports missing managed rule sections, malformed critical operational rules, and free-form `Custom Rules` sections that have not yet been converted to the recommended `Trigger`, `Do instead`, `Evidence`, and `Severity` format. Free-form rules remain compatible, but the audit reports them as improvement feedback for agents.

The audit reports objective issues such as missing artifact files, artifact references that were not attached in message metadata, malformed, unresolved, or non-linkable `marc://` references, and incomplete agent metadata. Semantic review of whether a plan is well reasoned belongs in a separate agent review flow, not in `workspace_audit`.

## Memory tools

| Tool | Use |
|---|---|
| `memory_prepare` | Prepare and validate all three local retrieval, reranking, and query-interpretation model caches without rebuilding the index. |
| `memory_status` | Check index health and model-file readiness without loading model weights. |
| `memory_rebuild` | Reconcile the committed LanceDB summary-memory index by default. Pass `mode: "full"` only for an explicit full rebuild. |
| `memory_recall` | Interpret a query, search historical thread summaries, and return relevant `marc://` references. Pass `queryMode: "literal"` to bypass correction. |

Summary memory is derived from `SUMMARY.md` only by default. Agents should use `memory_recall` before proposing or developing behavior that may overlap prior decisions, then read any strongly matched thread before reopening or contradicting the historical decision.

Each recall hit may carry `sourceType`, `sourcePath`, and `authority`. These fields are optional and additive: clients that ignore unknown fields are unaffected. With the default index every hit is a summary, so `sourceType` is `summary`.

Every recall hit carries a heuristic confidence `band` (`high`, `medium`, or `low`). The band orders results relative to each other; it is not a probability of relevance. The response carries `abstained`, which is `true` only when the search ran and admitted no thread. It reflects admission and does not depend on `limit`. A recall that did not search, such as one on an unready index, reports `abstained: false`.

`memory_recall` defaults to `queryMode: "auto"`. The response reports the original and effective queries. Automatic interpretation selects only from corpus-derived typo candidates and falls back to the original query on any model or protocol failure. Use `queryMode: "literal"` when the original spelling must be preserved.

Recall defaults to `limit: 5` and `depth: 0`. Depth accepts `0` through `3` and expands the candidate limit for each dense and lexical retrieval channel to `100`, `200`, `300`, or `400`; it does not relax semantic eligibility. Lexical matches cannot qualify a thread by themselves, but can reinforce ordering after semantic eligibility is established. `minScore` is not a supported recall input.

`memory_rebuild` accepts an optional `mode` input. Omitted or `"incremental"` reconciles only added, changed, or removed summary records. `"full"` rebuilds the complete derived snapshot. Both modes use the workspace batch-size setting and the same per-workspace rebuild lock.

Memory uses schema version `7` and retrieval contract `source-layers-v1`. An index built with schema `6` reports `incompatible`, and incremental rebuild refuses it until one full rebuild migrates it. Incremental rebuild requires a compatible generation; an absent or incompatible generation needs an explicit full rebuild. Rebuild readiness requires the retriever and reranker, while recall additionally requires the interpreter and an index in `ready` or `stale` state. Model preparation does not rebuild the index. Purge is available through the CLI and HTTP API, not as an MCP tool; it preserves the active memory generation and configured production models while removing unused data.

## Agent tools

| Tool | Use |
|---|---|
| `agent_register` | Create or update a profile when necessary and permitted by the workspace contract; returns whether it was `created`, `updated`, or `unchanged`. |
| `agent_list` | List registered agents concisely by default; pass `includeMarkdown: true` only when full profile Markdown is needed. |
| `agent_read_profile` | Read a registered agent profile. |

Inspect the bootstrap `agents.registered` inventory or call `agent_list` first, then reuse an appropriate profile when one exists. Create or update a profile only when needed and permitted by the current workspace contract. Do not assume a fixed profile ID or role catalog across workspaces.

`agent_register` writes canonical profile metadata. The header and `ID` are derived from the slugified `id`; `displayName` is ignored when sent by older clients.

Registration requires `id`, `role`, `model`, and `description`. `role` and `model` are normalized to lowercase with hyphens instead of spaces; model dots are preserved. `description` writes the first input line up to 160 characters. The result includes `id`, `status`, `created`, `alreadyExists`, and `updated`.

```markdown
# <profile-id>

ID: `<profile-id>`
Role: <role>
Model: <model>
Description: <profile description>
```

Structured reads treat profile metadata as line-based fields. Additional manual context in the profile Markdown belongs below the metadata block, is preserved when `agent_register` refreshes the profile, and is available through `agent_read_profile` or `agent_list` with `includeMarkdown: true`.

## Thread tools

| Tool | Use |
|---|---|
| `thread_create` | Create a new thread. |
| `thread_list` | List threads; supports `open`, `closed`, or `all`. |
| `thread_info` | Read metadata such as count, latest message ID, status, and summary availability; metadata does not prove message content was consumed. |
| `thread_read` | Read a transcript; Markdown is omitted by default to reduce token use. |
| `thread_read_since` | Read messages added after a stored `lastMessageId`. |
| `thread_tail` | Read the last N messages. |
| `thread_write_summary` | Create a caller-authored summary to close a thread, or update an existing summary with a revision check. |

### Thread summaries

`thread_write_summary` accepts a full `threadId`, a non-empty Markdown `body`, and an optional `mode` (`create` by default or `update`). `body` contains only caller-authored content. The core owns the title from `CHAT.md`, canonical `Thread` and `Closed` metadata, and the header separator before the body. Creation writes that header and closes the thread; use create only after the human authorizes closure. See [Closing threads](agent-workflows.md#closing-threads) for canonical composition and closure guidance. Updates require `expectedSummaryRevision`, the lowercase SHA-256 revision returned by `thread_info` or `thread_read` with `includeSummary: true`. An update with an equivalent body returns `outcome: "unchanged"` before checking the supplied revision; a changed body must match the current revision. Create retries with the same body are unchanged; attempting to create different content over an existing summary returns `summary_exists`.

Updates accept legacy summaries with older or incomplete headers. On an intentional content change, the core writes a canonical header and preserves an existing valid close date; a legacy summary without `Closed` uses its prior file modification time. Equivalent retries preserve the existing bytes and modification time. Explicit invalid or contradictory metadata returns `metadata_invalid`.

The result includes the canonical `threadId` and `reference`, relative `summaryPath`, closed status and `closedAt`, the new or existing `summaryRevision`, an `outcome` of `created`, `updated`, or `unchanged`, and `projections`. The projection state reports whether the thread index is `updated` or `pending`, whether summary memory is `current`, `scheduled`, or `pending`, and any sanitized projection errors. The summary source remains committed if a derived projection fails.

`thread_info` includes `summaryRevision` when a summary exists. `thread_read` includes `summary` and its matching `summaryRevision` only when requested with `includeSummary: true`; a read without the summary does not return its revision. Write errors include `invalid_input`, `invalid_thread`, `thread_not_found`, `summary_exists`, `summary_not_found`, `revision_conflict`, `metadata_invalid`, `path_invalid`, and `write_failed`. A revision conflict reports the current revision so the caller can reread and decide whether to retry. Projection failures are reported separately and do not hide a committed source write.

### Thread ID resolution

`thread_read`, `thread_read_since`, `thread_info`, and `thread_tail` accept a full thread ID or a unique hexadecimal suffix of exactly eight characters. Full IDs match exactly and take priority. Suffix lookup compares the final segment after the last hyphen and accepts uppercase or lowercase hexadecimal characters.

Resolution scans thread directories in the current workspace, including open and closed threads. A candidate must be a directory with a regular `CHAT.md` file. Symbolic-link directories and symbolic-link `CHAT.md` files are excluded. The resolver does not use the derived thread index. Successful results include the canonical ID in `result.threadId`; `thread_info` also preserves its existing `id` field. This ID is present on `cursor_not_found` results as well.

The read tools return `isError: true` with `thread_not_found` when there is no match, `ambiguous_thread_id` when a suffix matches multiple threads, or `invalid_thread_id` when the input contains path separators or traversal segments. Ambiguity details include sorted canonical IDs in `error.details.candidates`. `message_post` and `message_attach_artifact` continue to require full IDs.

## Message and artifact tools

| Tool | Use |
|---|---|
| `message_post` | Append a structured Markdown message to a thread. |
| `message_attach_artifact` | Write a Markdown artifact under a thread's `artifacts/` folder. |

Use messages for concise status, decisions, and handoffs. Use artifacts for long plans, reviews, benchmark output, logs, or detailed analysis.

Artifact paths are resolved inside the workspace's `.marc/` directory. Attempts to escape that root are rejected.

## Efficient reading pattern

For a new thread:

```text
thread_read(threadId, includeMessages: true)
```

Read and process the returned message content before storing `lastMessageId` for the last message consumed. `thread_info` reports metadata but does not advance this consumed-content cursor. `thread_tail` proves only that its returned window was read, not that earlier backlog was consumed.

For follow-up reads:

```text
thread_read_since(threadId, afterMessageId: "<stored-id>")
```

If `thread_read_since` returns `cursor_not_found` with `shouldReadFullThread: true`, tell the user the incremental cursor failed and read the full thread again with `thread_read`.

When the user provides a specific mARC thread, message, artifact, or agent reference as the source, read that source before broad workspace investigation.

## Typical agent flow

Before using these tools, confirm the MCP server was started for the repository you are acting on:

```text
marc mcp --workspace /path/to/target-project
```

```text
workspace_bootstrap
agent_list or inspect agents returned by workspace_bootstrap
agent_register, only when necessary and permitted by the workspace contract
memory_recall, when proposing or developing behavior
thread_read or thread_create
message_attach_artifact, when detail is long
message_post
workspace_audit, before critical plans or closure when quality checks matter
thread_info, when checking whether more work arrived
thread_read_since, when continuing with a stored cursor
```

## Helper topics

Use `marc_helper` when an agent needs examples instead of guessing. Topics include:

```text
overview
workspace
agents
threads
messages
artifacts
incremental_reading
ui_daemon
all
```

## Also see

- [Harness Engineering](harness-engineering.md)
- [Agent Workflows](agent-workflows.md)
- [Architecture](architecture.md)
