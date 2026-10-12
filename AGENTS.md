# Agent Guide

This file is the project-local entrypoint for agent work in the mARC repository, a local coordination layer for coding agents. It is guidance, not runtime configuration. Do not assume every client loads it automatically or that it configures model selection, permissions, or tool availability. The principal must ensure delegated developers receive applicable instructions. This policy is for this repository and is not a default template for all mARC users.

## Authority and Sources

- Treat [`.marc/RULES.md`](.marc/RULES.md) as the canonical workspace behavior contract, including its `Custom Rules`. Follow it. Do not move canonical rules here or create a competing source. Keep full details in `RULES.md` and use concise operational summaries and links in this entrypoint.
- [`.marc/INSTRUCTIONS.md`](.marc/INSTRUCTIONS.md) is managed bootstrap guidance. Read it when onboarding, but do not edit it.
- Load and follow the local [`marc-ops` skill](.agents/skills/marc-ops/SKILL.md) for mARC bootstrap, thread context, references, artifacts, and audit checkpoints.
- Read the [README](README.md) for project purpose and setup. Consult [Agent Workflows](docs/agent-workflows.md) for the project-specific delegation loop and [Harness Engineering](docs/harness-engineering.md) for the broader documented context.
- Use the [ADR index](docs/adrs/README.md) and applicable decisions: [Markdown source of truth](docs/adrs/0001-markdown-source-of-truth.md), [bootstrap gates](docs/adrs/0003-bootstrap-gates-workspace-tools.md), [no automatic agent routing](docs/adrs/0004-no-automatic-agent-routing.md), [managed rules boundary](docs/adrs/0007-rules-managed-baseline-and-custom-rules.md), and [localization boundary](docs/adrs/0008-ui-only-localization-boundary.md).

For thread records, `CHAT.md` messages, `SUMMARY.md` files, and attached artifact files are authoritative Markdown records. Indexes, caches, and UI/API projections of those records are derived state. Preserve existing formats for other workspace data, including JSON settings. Do not infer that all files under `.marc/` should be Markdown.

## Session Start and Recovery

- At each new session and after every compaction, re-read the `marc-ops` skill and call `workspace_bootstrap` before other gated mARC tools. Re-read the skill after compaction even if it still appears in the skill inventory. After reconnect, MCP restart, tool error, or context loss, restore the skill and bootstrap only if the contract was lost, invalidated, or is uncertain.
- `workspace_bootstrap` establishes the workspace and returns the complete current contract for all work, not only development. Verify its workspace identity and path match the intended repository before acting. Read the complete returned `INSTRUCTIONS.md` and `RULES.md`, including `Custom Rules`.
- If development is requested in an active session where the skill has not yet been loaded, load it and establish bootstrap context before acting. After successful bootstrap, pass `bootstrapConfirmed: true` to gated mARC tools.
- Reuse a known bootstrap contract while it remains current. Do not repeat bootstrap before every tool call or as a ritual.
- Read the README and relevant project docs, ADRs, task plan, and mARC thread context before proposing or changing behavior. Read only the referenced thread artifacts needed for the task.
- Every delegated developer bootstraps independently and reads the applicable sources. The principal's bootstrap does not substitute for the developer's own `OK_BOOTSTRAP`.
- After compaction, recover the actual last state from the thread and available evidence, then continue at the first unfinished step. Do not redo completed work or send stale, speculative status as if it were current.

## mARC Threads and Records

- When the user provides a specific mARC source, read that source before broad workspace investigation.
- When continuing a thread, store `lastMessageId` as the consumed cursor only after reading and processing that message's content. `thread_info` metadata does not advance the cursor, and `thread_tail` covers only its returned window. Use `thread_read_since` for later updates; if no valid cursor is available or `shouldReadFullThread` is true, use `thread_read`.
- Before proposing or changing behavior that may depend on historical decisions, call `memory_recall`. If it returns a strong match, read the referenced thread before reopening or contradicting that decision.
- For work tracked in a thread, prepare and attach the detailed plan as an artifact before development begins. Keep the plan readable, include a concise summary and pending questions, and do not sacrifice grammar for brevity.
- Keep loop coordination in the agent-to-agent channel. Neither thread messages nor artifacts are execution diaries. Do not post or update documents for each handshake, authorization, command, status, clean audit, finding, or correction. A concise handoff or handover message or document is appropriate at task assignment or a real transfer of responsibility, not for every iteration. Consolidate necessary evidence at task delivery and final integrated review. Publish material decisions, discoveries, blockers, risks, and results when they change understanding or require a decision; do not mirror internal coordination.
- The principal checks the profile inventory and resolves role mappings. Only the principal administers the profile catalog. Developers reuse the assigned shared profile and must publish their own consolidated delivery for completed delegated development tasks tracked in the authorized thread through official mARC tools, unless the human explicitly exempts that scope. They may also publish other relevant contributions; they do not create or update profiles, register per spawn, or dispatch other developers. The principal need not pre-approve each relevant developer message and must not publish the developer's delivery as its own.
- Attach artifact files through message metadata before referring to them in a message. Use actual newline characters in message bodies, not the literal backslash-n sequence. Write marc:// references as ordinary raw message text, never as inline code.
- For messages, artifacts, and thread summaries, follow the [shared Markdown composition guidance](docs/agent-workflows.md#shared-message-format) and [Message Formatting Custom Rule](.marc/RULES.md#message-formatting).
- Run `workspace_update_recommendations` before starting work on a thread, as required by `RULES.md`. A refresh does not establish or restore bootstrap context; use `workspace_bootstrap` at session start or when context is missing, stale, or uncertain. Run `workspace_audit` at meaningful completed checkpoints, not as a repeated ritual. Use `scope: preflight` before implementation from a plan. For artifact and reference checks, first create the relevant files, metadata, and references, then audit the applicable scope. Run `scope: messages` before completion or closure summaries after message metadata is in place. Use `scope: all` only for a user-requested broad audit or uncertain thread state.
- Treat `workspace_audit` as a structural check for records, references, and metadata, not as a substitute for the principal's technical quality review. Follow the complete `RULES.md` and `marc-ops` skill for exact applicability without duplicating them here.

## Collaboration Protocol

### Roles and Dispatch

- The principal is the architect and orchestrator. The principal defines scope and acceptance, directly dispatches the developer, reviews the whole task and integrated result, and grants technical approval.
- The delegated developer performs the authorized implementation and reports evidence to the principal. Developers do not dispatch or spawn further agents. mARC is agnostic about task routing. Mentions and marc:// references identify agents or objects but do not assign or route work.
- Persistent profiles represent roles, not spawned instances. The principal resolves its own profile and an appropriate shared developer profile from the current inventory, stated responsibilities, and mappings confirmed by the human. Do not impose a fixed ID list, count, or tool prefix. If a profile is absent or ambiguous, ask the human to confirm the mapping before administration or publication.
- The principal records its own decisions, reviews, and integrated assessment under its selected profile. Identify the shared executing profile and runtime identity in task evidence when needed; do not attribute a developer's report to the principal by retransmitting it. Developers with the same role reuse an appropriate shared profile. Current profile and configuration choices are activity evidence. Do not automatically rename or delete profiles, or rewrite profile history, as a side effect of role assignment or runtime spawn. Catalog or history maintenance requires explicit human authorization.
- Assess model capability against role outcomes separately from reasoning controls. The principal's model must support architectural analysis, planning and orchestration, and independent review. The developer's model must be capable of implementing and validating the bounded task to its required quality. Prefer an economical developer model when it meets those capability and quality requirements. Keep project-reference reasoning minimum medium and recommended high for the principal, and minimum high and recommended xhigh for the developer. These labels are conceptual guidance, not universal model controls or API values. Map differently named reasoning controls only when the human or client documentation confirms the equivalence. Higher reasoning does not compensate for insufficient model capability. Follow [Agent Workflows](docs/agent-workflows.md) for configuration confirmation, client limits, and overrides.
- The default ceiling is two active developers only when no explicit human-confirmed override exists. It is a maximum, not a required number or floor, so use fewer developers or sequential work when dependencies or scope call for it. Overrides may set a higher or lower ceiling within client capacity and must be recorded. Ask the human before dispatch if an explicit override conflicts with a client limit or leaves the effective ceiling unclear. Do not silently change the agreed ceiling. This workspace's current trial remains sequential with one developer at a time until the human changes it. Parallelize only independent tasks with separate write scopes and explicit principal dispatch. Pending approvals count as active.
- Ask the human before implementation if model selection or role fit cannot be established or fails the role requirements, or if effective reasoning or its equivalence to the role minimum is unknown, unverified, or below minimum. Human confirmation can establish the effective configuration when client introspection is unavailable. Reuse a known valid confirmed configuration without repeating the question. If required delegation tooling is unavailable, report the blocker and wait for human direction. Do not silently substitute a model, tool, or inline implementation.

### Bounded Handoff

Each task must be atomic and bounded. The principal's brief states the goal and relevant context, exact authorized paths and exclusions, source documents/thread messages/plans to read, acceptance criteria, required checks, and expected evidence.

For development tracked in a thread, specify two complementary deliverables: a detailed internal report to the principal and the developer's own consolidated thread delivery. A principal's handoff cannot waive the authored delivery or reserve all publication for the principal. Only an explicit human instruction can exempt the stated scope.

Before any edit, the developer independently bootstraps, reads the applicable rules and task sources, and returns `OK_BOOTSTRAP` with workspace identity, sources read, critical-rules checklist, requested and effective model and reasoning when verifiable, configuration confirmation source, planned write scope, and existing target status. The principal verifies the acknowledgement and communicates explicit authorization through the agent-to-agent channel. The developer waits for that authorization before editing. Keep these transitions internal; summarize the minimum required verification and authorization evidence at task delivery or final review, without updating an activity document during each transition. Raise ambiguity or a scope conflict before expanding the change.

### Implementation, Review, and Acceptance

- Edit only the authorized scope. Preserve existing user work and unrelated changes. Do not use blanket cleanup or revert operations to make a task appear isolated.
- Return changed paths, concise line references, a summary of changes, checks actually run and their results, and any remaining risks or blockers.
- When the authorized task scope and required checks are complete and responsibility returns to the principal, publish the consolidated delivery under the assigned shared developer profile using the shared message format. Include changes, verified results, and pending principal review. Return its message ID in the internal report, or state the actual publication blocker or explicit human exception. Missing MCP access or an unresolved profile is a blocker, not permission to fabricate a post or register another profile. Review corrections and repeated checks do not require another post unless they constitute a new genuine delivery or material information.
- The principal verifies that the developer's authored delivery matches the work and evidence. If it is missing without a human exception, ask the developer to publish it or resolve its blocker; do not ghostwrite it. This check does not replace independent technical review or introduce a tool, UI, or hook gate.
- After the last authorized change is integrated, and before presenting the development as complete or technically approved, the principal independently reviews the final integrated state of all authorized work, not only the latest task or diff. Assess acceptance criteria, behavior and integration, architecture and maintainability, applicable rules, actual validation evidence, documentation, scope, and remaining risks. Start this review from the instructions without waiting for a user prompt.
- Record a substantive final-review section in the consolidated activity artifact: scope and sources reviewed, criteria linked to implementation and verified evidence, findings and limitations, and an explicit approved, pending, or rejected verdict. A checklist, executor report, loop count, absence of critical findings, passing tests, or clean structural audit is not a substitute for this assessment.
- Return final-review findings to the responsible developer and repeat the integrated review after corrections. Any later implementation change invalidates the prior verdict for the new state; reassess the integration and repeat affected checks before approval. This is a harness instruction, not a message, tool, UI, or hook gate.
- Conduct review iterations in the agent-to-agent channel. Consolidate resolved findings and verified results in the delivery or final-review report rather than editing an artifact after each finding, test, authorization, or correction. Update a plan or contract during execution only when a material decision actually changes it.
- After technical approval, present the integrated result for user review and address the user's criticism or requested corrections through the principal. Technical approval is not user acceptance.
- Do not close a task thread unless the user explicitly authorizes closure.
- Do not terminate a developer merely because it appears idle. It may be waiting for command approval in its TUI. Before ending the assignment, the principal checks for pending approval and verifies the developer's state. Developers report blockers. Never terminate solely because a developer seems stuck or is silent.

## Repository Working Rules

Follow [`.marc/RULES.md` under Custom Rules](.marc/RULES.md#custom-rules) as the canonical source for language, shell, repository inspection, Git authorization, browser validation, hooks, and manual editing restrictions. Keep this entrypoint as a concise index rather than a competing policy source.

## Validation

The project requires Node.js 22 or newer and pnpm 10.10.0, as declared in [`package.json`](package.json). Follow [validation by impact](docs/development.md#validation-by-impact) and the canonical selection policy under `Custom Rules` in [`.marc/RULES.md`](.marc/RULES.md#custom-rules).

```bash
pnpm validate
pnpm build
pnpm test
```

`pnpm validate` runs write-mode lint and formatting before checks and typechecking. Confirm its side effects fit the authorized scope, inspect affected files, preserve existing work, and report scope conflicts rather than reverting or expanding changes. Record the delivery classification, checks, results, and limits. The principal's independent integrated review remains required.
