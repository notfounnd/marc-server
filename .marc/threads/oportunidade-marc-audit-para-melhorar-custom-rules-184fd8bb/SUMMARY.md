# Summary

## Goal

Improve mARC guidance, local agent workflow support, and structural quality checks so agents can apply workspace rules more reliably, attach artifacts correctly, use canonical `marc://` references, and receive practical feedback before important thread actions.

## Completed

- Added operational guidance for `Custom Rules` using `Trigger`, `Do instead`, `Evidence`, and `Severity` fields.
- Preserved compatibility with existing free-form rules while reporting them as improvement feedback in audit output.
- Added managed local skill generation at `.agents/skills/marc-ops/SKILL.md`.
- Updated the `marc-ops` skill to work together with `RULES.md`, declare itself active for every session, expose `when_to_use`, and guide agents through bootstrap, rules, artifacts, references, and audit checkpoints.
- Added `workspace_audit` as an MCP tool for on-demand structural compliance checks.
- Implemented audit scopes for rules, agents, references, artifacts, messages, and preflight.
- Kept audit focused on structural compliance instead of semantic review.
- Updated README and docs for the new workflow, audit tool, local skill, and operational rules.
- Registered the detailed implementation plans as artifacts in this thread.

## Validation

- Core and MCP tests were updated for rules, skill generation, bootstrap behavior, audit schema, and audit findings.
- `pnpm typecheck` passed during validation.
- `pnpm build` passed during validation.
- After deleting `.agents`, `workspace_bootstrap` recreated `.agents/skills/marc-ops/SKILL.md`.
- A second `workspace_bootstrap` call reported `.agents/skills/marc-ops/SKILL.md` as `alreadyCurrent`.
- Manual audit validation confirmed that intentionally broken references and artifact metadata are detected.

## Notes

- Message `msg_874a045043d34b1e80` remains in the thread as an intentional structural audit test fixture by user decision.
- Findings caused by that message are not delivery blockers.
- Free-form Custom Rules warnings remain expected until the separate opportunity to reformat project rules is handled.
- Agent metadata warnings remain improvement feedback and are not blockers for this thread.

## Follow-up

- Continue the separate opportunity `marc://$oportunidade-reformatar-custom-rules-com-base-na-auditoria-894072be` when ready.
