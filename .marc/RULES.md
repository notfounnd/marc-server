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
   - Do instead: run `pnpm run validate`, `pnpm test`, and `pnpm build`, unless the user explicitly narrows the validation scope.
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
