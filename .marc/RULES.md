# mARC Rules

## Workspace Maintenance

- Run `workspace_update_recommendations` before starting work on a thread.

## Agents

- Agents should register through `agent_register` before posting.
- Use `agent_list` to discover registered agents.
- Check bootstrap or `agent_list` before choosing a new agent ID when an existing profile may already fit.
- Use `agent_read_profile` to inspect a specific agent profile.

## Conversation Rules

- Keep messages useful, readable, and complete; use artifact metadata when relevant.
- Prefer creating a new thread for a new task.

## Message Style

- Keep messages useful, readable, and complete.
- Use bullets or short labeled sections when a message has multiple points.
- Do not remove important context just to make a message shorter.
- Avoid dense paragraphs; split scope, decisions, validation, risks, and next steps when relevant.
- Use artifact metadata for long plans, logs, reviews, or detailed analysis.
- Mention what changed, what matters, validation performed, and any blocker.

## Context Reading

- Store `lastMessageId` returned by `thread_read`, `thread_tail`, or `thread_info` when continuing a thread.
- Prefer `thread_read_since` with the stored cursor when checking for new messages.
- If the user provides a specific mARC source, read that source before broad workspace investigation.
- If `thread_read_since` returns `shouldReadFullThread: true`, tell the user the incremental cursor failed and call `thread_read`.
- Avoid repeating bootstrap as a ritual before each mARC action; reuse the current workspace contract while it remains known.

## Operational Custom Rules

- Write critical project-specific rules as operational checklist items under `Custom Rules`.
- Prefer `Trigger`, `Do instead`, `Evidence`, and `Severity` fields when a rule must guide agent behavior at a specific moment.
- Use `Trigger` to state when the rule applies.
- Use `Do instead` to state the concrete action expected from the agent.
- Use `Evidence` to state what the agent must leave in a plan, comment, or artifact when the rule is critical.
- Use `Severity` with `critical`, `warning`, or `suggestion`.

## Custom Rules

<!-- Keep project-specific custom rules below this line. This section is preserved by workspace_update_recommendations. -->
<!-- Prefer ### or deeper headings to organize project-specific rules in this section. -->

### Architecture Rules

1. **Preserve Markdown as source of truth**
   - Trigger: changing storage, cache, indexing, daemon, UI, thread, message, artifact, summary, or workspace persistence behavior.
   - Do instead: keep Markdown files as the authoritative state and treat caches, indexes, daemon state, and UI projections as rebuildable derivatives.
   - Evidence: state how the change preserves Markdown as source of truth when the change touches persistence or projections.
   - Severity: critical

### Language Rules

1. **Keep project code and product text in en-US**
   - Trigger: writing or modifying code, tests, technical contracts, schemas, tool descriptions, product UI text, README, docs, ADRs, templates, managed recommendations, or project-owned examples.
   - Do instead: write project-owned technical and product content in en-US.
   - Evidence: keep new or changed project-owned content in en-US, unless the content is user-authored workspace communication.
   - Severity: critical

2. **Use pt-BR for user and mARC communication**
   - Trigger: writing chat responses, mARC thread messages, operational plans, status comments, review notes, summaries, or other communication directed to the user or recorded as workspace conversation.
   - Do instead: write communication in pt-BR.
   - Evidence: keep conversational mARC content and direct user-facing agent replies in pt-BR.
   - Severity: critical

### Agent Tooling

1. **Use context-mode for repo work**
   - Trigger: repository investigation, validation, or command output review in this workspace.
   - Do instead: use context-mode to inspect files, search project content, and review command output before relying on conclusions.
   - Evidence: mention the context-mode inspection or validation source when reporting findings, plans, or completion.
   - Severity: critical

2. **Assume Bash for workspace commands**
   - Trigger: choosing shell syntax or writing commands for this workspace.
   - Do instead: assume Bash unless the user explicitly states another shell for the current task.
   - Evidence: use Bash-compatible command examples or note the user-provided shell override.
   - Severity: warning

### Session Onboarding

1. **Read project docs during onboarding**
   - Trigger: onboarding into `@notfounnd/marc-server`.
   - Do instead: read `README.md` and the `docs/` directory to understand the current project state.
   - Evidence: cite the project areas or documents reviewed in the onboarding overview.
   - Severity: critical

2. **Complete onboarding before proposing changes**
   - Trigger: after onboarding and before proposing or making changes.
   - Do instead: present a structured overview of project understanding in chat and wait for the user's next instructions, unless the user explicitly asks for a different flow.
   - Evidence: provide the overview in chat before the first proposal or change.
   - Severity: critical

### Project References

1. **Use mARC reference format**
   - Trigger: writing messages that reference mARC project assets such as agents, threads, messages, or artifacts.
   - Do instead: write mARC references as raw normal message text so the mARC UI can parse them automatically.
   - Evidence: include each concrete marc:// reference without inline code formatting.
   - Severity: critical

### Message Formatting

1. **Apply the shared format before publishing**
   - Trigger: any author prepares a mARC workspace message, regardless of role, model, or client.
   - Do instead: follow the [shared message format](../docs/agent-workflows.md#shared-message-format). Use a concise paragraph for one subject and real paragraph breaks, flat bullets, or short sections for multiple subjects. Separate result or decision, validation, and pending work when applicable instead of compressing them into a dense block. Keep meaningful context and state limits accurately. Put hashes, full logs, fingerprints, line-ending diagnostics, and intermediate details in an attached report unless they explain a material decision or risk. Before posting, the author checks that a reader can quickly identify the result, supporting validation, and next step. This is not a fixed template, principal pre-approval, a tool gate, or a reason to post extra messages or maintain a diary.
   - Evidence: the published message demonstrates the appropriate structure and verified results. No separate checklist comment or artifact is required to prove the formatting check.
   - Severity: critical

### Flow Rules

1. **Review docs before final development completion**
   - Trigger: before finalizing development work.
   - Do instead: review project documentation and update or expand it when a need is identified.
   - Evidence: state whether documentation was updated or why no documentation change was needed.
   - Severity: warning

2. **Check UI Playwright backlog before closing UI threads**
   - Trigger: user asks to close a UI implementation thread.
   - Do instead: review `marc://$oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a` and update its Playwright backlog when needed.
   - Evidence: mention the backlog check and any update made before thread closure.
   - Severity: warning

3. **Run the project validation flow before completion**
   - Trigger: before reporting code, tooling, test, build, lint, formatting, or documentation changes as complete.
   - Do instead: run `pnpm validate`, `pnpm build`, and `pnpm test`, unless the user explicitly narrows the validation scope.
   - Evidence: report which commands were executed and whether each passed.
   - Severity: critical

### Code Style

1. **Never use else branches**
   - Trigger: writing or modifying project code.
   - Do instead: never use `else` branches in project code.
   - Evidence: keep control flow flat in the edited code and mention this check when the change touches branching logic.
   - Severity: critical

2. **Do not nest if blocks**
   - Trigger: writing or modifying conditionals in project code.
   - Do instead: keep conditionals flat and do not use nested `if` blocks.
   - Evidence: keep guard clauses flat in the edited code and mention this check when the change touches conditional logic.
   - Severity: critical

3. **Use early returns for guards**
   - Trigger: writing defensive programming, guard clauses, validation, or short-circuit handling.
   - Do instead: use early returns as the required pattern.
   - Evidence: show guards as early returns in the edited code or state that no guard logic was changed.
   - Severity: critical

4. **Use strategy for behavior variation**
   - Trigger: behavior branches by action, type, or equivalent variants.
   - Do instead: use Strategy pattern or dispatch tables as the required pattern.
   - Evidence: use a strategy or dispatch table in the edited code, or state why the change only required a simple guard.
   - Severity: critical

5. **Keep simple guards simple**
   - Trigger: a conditional only protects a simple precondition or invalid state.
   - Do instead: keep the guard as an early return.
   - Evidence: avoid introducing Strategy pattern for a simple guard.
   - Severity: warning

### Development Loop

See [Development loop for delegated work](../docs/agent-workflows.md#development-loop-for-delegated-work) for the full procedure and templates.

1. **Prepare complete bounded handoffs**
   - Trigger: before dispatching a developer.
   - Do instead: provide an atomic, self-contained brief with necessary context and sources, goal and non-goals, exact authorized paths and exclusions, expected output, acceptance criteria, required validation, dependencies, blocker conditions, and expected report. For development tracked in a thread, require both a detailed internal report and the developer's own consolidated thread delivery. Do not waive that publication or reserve it for the principal through a handoff; only an explicit human instruction can exempt the stated scope. Resolve open decisions before dispatch.
   - Evidence: include the complete brief in the task source before the developer starts.
   - Severity: critical

2. **Confirm model capability and reasoning separately**
   - Trigger: selecting or confirming a principal or developer configuration before dispatch or implementation.
   - Do instead: assess model capability against the principal's requirements for architectural analysis, planning and orchestration, and independent review, and against the developer's requirements to implement and validate the bounded task with quality. Prefer an economical developer model only when it meets the task's capability and quality requirements. Assess model capability separately from reasoning controls and do not assume a universal quantitative capability scale. Keep project-reference reasoning minimum medium and recommended high for the principal, and minimum high and recommended xhigh for the developer. Treat these labels as conceptual project guidance, not universal reasoning controls or API values. Map differently named reasoning controls only when the human or client documentation confirms the equivalence. Higher reasoning does not compensate for insufficient model capability. Accept explicit human confirmation when client introspection is unavailable. Reuse a known valid confirmed configuration without asking the same question again. Ask the human before implementation if model selection or role fit cannot be established or fails the role requirements, or if effective reasoning or its equivalence to the project minimum is unknown, unverified, or below minimum. Reconfiguring the principal may require human action.
   - Evidence: record the selected model, role fit, requested and effective reasoning when established, confirmation source, and relevant client limits. Do not invent configuration fields, silently lower reasoning, or configure the principal through project files or scripts.
   - Severity: critical

3. **Respect concurrency limits and overrides**
   - Trigger: planning or dispatching one or more developers.
   - Do instead: set a default ceiling of two active developers only when no explicit human-confirmed override exists. Treat the ceiling as a maximum, not a target or minimum, and use fewer developers or sequential work when dependencies or scope call for it. Allow a recorded override to set another ceiling within client capacity, whether higher or lower than two. Respect client limits and ask the human before dispatch if an explicit override conflicts with a client limit or leaves the effective ceiling unclear. Do not silently change the agreed ceiling. Preserve this workspace's current sequential one-developer trial until the human changes it. Parallelize only independent tasks with separate write scopes. Count pending approvals as active and do not end an apparently idle developer without checking its state.
   - Evidence: state the active limit and sequential or parallel mode in the handoff, including the source of any override.
   - Severity: critical

4. **Require independent bootstrap and explicit authorization**
   - Trigger: before a delegated developer edits files.
   - Do instead: have the developer bootstrap the intended workspace independently and return `OK_BOOTSTRAP` with workspace identity, sources, critical rules, model and reasoning configuration with confirmation source, write scope, and existing target status. The principal verifies the acknowledgement and communicates explicit authorization through the agent-to-agent channel before edits. Keep these transitions internal, without a thread comment or activity-document update for each one.
   - Evidence: consolidate the minimum required verified bootstrap and authorization evidence at task delivery or final integrated review. Do not maintain a running record of internal exchanges.
   - Severity: critical

5. **Review iteratively and require evidence**
   - Trigger: when a developer reports a task complete, a review finds deficiencies, or all authorized work and corrections have been integrated.
   - Do instead: require changed paths and line references, summary, checks and results, documentation status, and risks or blockers. Conduct review iterations and corrections through the agent-to-agent channel without updating documents for each finding, check, authorization, or adjustment. After the last authorized change is integrated and before presenting the development as complete or technically approved, the principal independently reviews the entire authorized integrated state: acceptance criteria, behavior and integration, architecture and maintainability, applicable rules, actual validation evidence and limits, documentation, scope, and risks. Perform this review from the harness instructions without waiting for a human prompt. Return findings to the same developer; after corrections, reassess the integrated state and repeat affected checks. Consolidate the verified evidence and verdict at delivery or final review. Any implementation change after approval invalidates that verdict for the new state.
   - Evidence: keep a substantive final-review section in the consolidated activity artifact linking criteria to the integrated implementation and evidence verified by the principal, with findings, limitations, and an explicit approved, pending, or rejected verdict and reasons. A checklist, executor report, loop count, lack of critical findings, passing tests, or clean structural audit does not substitute for the review. This is an instruction, not a message, tool, UI, or hook gate.
   - Severity: critical

6. **Separate technical approval from user acceptance and closure**
   - Trigger: after technical review or before a completion or closure summary.
   - Do instead: grant technical approval only after the principal's final integrated review verdict is approved. Then present the integrated result for human review and address requested changes. Keep human acceptance and explicit thread-closure authorization separate from technical approval. Keep the thread open until the human explicitly authorizes closure. Use `workspace_audit` as a structural check with the matching scope rather than as technical review. Use `scope: all` only for a human-requested broad audit or uncertain thread state.
   - Evidence: record the principal's final-review verdict and evidence separately from the human's acceptance and closure authorization. State the structural audit scope when closure is authorized.
   - Severity: critical

7. **Reuse persistent role profiles for runtime subagents**
   - Trigger: before assigning a role profile, administering the profile catalog, or publishing a delegated delivery.
   - Do instead: treat persistent profiles as role profiles, not spawned runtime identities. The principal resolves its own profile and an appropriate shared developer profile from the current inventory, stated responsibilities, and mappings confirmed by the human. Do not impose a fixed profile count, closed ID list, or tool prefix. If a role profile is absent or ambiguous, ask the human to confirm the mapping before administration or publication. Only the principal administers profiles through official mARC MCP tools. Developers with the same role reuse the assigned shared profile and must publish their own consolidated delivery for completed delegated development tracked in the authorized thread through official mARC tools, unless the human explicitly exempts that scope. They may also publish other relevant contributions; they do not create, update, or register profiles per spawn, or dispatch other developers. The principal publishes its own decisions, reviews, and integrated assessment; it need not pre-approve each relevant developer message and must not publish the developer's delivery as its own. Identify the shared executing profile and runtime identity in task evidence when needed. Record profile and configuration choices as activity evidence. Do not automatically rename or delete profiles, or rewrite profile history, as a side effect of assignment or spawn. Explicit catalog maintenance, including profile renames, deletions, or history edits, requires human authorization.
   - Evidence: record the selected profiles, role fit, mapping confirmation source when needed, and runtime identity when relevant. Keep activity-specific IDs out of this general rule and do not create task-specific profiles for configuration variations.
   - Severity: critical

8. **Keep loop records bounded and avoid execution diaries**
   - Trigger: coordinating delegated work or deciding whether to publish a thread message.
   - Do instead: keep bootstrap acknowledgements, authorization transitions, routine commands and statuses, tool confirmations, clean audits, and review adjustments in the agent-to-agent channel. Neither thread messages nor artifacts are execution diaries. Record handoffs or handovers only at task assignment or an actual transfer of responsibility, not at each iteration. Do not edit activity or review documents after each discovery, check, or correction. Consolidate necessary evidence at task delivery and final integrated review. During execution, update a plan or contract only when a material decision actually changes it. Every author filters for substantive decisions, material discoveries, blockers, risks, significant results, and deliveries; do not automatically mirror internal coordination.
   - Evidence: use bounded handoff or handover records when needed and consolidated delivery or final-review evidence. Do not require an entry, comment, or artifact update per iteration. Publish material decisions and results when useful; do not suppress a message when an operational event changes scope, risk, or requires a decision.
   - Severity: critical

9. **Require the developer's authored task delivery**
   - Trigger: a delegated development task tracked in a thread reaches its actual handover after the authorized scope and required checks are complete, or the principal reviews that delivery.
   - Do instead: have the developer publish its own consolidated delivery through official mARC tools under the assigned shared profile, following the shared message format without principal pre-approval of each message. State scope, changes, verified checks and results, risks or blockers, and pending principal review. Return the message ID in the detailed internal report, or identify the actual publication blocker or explicit human exception and its scope. Missing MCP access or an absent or ambiguous profile requires a blocker report, not a fabricated post, new profile, or silent substitution by an internal report. The principal verifies authorship and consistency with the work and evidence; if publication is missing without a human exception, ask the developer to publish or resolve the blocker rather than ghostwriting its delivery. Preserve independent technical review and do not introduce a tool, UI, or hook gate. Review iterations, commands, corrections, and repeated checks do not require another post or artifact update; publish again only for a new genuine delivery or material information useful to the thread.
   - Evidence: the authored consolidated delivery and its message ID in the internal report, or the actual publication blocker or explicit human exception. Include the principal's verification in consolidated delivery or final-review evidence, not a separate operational comment or running diary.
   - Severity: critical
