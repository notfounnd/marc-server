# Harness engineering

Harness engineering is the work of building the operational structure around an agent so its output is easier to observe, repeat, review, and coordinate.

For coding agents, the harness is not only tests and CI. It also includes the project-local context that tells an agent what to do, how to collaborate, where to leave evidence, and how the next agent can continue the work.

mARC is designed to provide that collaboration harness.

## What mARC adds

| Harness need | mARC support |
|---|---|
| Observable work | Threads preserve task conversations in `CHAT.md`. |
| Repeatable context | `INSTRUCTIONS.md`, `RULES.md`, and agent profiles keep the workspace contract close to the code. |
| Reviewable evidence | Artifacts store plans, reviews, benchmark output, logs, and decision notes as Markdown. |
| Coordinated agents | Directed mentions and `marc://` references let orchestrators point humans and subagents at specific context. |
| Efficient continuation | Cursor-based reads let agents fetch only messages added after a known `lastMessageId`. |
| Clean closure | `SUMMARY.md` creates an executive summary and marks completed threads as closed. |
| Human oversight | The local UI lets people inspect threads, artifacts, agents, summaries, and workspace status. |

## Agent context as infrastructure

An agent harness should make context explicit instead of relying on hidden terminal history. mARC does that with project-local Markdown:

```text
.marc/
  INSTRUCTIONS.md
  RULES.md
  agents/
  threads/
```

This makes the collaboration state inspectable with ordinary tools and readable by both humans and agents.

## Bootstrap and rules

`workspace_bootstrap` is the entry point for a session. It refreshes managed recommendations, returns the current workspace instructions and rules, and gives the agent the `bootstrapConfirmed: true` flag needed for gated tools.

That creates a small but important contract:

- the agent learns the workspace protocol before acting;
- the user can keep project-specific rules in `RULES.md`;
- the managed bootstrap instructions remain consistent across sessions;
- a compacted or resumed agent can recover by bootstrapping again.

## Artifacts and evidence

Agent output often includes long plans, implementation notes, test logs, or benchmark results. Putting all of that in chat makes future reads expensive and noisy.

mARC moves long evidence into artifacts and keeps the message body focused on status, decisions, validation, and next steps. This improves both human review and agent continuation.

## Orchestration without hidden routing

mARC does not decide which subagent should act. The orchestrating agent or human remains responsible for delegation.

What mARC provides is durable addressing:

```text
marc://@agent-id
marc://#message-id
marc://$thread-id
marc://#message-id/!artifact-file.md
```

These references let an orchestrator say which agent, message, thread, or artifact deserves attention.

## What mARC does not replace

mARC complements engineering controls. It does not replace:

- automated tests;
- CI;
- linters;
- code review;
- security review;
- project governance;
- runtime observability.

The purpose is narrower: make agent collaboration state explicit, durable, and easy to inspect.

## Practical result

The practical result is a local, reviewable workflow: agents bootstrap the workspace, work through threads, attach long evidence as artifacts, use references for handoffs, and close completed work with an executive summary.

That is the harness mARC provides: not the agent itself, but the structure that helps the agent work inside a project with accountability.

## Also see

- [Architecture](architecture.md)
- [Agent Workflows](agent-workflows.md)
- [MCP Tools](mcp-tools.md)
