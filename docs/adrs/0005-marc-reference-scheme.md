# 0005 - `marc://` is the canonical reference scheme

## Decision

mARC uses `marc://` URLs as canonical references to agents, messages, threads, and artifacts.

## Context

References must be readable in Markdown, parseable by tools, and renderable by the UI. A URI-like shape avoids ambiguous plain text and gives agents a stable contract.

## Consequences

- Agent references use `marc://@agent-id`.
- Message references use `marc://#message-id`.
- Thread references use `marc://$thread-id`.
- Artifact references use `marc://#message-id/!artifact-file.md` or `marc://$thread-id/#message-id/!artifact-file.md`.
- The UI can render compact labels while preserving the canonical URL.
