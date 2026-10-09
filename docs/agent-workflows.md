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

mARC also installs a managed local skill at `.agents/skills/marc-ops/SKILL.md`. The skill works with `RULES.md`; it does not replace it. Its frontmatter declares that it activates every session in the workspace, requires use when a session starts and after every compaction, and requires loading for development only when the skill is not already active in the session. Its `when_to_use` field covers planning, editing, posting, validation, and closure work. Its purpose is to make agents apply bootstrap, `Custom Rules`, artifact linking, `marc://` references, and audit checkpoints at the moments where mistakes are costly.

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

This section describes general mARC profile management. The repository's delegated-work loop defines a workspace-local exception under [Persistent profiles and runtime subagents](#persistent-profiles-and-runtime-subagents).

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
6. Keep the thread open until the human explicitly authorizes closure, including after technical approval.

Use `thread_read_since` for later updates instead of rereading the full transcript.

## Development loop for delegated work

This is the repository's collaboration procedure for principals and delegated developers. It documents human-directed work and does not imply that mARC routes agents, creates workers, or applies these rules automatically in consumer workspaces.

### Roles and configuration

The principal owns the goal, acceptance criteria, dispatch, integration, and final review. The developer implements the bounded, authorized task and reports evidence. Developers do not dispatch or spawn other developers.

Choose model capability and reasoning effort separately. The principal must use a high-capability model with reasoning minimum medium and recommended high. The developer must use a more economical model capable of the bounded task with reasoning minimum high and recommended xhigh. Sol and Opus are examples of principal model families, and Luna and Haiku are examples of developer model families. These are family examples, not model versions or an availability whitelist. Model names, capabilities, supported effort levels, and how clients select or verify them vary. Increasing reasoning does not make a lower-capability model equivalent to a higher-capability one.

Supported reasoning labels, fallback behavior, and inheritance vary by client, model, or version. Do not invent configuration fields or map settings or behavior across clients automatically. Record the selected model, its fit for the role, reasoning requested and effective when established, the confirmation source, and client constraints. A user-reported principal setting is human-confirmed information, not runtime introspection. A spawn selection confirms the worker configuration requested but does not prove the effective setting unless a human or the client explicitly confirms it. Optional client-specific references are [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) and [Claude model configuration](https://code.claude.com/docs/en/model-config). Consult them only when a client-specific question needs checking. They do not define shared configuration, require project JSON, or authorize vendor-specific scripts or hooks.

Use a known, valid, confirmed configuration without asking the same question again. Human confirmation is a valid source when client introspection is unavailable, and must be recorded as human-confirmed rather than as runtime observation. When xhigh is unavailable and high is confirmed as effective, high meets the developer minimum and must be reported as high. Ask the human before implementation if model selection, model fit for the role, effective reasoning, or an equivalent mapping cannot be established or is below minimum. Reconfiguring the principal may require human action. Do not silently lower effort or substitute a model, and do not configure the principal through project files or vendor-specific scripts.

### Persistent profiles and runtime subagents

This workspace keeps exactly three persistent profiles: `codex-software-architect`, `codex-dev`, and `ui-user`. Only the principal administers this catalog. All Codex developer subagents reuse `codex-dev`. Spawned workers are ephemeral runtime instances and do not receive task-specific profiles or IDs. Subagents implement only after independent `OK_BOOTSTRAP` and explicit authorization, return evidence to the principal, and do not register or update profiles or post task messages. The principal records delegated deliveries in mARC as `codex-software-architect` and attributes execution to `codex-dev` in task evidence. This workspace-local policy does not constrain other mARC users' model or tool choices or change the managed product contract.

A persistent role profile does not fix every runtime subagent's model or reasoning effort. Record task-specific model selection and requested/effective reasoning separately in each handoff or evidence, with the confirmation source when established. Do not create profiles for configuration variations. All Codex developer subagents reuse `codex-dev`.

### Concurrency and dispatch

The default ceiling is two active developers only when there is no explicit human-confirmed override. A ceiling is a maximum, not a target or minimum, so the principal may use fewer developers or work sequentially when task dependencies or scope call for it. An override may set a different ceiling, higher or lower than two, within client limits. Record the override and do not silently change the agreed ceiling. Respect client limits. If an explicit override conflicts with a client limit or leaves the effective ceiling unclear, ask the human before dispatch. This workspace's current trial remains sequential with one developer at a time until the human changes it. Parallelize only independent tasks with separate write scopes and explicit principal dispatch. A developer pending approval occupies a slot. Do not end a developer merely because it appears idle. The principal checks for pending approval and verifies developer state before ending an assignment.

### Prepare a complete task brief

Before dispatch, make each task atomic, clear, self-contained, and complete. Include the context needed to act, inputs and sources, goal and non-goals, exact authorized paths and exclusions, expected output, acceptance criteria, required validation, dependencies, blocker conditions, and the expected report. Resolve open design choices before dispatch instead of asking the developer to decide what should be built.

Use this handoff template:

```md
Goal:
Context and sources:
Non-goals:
Authorized write paths:
Exclusions:
Expected output:
Acceptance criteria:
Required validation:
Dependencies:
Blocker conditions:
Expected report:
```

### Bootstrap and authorization

Every developer independently bootstraps the intended workspace, reads the applicable rules and task sources, and returns `OK_BOOTSTRAP` before editing. The acknowledgement states workspace identity and path, sources read, critical-rules checklist, requested and effective model and reasoning when verifiable, configuration confirmation source, planned write scope, and existing target status.

The principal verifies the workspace, sources, configuration, and scope, then explicitly authorizes edits. The developer waits for that authorization. If the workspace, configuration, acceptance criteria, or scope cannot be verified, report the blocker and do not expand the assignment.

Use this acknowledgement template:

```md
OK_BOOTSTRAP
Workspace identity and path:
Sources read:
Critical-rules checklist:
Model and reasoning requested:
Model and reasoning effective, if verified:
Configuration confirmation source:
Planned write scope:
Existing target status:
```

### Implementation and reporting

After authorization, edit only the approved paths, preserve existing user work, and run the checks required by the brief and applicable project rules. Report blockers or necessary scope changes to the principal before expanding the work. Do not silently substitute tools, model settings, or implementation scope.

Use this completion report template:

```md
Changed paths and line references:
Summary:
Checks run and results:
Documentation status:
Remaining risks or blockers:
Deviations from the brief:
```

### Independent review and human acceptance

The principal reviews the entire task thread and accumulated implementation, then independently checks acceptance criteria, behavior, architecture, maintainability, applicable rules, validation evidence, and documentation. Return concrete findings to the same developer and repeat review until the work meets the requirements. Absence of critical findings alone is not technical approval.

Workspace audits check structural integrity, references, and message metadata. They do not replace the principal's technical review. Use the audit scope that matches the checkpoint, including preflight before implementation from a plan and messages before completion or closure summaries after metadata is in place. Use `scope: all` only when the human requests a broad audit or thread state is uncertain.

After technical approval, present the integrated result for human review and address requested changes. Technical approval is not user acceptance. Do not create `SUMMARY.md` or close the task thread unless the human explicitly authorizes closure. Progress and review summaries remain valid report content.

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

A `SUMMARY.md` in the thread folder should be executive, not exhaustive:

- goal and context;
- decisions made;
- implementation completed;
- validation performed;
- unresolved risks;
- follow-up threads or references.

Create the summary and close the thread only after the human explicitly authorizes closure. Implementation completion and technical approval are not closure authorization. If a thread becomes too broad, propose splitting the remaining work and wait for human direction before closing it.

Before a completion or closure summary, call `workspace_audit` with `scope: messages` after its message metadata is in place. Use other scopes for their matching structural checks and use `scope: all` only when the human requests a broad audit or thread state is uncertain. An audit does not replace technical review.

## Also see

- [Harness Engineering](harness-engineering.md)
- [MCP Tools](mcp-tools.md)
- [Architecture](architecture.md)
- [Agent Guide](../AGENTS.md)
