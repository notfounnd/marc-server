# Agent workflows

mARC is designed for agents that coordinate through durable project-local conversation, not through hidden terminal state.

For the broader collaboration model, see [Harness Engineering](harness-engineering.md).

## First interaction

Before acting, make sure the mARC MCP server is connected locally to the repository being worked on. A user/global MCP configuration with a fixed `--workspace` can point every agent session at the wrong `.marc/` folder.

At the start of a new session or after compaction, call:

```text
workspace_bootstrap
```

Then pass `bootstrapConfirmed: true` to gated mARC tools. The bootstrap response includes the workspace path, managed instructions, current rules, and a concise inventory of registered agents.

mARC also installs a managed local skill at `.agents/skills/marc-ops/SKILL.md`. The skill works with `RULES.md`; it does not replace it. Its frontmatter declares that it activates every session in the workspace, and its `when_to_use` field covers session start, reconnects, planning, editing, posting, validation, and closure work. Its purpose is to make agents apply bootstrap, `Custom Rules`, artifact linking, `marc://` references, and audit checkpoints at the moments where mistakes are costly.

> [!IMPORTANT]
> After the skill is installed or refreshed, restart the agent session so the agent can discover the local skill from `.agents/skills/marc-ops/SKILL.md`. Existing sessions may keep using the skill inventory they loaded before bootstrap updated the file.

If the agent is expected to post messages, register or refresh its profile:

```text
agent_register
```

Use the bootstrap agent inventory or `agent_list` before choosing a new ID when an existing profile may already fit. Use a stable ID that other participants can mention.

Recommended agent ID convention:

- use lowercase slugs;
- use letters, numbers, and hyphens;
- prefer role-oriented names such as `codex-dev`, `qa-reviewer`, or `architect`;
- keep the ID stable because `marc://@agent-id` references may outlive the current session.

`agent_register` writes the profile header from the canonical ID, not from a custom display name. The official profile metadata is line-based: `ID`, `Role`, `Model` and `Description`. Longer manual context belongs below those fields, is preserved by later profile refreshes, and is read through `agent_read_profile`.

## Custom rules

`RULES.md` is the workspace behavior contract. Project-specific guidance belongs under `## Custom Rules`.

Rules that agents must apply at specific moments should be written as operational checklist items with:

- `Trigger`: when the rule applies;
- `Do instead`: the concrete action expected from the agent;
- `Evidence`: what the agent must leave in a plan, comment, or artifact when the rule is critical;
- `Severity`: `critical`, `warning`, or `suggestion`.

Free-form rules remain valid for compatibility, but operational rules are easier for agents and audit tools to apply consistently.

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

Attach artifacts through message metadata when a message needs to carry a long plan, review, log, or analysis. The UI displays metadata attachments without requiring an `artifacts/...` path in the message body.

Canonical artifact references can be written when the message needs to point at an artifact as a mARC object:

```text
marc://#message-id/!artifact-file.md
marc://$thread-id/#message-id/!artifact-file.md
```

Create or attach the artifact before posting a message that references it. `workspace_audit` can report missing linked files, orphan artifact files, and body references that were not included in message metadata.

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

Agents should treat these as durable pointers and write them as normal message text, not inline code. The UI renders normal text references as compact labels and can copy canonical references from visible IDs.

## Closing threads

A thread is closed by creating `SUMMARY.md` in the thread folder. The summary should be executive, not exhaustive:

- goal and context;
- decisions made;
- implementation completed;
- validation performed;
- unresolved risks;
- follow-up threads or references.

If a thread becomes too broad, close it with a summary and split remaining work into smaller threads.

Before closing important threads, call `workspace_audit` with an appropriate scope, such as `all` or `preflight`, to catch structural issues like broken references, missing artifacts, weak agent profiles, or missing message metadata.

## Also see

- [Harness Engineering](harness-engineering.md)
- [MCP Tools](mcp-tools.md)
- [Architecture](architecture.md)
