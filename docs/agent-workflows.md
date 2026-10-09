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

For general mARC use, an agent that is expected to post may need a registered or refreshed profile. Do not apply that instruction mechanically to this repository's delegated loop: the principal resolves an existing shared profile, and a developer does not register or refresh a profile for each spawn. See [Persistent profiles and runtime subagents](#persistent-profiles-and-runtime-subagents).

When general mARC profile registration is required, use:

```text
agent_register
```

Use the bootstrap agent inventory or `agent_list` before choosing a new ID when an existing profile may already fit. Use a stable ID that other participants can mention.

Recommended agent ID convention:

- use lowercase slugs;
- use letters, numbers, and hyphens;
- prefer role-oriented IDs. For example, `shared-developer` could describe a shared developer profile, but the workspace inventory determines actual IDs and no prefix or name is required.
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

For a task thread, distinguish internal loop coordination, consolidated execution evidence, and substantive thread messages:

- Use the agent-to-agent channel for `OK_BOOTSTRAP`, explicit authorization, questions, routine status, command coordination, and review adjustments. A concise handoff or handover message is appropriate at task assignment or a real transfer of responsibility, not for each iteration.
- Consolidate necessary evidence at bounded task delivery and final integrated review, with artifacts associated through message metadata when needed. Do not maintain a live activity log or edit a document after each handshake, authorization, command, check, finding, or correction. Summarize the minimum required bootstrap and authorization evidence with the delivered results, not through continuous updates.
- Use the thread for decisions, material discoveries, meaningful blockers or risks, significant results, and deliveries that change understanding of the work. Apply this relevance filter to every author; do not mirror internal coordination into standalone comments.

1. Read the thread.
2. Store `lastMessageId`.
3. Read referenced artifacts only when they are needed for the task.
4. Keep routine handshakes and loop transitions in the agent-to-agent channel. Do not mirror them into thread messages or artifact updates.
5. Publish substantive decisions and results to the same thread under the author's assigned profile.
6. Keep the thread open until the human explicitly authorizes closure, including after technical approval.

Use `thread_read_since` for later updates instead of rereading the full transcript.

## Development loop for delegated work

This is the repository's collaboration procedure for principals and delegated developers. It documents human-directed work and does not imply that mARC routes agents, creates workers, or applies these rules automatically in consumer workspaces.

### Roles and configuration

The principal owns the goal, acceptance criteria, dispatch, integration, and final review. The developer implements the bounded, authorized task and reports evidence. Developers do not dispatch or spawn other developers.

Assess model capability against the outcomes required for each role, separately from reasoning controls. The principal's model must support architectural analysis, planning and orchestration, and independent review. A developer's model must be capable of implementing and validating the bounded task to its required quality. Prefer an economical developer model only when it meets the task's capability and quality requirements. Do not assume a universal quantitative capability scale. Keep project-reference reasoning minimum medium and recommended high for the principal, and minimum high and recommended xhigh for the developer. These are conceptual project references, not universal reasoning controls, API values, or availability requirements. Supported reasoning controls, fallback behavior, and inheritance vary by client, model, or version. Increasing reasoning does not make an otherwise unsuitable model capable of the role.

Supported reasoning controls and how clients select or verify them vary. Do not invent configuration fields or infer mappings across clients. Map a differently named reasoning control to a project-reference reasoning level only when the human or client documentation confirms the equivalence. Assess model capability against role and task requirements without mapping it to a universal scale. Record the selected model and role fit, reasoning requested and effective when established, the confirmation source, and client constraints. Human confirmation is valid when client introspection is unavailable and must be recorded as human-confirmed rather than runtime-observed. A spawn selection confirms the worker configuration requested but does not prove the effective setting unless a human or the client explicitly confirms it. These workspace guidelines do not define universal client settings or automatically configure models, hooks, tools, or behavior for mARC users.

Use a known, valid, confirmed configuration without asking the same question again. Ask the human before implementation if model selection or role fit cannot be established or fails the role requirements. Also ask if effective reasoning is unknown or unverified, its equivalence to the project minimum cannot be confirmed, or the confirmed setting is below minimum. When the recommended developer reference is unavailable, proceed only if the effective control is confirmed to meet the project minimum, and record the actual setting and confirmation source. Reconfiguring the principal may require human action. Do not silently lower reasoning, substitute an unsuitable model, or configure the principal through project files, scripts, or hooks.

### Persistent profiles and runtime subagents

Persistent profiles represent recurring roles and remain separate from spawned runtime instances. Before assignment or publication, the principal checks the current profile inventory and resolves a profile for its own role and a suitable shared profile for the developer role from their stated responsibilities. The principal asks the human to confirm any absent or ambiguous role mapping before administering profiles or publishing. Do not impose a fixed profile count, closed ID list, or tool prefix. Only the principal administers the catalog through official mARC MCP tools. Developers with the same role reuse the assigned shared profile and may publish their own relevant contributions directly in the authorized thread through official mARC tools; they do not create, update, or register profiles per spawn, and do not dispatch other developers. The principal publishes its own decisions, reviews, and integrated assessment. It need not approve each relevant developer message in advance or repost the developer's report as its own. Developers implement only after independent `OK_BOOTSTRAP` and explicit authorization, and return execution evidence to the principal. The principal identifies the shared executing profile and runtime identity in task evidence when needed. Profile and configuration choices belong to activity evidence. Do not automatically rename or delete profiles, or rewrite profile history, as a side effect of assignment or spawn. Explicit catalog maintenance, including profile renames, deletions, or history edits, requires human authorization.

Profiles describe recurring roles rather than fixing model or reasoning settings. Record task-specific configuration, requested and effective reasoning, and the confirmation source in the handoff or evidence instead of creating profiles for configuration variations. Runtime developers with the same role reuse the appropriate shared profile.

### Concurrency and dispatch

The default ceiling is two active developers only when there is no explicit human-confirmed override. A ceiling is a maximum, not a target or minimum, so the principal may use fewer developers or work sequentially when task dependencies or scope call for it. An override may set a different ceiling, higher or lower than two, within client limits. Record the override and do not silently change the agreed ceiling. Respect client limits. If an explicit override conflicts with a client limit or leaves the effective ceiling unclear, ask the human before dispatch. This workspace's current trial remains sequential with one developer at a time until the human changes it. Parallelize only independent tasks with separate write scopes and explicit principal dispatch. A developer pending approval occupies a slot. Do not end a developer merely because it appears idle. The principal checks for pending approval and verifies developer state before ending an assignment.

### Prepare a complete task brief

Before dispatch, make each task atomic, clear, self-contained, and complete. Include the context needed to act, inputs and sources, goal and non-goals, exact authorized paths and exclusions, expected output, acceptance criteria, required validation, dependencies, blocker conditions, and the expected report. Resolve open design choices before dispatch instead of asking the developer to decide what should be built.

Use this handoff template:

Record a handoff at task assignment or a handover when responsibility actually transfers. A concise thread message or document may carry that bounded record. Do not repeat it for each iteration, test, or review adjustment. Questions, authorizations, diagnostics, and corrections remain in the internal channel. A material change to the plan or contract may update that document; ordinary execution progress does not.

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

Every developer independently bootstraps the intended workspace, reads the applicable rules and task sources, and returns `OK_BOOTSTRAP` to the principal before editing. The acknowledgement states workspace identity and path, sources read, critical-rules checklist, requested and effective model and reasoning when verifiable, configuration confirmation source, planned write scope, and existing target status. It is an internal handoff, not a thread comment.

The principal verifies the workspace, sources, configuration, and scope and communicates explicit authorization through the agent-to-agent channel. The developer waits for that authorization before editing. If the workspace, configuration, acceptance criteria, or scope cannot be verified, report the blocker and do not expand the assignment. Keep the acknowledgement and authorization internal. Consolidate the minimum required verification and authorization evidence at task delivery or final review; neither transition requires a thread comment or an activity-document update.

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

This acknowledgement template is for the internal handoff, not a thread post or a live activity log. Summarize its verified control evidence once with the task delivery or final integrated review, without copying every internal exchange.

### Implementation and reporting

After authorization, edit only the approved paths, preserve existing user work, and run the checks required by the brief and applicable project rules. Return the detailed task report to the principal through the agent-to-agent channel. The developer may publish its own concise, relevant contribution in the authorized thread with the assigned shared profile, without prior approval of each message. State the task's scope, checks actually run, and remaining risks; a task report is not approval of the whole thread. Report blockers or necessary scope changes to the principal before expanding the work. Do not silently substitute tools, model settings, or implementation scope.

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

Task and iteration reviews guide corrections during development. After all planned work and the last correction are integrated, the principal must conduct an independent final review of the entire authorized, integrated development before presenting it as complete or technically approved. This review is the principal's responsibility and must begin from these instructions; do not wait for the human to ask whether it happened. Assess the approved goal and decisions, every task and correction plus their integration, relevant behavior and failure cases, architecture and maintainability, applicable rules, actual validation evidence and its limits, documentation, scope preservation, and remaining risks.

Record a substantive final-review section in the consolidated activity artifact. It must identify the integrated state and sources reviewed, relate acceptance criteria to implementation and evidence checked by the principal, cover applicable quality dimensions, distinguish direct verification from executor reports, state findings and limitations, and give an explicit `approved`, `pending`, or `rejected` verdict with reasons. A checklist, a sentence claiming review, the executor's assessment, loop count, lack of critical findings, passing tests, or a clean structural audit is not sufficient evidence or a substitute for the review.

Use a record that demonstrates the assessment rather than a blank completion checklist:

```md
Final integrated review
Integrated state and sources reviewed:
Approved goal and later decisions:
Acceptance criteria mapped to implementation and evidence checked:
<criterion> - <implementation or behavior> - <evidence verified by principal>
Integrated behavior, architecture, rules, documentation, and scope:
Checks and limits (identify direct runs and executor-reported results):
Findings, corrections, and disposition:
Residual risks or explicit human-authorized exceptions:
Verdict: approved | pending | rejected - rationale:
State changes after this review and required reassessment:
```

Return final-review findings to the responsible developer through the internal channel and continue the loop. Do not edit the review document for each finding or correction. After corrections, reassess the integrated state and consolidate the verified evidence and verdict when presenting the revised delivery. Any implementation change after approval invalidates that verdict for the new state; re-review the integration and repeat affected checks before approving. This is a harness obligation, not a message, tool, UI state, or hook gate. Technical approval follows an approved final review; it is distinct from human acceptance and thread closure.

Workspace audits check structural integrity, references, and message metadata. They do not replace the principal's technical review. Use the audit scope that matches the checkpoint, including preflight before implementation from a plan and messages before completion or closure summaries after metadata is in place. Use `scope: all` only when the human requests a broad audit or thread state is uncertain.

After technical approval, present the integrated result for human review and address requested changes. Do not wait for the human to prompt the required final review. Technical approval is not user acceptance. Do not create `SUMMARY.md` or close the task thread unless the human explicitly authorizes closure. Progress and review summaries remain valid report content.

## Posting style

Apply the relevance filter to every author. Publish a thread message when it records a decision and rationale, a discovery that changes the approach or acceptance criteria, a material scope change, a meaningful blocker or risk, a significant iteration result, or a task delivery with its scope and validation. Developers publish their own relevant contributions under the assigned shared profile; the principal publishes its own decisions and integrated assessment. Do not require principal pre-approval of each relevant developer message, automatically relay the developer's message as the principal, or copy routine user-facing progress into the thread.

Keep handshakes and ordinary loop control in the agent-to-agent channel, not in standalone thread comments or continuously edited artifacts. This includes worker creation or resumption, `OK_BOOTSTRAP`, authorization transitions, routine identity/configuration/path/hash details, command or test starts, confirmations of file or tool use, clean audits, minor edits, and every review/status transition. Neither the thread nor a document is an execution diary. Handoff and handover records are appropriate at task assignment or a real transfer of responsibility, not at every iteration. Include operational detail in a consolidated delivery or final-review report only when it explains a decision, failure, risk, or result. The filter is based on purpose and impact, not keywords.

Keep messages useful and easy to scan:

- mention what changed;
- mention why it matters;
- include validation performed;
- call out blockers or risks;
- link artifacts when the details are long.

Do not paste large logs or full plans into a message body. Attach a Markdown artifact and link it from the message. For delegated work, consolidate the necessary evidence at task delivery and final integrated review and associate it through message metadata. Do not create or update activity artifacts as a side effect of each loop iteration. During execution, update a plan or contract only when a material decision actually changes its content; do not transfer the execution diary from messages to documents.

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
