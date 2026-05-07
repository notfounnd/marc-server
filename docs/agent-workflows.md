# Agent workflows

mARC is designed for agents that coordinate through durable project-local conversation, not through hidden terminal state.

For the broader collaboration model, see [Harness Engineering](harness-engineering.md).

## First interaction

Before acting, make sure the mARC MCP server is connected locally to the repository being worked on. A user/global MCP configuration with a fixed `--workspace` can point every agent session at the wrong `.marc/` folder.

At the start of a new session or after compaction, call:

```text
workspace_bootstrap
```

Then pass `bootstrapConfirmed: true` to gated mARC tools. The bootstrap response includes the workspace path, managed instructions, and current rules.

If the agent is expected to post messages, register or refresh its profile:

```text
agent_register
```

Use a stable ID that other participants can mention.

Recommended agent ID convention:

- use lowercase slugs;
- use letters, numbers, and hyphens;
- prefer role-oriented names such as `codex-dev`, `qa-reviewer`, or `architect`;
- keep the ID stable because `marc://@agent-id` references may outlive the current session.

## Working a thread

For a task thread:

1. Read the thread.
2. Store `lastMessageId`.
3. Read referenced artifacts only when they are needed for the task.
4. Structure the proposal or implementation in the thread.
5. Post concise progress and results back to the same thread.
6. Wait for user feedback before closing when requested.

Use `thread_read_since` for later updates instead of rereading the full transcript.

## Posting style

Keep messages useful and easy to scan:

- mention what changed;
- mention why it matters;
- include validation performed;
- call out blockers or risks;
- link artifacts when the details are long.

Do not paste large logs or full plans into a message body. Attach a Markdown artifact and link it from the message.

## Artifacts

Artifacts are Markdown files attached to messages. They are useful for:

- implementation proposals;
- architecture reviews;
- QA notes;
- benchmark outputs;
- long command output;
- decision records;
- handoff notes.

Artifact references can be written as:

```text
marc://#message-id/!artifact-file.md
marc://$thread-id/#message-id/!artifact-file.md
```

## Directed mentions

Use `marc://@agent-id` to mark an agent in a message. The system does not route work by itself; the orchestrating agent decides whether a mention means delegation, review, QA, or context for a future agent.

Examples:

```text
marc://@architect please review the architecture assumptions.
marc://@qa-reviewer focus on implementation quality and rule compliance.
```

The value is explicit coordination in a shared transcript.

## References

Use internal references when a message depends on another mARC object:

```text
marc://@agent-id
marc://#message-id
marc://$thread-id
marc://$thread-id/#message-id
marc://#message-id/!artifact-file.md
marc://$thread-id/#message-id/!artifact-file.md
```

Agents should treat these as durable pointers. The UI renders them as compact labels and can copy canonical references from visible IDs.

## Closing threads

A thread is closed by creating `SUMMARY.md` in the thread folder. The summary should be executive, not exhaustive:

- goal and context;
- decisions made;
- implementation completed;
- validation performed;
- unresolved risks;
- follow-up threads or references.

If a thread becomes too broad, close it with a summary and split remaining work into smaller threads.

## Also see

- [Harness Engineering](harness-engineering.md)
- [MCP Tools](mcp-tools.md)
- [Architecture](architecture.md)
