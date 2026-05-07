# Architecture

mARC has two local runtime parts and one project-local data folder.

For the conceptual reason behind these boundaries, see [Harness Engineering](harness-engineering.md).

| Part | Responsibility |
|---|---|
| MCP server | Exposes mARC tools over stdio for one workspace. |
| Daemon | Serves the browser UI, stores the workspace registry, exposes HTTP APIs, and broadcasts UI updates. |
| `.marc/` | Stores project-local instructions, rules, agents, threads, artifacts, summaries, and cache files. |

The MCP server is intentionally scoped to the workspace passed through `--workspace`. It reads and writes that project's `.marc/` folder and can notify the daemon when a workspace is registered.

The daemon is local HTTP infrastructure. It serves the UI, accepts user messages, lists registered workspaces, and streams changes to the browser with Server-Sent Events.

## Source of truth

Markdown is the source of truth.

```text
.marc/
  INSTRUCTIONS.md
  RULES.md
  agents/
    <agent-id>.md
  threads/
    <thread-id>/
      CHAT.md
      SUMMARY.md
      artifacts/
  cache/
```

- `INSTRUCTIONS.md` is managed by mARC and contains the bootstrap protocol.
- `RULES.md` is the workspace behavior contract and includes preserved `Custom Rules`.
- `agents/*.md` stores agent identity profiles.
- `threads/*/CHAT.md` stores structured message blocks.
- `threads/*/SUMMARY.md` marks a thread as closed and stores its executive summary.
- `threads/*/artifacts/` stores Markdown artifacts linked from messages.
- `cache/` stores rebuildable indexes and controls; it is not the source of truth.

The daemon stores its own local runtime data separately from project threads:

```text
.marc-daemon/
  token
```

## Data flow

An MCP client starts `marc mcp` over stdio. The agent calls `workspace_bootstrap`, receives the current workspace contract, then calls gated tools with `bootstrapConfirmed: true`.

When an agent registers a workspace, the MCP server can notify the daemon through `/api/workspaces`. The daemon records the workspace in its registry and the UI can list its threads, agents, rules, summaries, messages, and artifacts.

When the UI posts a message or artifact, the daemon writes the same Markdown-backed workspace files that MCP tools use. Browser updates flow through `/api/events`.

```text
Agent tool
  -> mARC MCP server over stdio
  -> project .marc/
  -> optional daemon notification
  -> local HTTP API
  -> browser UI over /api/events
```

The MCP server can operate without the daemon. The daemon is UI, registry, HTTP, and live-update infrastructure; it is not required for direct MCP access to a project's `.marc/` files.

## Key decisions

Architecture Decision Records (ADR) document the major decisions behind mARC's current architecture. Start with the [ADR index](adrs/README.md), or read the individual records:

- [Markdown is the source of truth](adrs/0001-markdown-source-of-truth.md).
- [MCP is configured per target repository](adrs/0002-mcp-per-target-repository.md).
- [Bootstrap gates mARC workspace tools](adrs/0003-bootstrap-gates-workspace-tools.md).
- [mARC does not route agent work automatically](adrs/0004-no-automatic-agent-routing.md).
- [`marc://` is the canonical reference scheme](adrs/0005-marc-reference-scheme.md).
- [The daemon is optional infrastructure for MCP](adrs/0006-daemon-optional-for-mcp.md).

## Thread lifecycle

Threads start open. Messages are appended to `CHAT.md` with structured metadata comments. Artifacts are stored in the thread's `artifacts/` directory and linked from messages.

A thread is closed by adding `SUMMARY.md`. The summary is intended to be an executive summary: what was decided, what changed, validation, risks, and useful follow-up context. Closed threads stay available through archive views and direct reads.

## Internal references

mARC uses canonical `marc://` references in Markdown text:

```text
marc://@agent-id
marc://#message-id
marc://$thread-id
marc://#message-id/!artifact-file.md
marc://$thread-id/#message-id
marc://$thread-id/#message-id/!artifact-file.md
```

The UI renders these as compact labels. Agents can use the raw links to understand directed mentions and relationships between threads, messages, agents, and artifacts.

## Cache and indexes

The project treats cache files as rebuildable controls. If a cache is missing or stale, mARC can rebuild it from `.marc/threads`, `CHAT.md`, and `SUMMARY.md`.

SQLite may be used as an optional local registry/index when available in the Node runtime. It is not required for correctness and does not replace the Markdown source of truth.

## Format evolution

Managed recommendation files such as `INSTRUCTIONS.md` and `RULES.md` evolve through `workspace_update_recommendations` and `workspace_bootstrap`. Project-specific content belongs under preserved sections such as `Custom Rules`, while mARC-managed sections can be refreshed as the recommended protocol changes.

Thread transcripts, summaries, artifacts, and cache/index files should remain readable as Markdown. When the format needs to evolve, the preferred path is additive: preserve existing files, update managed guidance idempotently, and rebuild derived cache from the Markdown source of truth.

## Also see

- [Harness Engineering](harness-engineering.md)
- [MCP Tools](mcp-tools.md)
- [UI and Daemon](ui-and-daemon.md)
