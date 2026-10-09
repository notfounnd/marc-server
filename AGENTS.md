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
- When continuing a thread, use `thread_read` to read it and store `lastMessageId`. Use `thread_read_since` with a valid cursor for later updates. If no cursor is available, use `thread_read`. If `thread_read_since` returns `shouldReadFullThread: true`, tell the user the cursor failed and call `thread_read`.
- Before proposing or changing behavior that may depend on historical decisions, call `memory_recall`. If it returns a strong match, read the referenced thread before reopening or contradicting that decision.
- For work tracked in a thread, prepare and attach the detailed plan as an artifact before development begins. Keep the plan readable, include a concise summary and pending questions, and do not sacrifice grammar for brevity.
- The principal inspects the bootstrap inventory or uses `agent_list` and administers persistent profiles through official MCP tools. Codex subagents reuse `codex-dev`, return implementation evidence to the principal, and do not register or refresh profiles or post messages. The principal uses official mARC MCP tools to post messages and attach artifacts.
- Attach artifact files through message metadata before referring to them in a message. Use actual newline characters in message bodies, not the literal backslash-n sequence. Write marc:// references as ordinary raw message text, never as inline code.
- Use `workspace_update_recommendations` before starting work on a thread, as required by `RULES.md`. Run `workspace_audit` at meaningful completed checkpoints, not as a repeated ritual. Use `scope: preflight` before implementation from a plan. For artifact and reference checks, first create the relevant files, metadata, and references, then audit the applicable scope. Run `scope: messages` before completion or closure summaries after message metadata is in place. Use `scope: all` only for a user-requested broad audit or uncertain thread state.
- Treat `workspace_audit` as a structural check for records, references, and metadata, not as a substitute for the principal's technical quality review. Follow the complete `RULES.md` and `marc-ops` skill for exact applicability without duplicating them here.

## Collaboration Protocol

### Roles and Dispatch

- The principal is the architect and orchestrator. The principal defines scope and acceptance, directly dispatches the developer, reviews the whole task and integrated result, and grants technical approval.
- The delegated developer performs the authorized implementation and reports evidence to the principal. Developers do not dispatch or spawn further agents. mARC is agnostic about task routing. Mentions and marc:// references identify agents or objects but do not assign or route work.
- This workspace's persistent profiles are limited to `codex-software-architect`, `codex-dev`, and `ui-user`. Only the principal administers this catalog. All Codex developers reuse `codex-dev`, and spawned runtime instances do not receive persistent profiles or task-specific IDs.
- The principal records delegated outcomes in mARC as `codex-software-architect` and attributes execution to `codex-dev` in task evidence. These workspace-local rules do not constrain other mARC users' model or tool choices or change the managed product contract.
- Match model capability and reasoning effort separately to the role. Principals use a high-capability model with reasoning minimum medium and recommended high. Developers use an economical model adequate for the bounded task with reasoning minimum high and recommended xhigh. Follow [Agent Workflows](docs/agent-workflows.md) for configuration confirmation, client limits, and overrides instead of treating model names or versions as a whitelist.
- The default ceiling is two active developers only when no explicit human-confirmed override exists. It is a maximum, not a required number or floor, so use fewer developers or sequential work when dependencies or scope call for it. Overrides may set a higher or lower ceiling within client capacity and must be recorded. Ask the human before dispatch if an explicit override conflicts with a client limit or leaves the effective ceiling unclear. Do not silently change the agreed ceiling. This workspace's current trial remains sequential with one developer at a time until the human changes it. Parallelize only independent tasks with separate write scopes and explicit principal dispatch. Pending approvals count as active.
- If a configuration is unknown, unmappable, or below the role's minimum, ask the human before implementation. Reuse a known valid confirmed configuration without repeating the question. If required delegation tooling is unavailable, report the blocker and wait for human direction. Do not silently substitute a model, tool, or inline implementation.

### Bounded Handoff

Each task must be atomic and bounded. The principal's brief states the goal and relevant context, exact authorized paths and exclusions, source documents/thread messages/plans to read, acceptance criteria, required checks, and expected evidence.

Before any edit, the developer independently bootstraps, reads the applicable rules and task sources, and returns `OK_BOOTSTRAP` with workspace identity, sources read, critical-rules checklist, requested and effective model and reasoning when verifiable, configuration confirmation source, planned write scope, and existing target status. The developer waits for the principal's explicit authorization before editing. Raise ambiguity or a scope conflict before expanding the change.

### Implementation, Review, and Acceptance

- Edit only the authorized scope. Preserve existing user work and unrelated changes. Do not use blanket cleanup or revert operations to make a task appear isolated.
- Return changed paths, concise line references, a summary of changes, checks actually run and their results, and any remaining risks or blockers.
- The principal reviews the entire task thread and accumulated implementation across all delegated tasks, not only the latest task or diff. Before approval, independently verify evidence and assess correctness and behavior, architecture and maintainability, requirements and applicable `RULES.md`, test coverage and validation, and documentation. Return concrete findings to the same developer for correction and repeat until technical quality is acceptable. Absence of critical findings alone is not acceptance.
- After technical approval, present the integrated result for user review and address the user's criticism or requested corrections through the principal. Technical approval is not user acceptance.
- Do not close a task thread unless the user explicitly authorizes closure.
- Do not terminate a developer merely because it appears idle. It may be waiting for command approval in its TUI. Before ending the assignment, the principal checks for pending approval and verifies the developer's state. Developers report blockers. Never terminate solely because a developer seems stuck or is silent.

## Repository Working Rules

- Keep project-owned code, schemas, technical documentation, and examples in en-US. Use pt-BR for direct user communication and mARC conversation, consistent with `RULES.md`.
- Use context-mode for repository inspection and command-output review. Use Bash for workspace commands. Do not use PowerShell.
- Do not run Git commands in this workspace unless the user explicitly authorizes them. Respect tool and command approval prompts. Do not bypass, evade, or work around a denied or pending approval.
- Use Playwright CLI for UI/browser validation. Do not use Playwright MCP.
- Do not add vendor-specific or client-specific hooks or configuration by default. Require a separate explicit user request.
- Use the native `apply_patch` tool for manual file edits rather than shell-based file writes. Keep changes within authorized paths and do not duplicate the full code-style checklist from `RULES.md`.

## Validation

The project requires Node.js 22 or newer and pnpm 10.10.0, as declared in [`package.json`](package.json). The standard validation commands are:

```bash
pnpm validate
pnpm build
pnpm test
```

Run the required checks before reporting implementation or documentation work complete unless the user explicitly narrows validation. Report commands not run and why. Review project documentation as part of completion and state whether it changed or needed no update.

`pnpm validate` is not read-only. It starts with `pnpm run code:fix`, which runs lint fixes and Prettier write mode before checks and typechecking. Confirm these side effects fit the authorized scope, inspect affected files, and preserve user work. Do not broadly revert formatter or lint output. Report scope conflicts and let the principal resolve them before proceeding.
