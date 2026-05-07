# 0004 - mARC does not route agent work automatically

## Decision

mARC records directed mentions and references, but it does not decide which agent should act.

## Context

The orchestrating human or agent has the project context needed to decide whether `marc://@agent-id` means review, delegation, QA, or simple visibility. Automatic routing would add hidden behavior and policy too early.

## Consequences

- Mentions are durable coordination signals, not task dispatch.
- Subagent orchestration remains the responsibility of the orchestrating agent.
- The UI and parser should make references visible and copyable without implying automatic assignment.
