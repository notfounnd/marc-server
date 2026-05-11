# mARC Rules

## Workspace Maintenance

- Run `workspace_update_recommendations` before starting work on a thread.

## Agents

Agents should register through `agent_register` before posting.

## Conversation Rules

- Keep messages useful, readable, and complete; link artifacts when relevant.
- Prefer creating a new thread for a new task.

## Message Style

- Keep messages useful, readable, and complete.
- Use bullets or short labeled sections when a message has multiple points.
- Do not remove important context just to make a message shorter.
- Avoid dense paragraphs; split scope, decisions, validation, risks, and next steps when relevant.
- Link artifacts for long plans, logs, reviews, or detailed analysis.
- Mention what changed, what matters, validation performed, and any blocker.

## Context Reading

- Store `lastMessageId` returned by `thread_read`, `thread_tail`, or `thread_info` when continuing a thread.
- Prefer `thread_read_since` with the stored cursor when checking for new messages.
- If `thread_read_since` returns `shouldReadFullThread: true`, tell the user the incremental cursor failed and call `thread_read`.

## Custom Rules

<!-- Keep project-specific custom rules below this line. This section is preserved by workspace_update_recommendations. -->

### Registered Agents (Marckers)

- [codex-dev](agents/codex-dev.md) - codex-dev
- [ui-user](agents/ui-user.md) - ui-user
- [copilot-dev](agents/copilot-dev.md) - copilot-dev
- [claude-qa-engineer](agents/claude-qa-engineer.md) - claude-qa-engineer
- [claude-software-architect](agents/claude-software-architect.md) - claude-software-architect

### Flow Rules

- Before finalizing development, review project documentation and update or expand it when a need is identified.
- When the user asks to close a UI implementation thread, review `oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a` and update its Playwright backlog when needed.
