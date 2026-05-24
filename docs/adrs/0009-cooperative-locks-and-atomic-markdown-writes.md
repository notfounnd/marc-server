# 0009 - Markdown writes use cooperative locks and atomic file replacement

## Decision

mARC-managed writers coordinate changes to existing workspace Markdown through filesystem-backed locks stored under `.marc/cache/write-locks/`. Locks are scoped by logical resource: a thread, an agent profile, or managed workspace recommendations.

Writers that replace file content publish the completed content through a temporary file in the same directory followed by `rename`. Thread message append operations acquire the thread lock before appending so they do not race with artifact metadata updates that replace `CHAT.md`.

Thread index rebuilds use the same cooperative locking mechanism, while `thread-index.json` remains a rebuildable cache rather than authoritative state.

## Context

The MCP server and the optional daemon/UI can run in separate processes and write the same project-local workspace. A process-local queue cannot protect those operations. In particular, attaching artifact metadata reads and replaces `CHAT.md`, which can overwrite a concurrently appended message unless both writers coordinate.

Agent registration and managed recommendation refreshes also read existing Markdown before replacing it so they can preserve manual profile context or `Custom Rules`.

## Consequences

- Cooperative mARC writers do not overwrite each other's Markdown updates for the same logical resource.
- Readers observe a prior complete replacement target or the next complete replacement target, not a partially written file.
- Artifact file creation and message metadata publication are not a multi-file transaction; an interrupted operation can leave an orphan artifact that workspace audit can report.
- External manual file edits do not participate in mARC locks and therefore do not receive serialization guarantees.
- Lock files and index snapshots are disposable coordination/cache state and do not replace Markdown as the source of truth.
