---
name: marc-ops
description: "Operate inside a mARC-enabled repository. Activates EVERY session in this workspace. Always active when a session starts, after every compaction, and whenever development is requested only if the skill has not already been loaded in the active session. Establish bootstrap context, read RULES.md, and apply Custom Rules, artifact metadata, marc:// references, and workspace_audit checkpoints. This process must not be ignored."
when_to_use: "Use this always-active skill at the start of every session in a mARC workspace, after every compaction, reconnecting, or context loss, and whenever development is requested only if it has not already been loaded in the active session. Use it before proposing, planning, editing, posting messages, attaching artifacts, validating, concluding, or closing mARC work."
---

# mARC Ops

Operate inside a mARC-enabled workspace with the local workspace contract in force.

This skill does not replace `RULES.md`. It turns `RULES.md`, `Custom Rules`, thread context, artifacts, and audit feedback into an execution checklist at the moments where agents commonly lose quality.

Apply it silently during normal work. Surface the checklist only when the user asked for a plan, when a critical rule requires evidence, or when you need to explain a blocker.

## Always Active

**This skill is active for every session in this mARC workspace.**

Before proposing, planning, editing, posting, validating, or closing mARC work:

1. Establish bootstrap context when it is missing, stale, or uncertain.
2. Read `RULES.md` from bootstrap context.
3. Apply relevant `Custom Rules`.
4. Use `memory_recall` before proposing or developing changes that may overlap historical thread decisions.
5. Use mARC artifact, reference, and audit discipline.

## Context of Usage

Apply this workflow in these situations. These are examples, not exact prompt matches. Equivalent or connected situations also count.

- Always when starting a session in a mARC workspace.
- Always when resuming after compaction, reconnect, rebuild, tool error, or daemon/MCP restart.
- Always when bootstrap context is missing, stale, or uncertain.
- Always when `RULES.md`, the user request, and thread state appear to conflict.
- Always when choosing how to read or continue a thread.
- Always when a specific mARC thread, message, artifact, or agent reference is the requested source.
- Always when planning a design, API, tool, or behavior change.
- Always when preparing mARC-related code or documentation edits.
- Always when preparing validation, audit, completion, or thread closure.
- Always when preparing a thread message, artifact, or `marc://` reference.

## Required Workflow

1. Establish bootstrap context at the start of a session or workspace, after context loss, or when the current workspace contract is uncertain.
2. Read `RULES.md` from the bootstrap response and treat it as the workspace contract.
3. Reuse the current workspace contract while it remains known; do not repeat bootstrap as a ritual before each mARC action.
4. Call `memory_recall` with the current development intent before proposing or changing behavior when historical decisions may be relevant.
5. If `memory_recall` returns a strong match, read the referenced thread before reopening or contradicting the historical decision.
6. Read the target thread before proposing or changing anything. Use `thread_read_since` when you have a valid cursor and fall back to `thread_read` when the cursor is missing.
7. Convert applicable `Custom Rules` into a short working checklist before proposing, developing, concluding, or closing.
8. Leave evidence when a critical rule asks for it. Evidence can be sources read, artifacts attached, validation commands, audit output, or explicit unresolved blockers.
9. Attach artifacts before referencing them in `message_post`.
10. Use canonical `marc://` references for mARC assets.
11. Use `workspace_audit` at checkpoints where quality matters instead of running it continuously.

## Working With Rules

- `RULES.md` remains the source of truth for workspace behavior.
- Treat `Trigger`, `Do instead`, `Evidence`, and `Severity` fields as executable instructions.
- For free-form custom rules, extract the concrete action and apply it as a checklist item.
- Preserve project-specific rules in `Custom Rules`. Do not move them into generated managed sections unless the user explicitly asks.
- If rules conflict, follow the more specific project rule and state the conflict in the plan or thread comment.
- If a required rule cannot be satisfied, stop at the smallest useful point and state the blocker before proceeding.

## Preflight Checklist

Before posting a plan, proposal, design, API/tool change, or completion note, check:

- Sources: the relevant README, docs, ADRs, thread context, and local rules were read when the task depends on them.
- Memory: `memory_recall` was used for development proposals or behavior changes, or the reason for skipping it is explicit.
- Scope: the proposed work maps to the thread problem and does not add unrelated compatibility, automation, or hidden behavior.
- Rules: critical `Custom Rules` have a visible action and evidence path.
- Artifacts: every artifact mentioned in a message has been attached to that message metadata.
- References: mARC assets use `marc://` links when they are referenced for navigation or review.
- Validation: commands or audit scopes are selected to prove the change without wasting tokens.

## Message And Artifact Discipline

- Keep thread messages concise and action-oriented.
- Put long plans, investigation notes, or detailed designs in artifacts.
- Attach artifacts through message metadata so the UI can display them.
- Do not repeat `artifacts/...` paths in the message body just to show an attached artifact.
- Mention artifact paths or `marc://` artifact references only when the identifier itself is important to the message.
- Do not say an artifact is attached when only a plain text path was written.
- Prefer incremental thread comments that say what changed, what was validated, and what remains pending.

## Audit Discipline

Use `workspace_audit` on demand at meaningful checkpoints:

- `scope: preflight` before starting development from a plan.
- `scope: artifacts` before posting messages that cite artifacts.
- `scope: references` when messages include `marc://` links or project asset references.
- `scope: messages` before completion or closure summaries.
- `scope: all` only when the user asks for a broad quality pass or the thread state is uncertain.

Keep audit calls compact with `threadId`, `messageId`, `severity`, and `maxFindings` when possible.

## Practical Rule

mARC content is project memory. Optimize for future agents being able to reconstruct what happened from the thread, attached artifacts, references, and validation evidence without reading the entire chat.
