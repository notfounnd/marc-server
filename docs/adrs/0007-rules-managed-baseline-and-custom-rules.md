# 0007 - RULES.md uses a managed baseline and Custom Rules boundary

## Decision

`RULES.md` is split into a mARC-managed baseline and a project-owned `Custom Rules` section.

`workspace_update_recommendations` may replace managed sections above `## Custom Rules`. Project-specific guidance must live below the `Custom Rules` comments and should be organized with `###` or deeper headings.

The preservation rule is positional: content below the `Custom Rules` comments is preserved even if it uses `#` or `##` headings. The `###` guidance is a readability convention, not a preservation requirement.

Managed guidance may recommend an operational format for critical custom rules, such as `Trigger`, `Do instead`, `Evidence`, and `Severity`. This format is guidance for agent execution and auditability; it does not change the preservation boundary and does not invalidate older free-form custom rules.

Registered agents are not duplicated in `RULES.md`. Agent profiles live in `.marc/agents/*.md`; agents should use the bootstrap agent inventory or `agent_list` to discover them, and `agent_read_profile` to inspect full profile Markdown.

Official registration writes canonical profile metadata as line-based `ID`, `Role`, `Model` and `Description` fields. Manual context can live below those fields and is preserved when registration refreshes the profile.

## Context

Agents need stable bootstrap guidance that can evolve as mARC tools change. Projects also need local rules that survive recommendation updates.

Keeping both concerns in the same unstructured Markdown area caused drift: agent inventories were appended to `RULES.md`, custom flow rules could appear above the preserved area, and bootstrap updates could move or overwrite content in surprising ways.

## Consequences

- The setup baseline remains project-neutral.
- Managed guidance can be refreshed by `workspace_update_recommendations`.
- Project-specific rules are preserved only below `## Custom Rules`.
- Custom rules placed in managed sections are considered misplaced and may be overwritten.
- Content below the `Custom Rules` comments is preserved by position, regardless of heading level.
- Critical custom rules can be written as operational checklist items without changing how mARC preserves project-owned content.
- Legacy `###` or deeper custom subsections found before `## Custom Rules` can be migrated below the preserved boundary.
- `##` headings outside the preserved boundary are treated as managed or invalid, not as custom rules.
- Agent discovery happens through `.marc/agents/*.md`, bootstrap inventory, and MCP tools, not through a duplicated list in `RULES.md`.
- Profile metadata stays concise for structured reads, while full Markdown context remains available through profile reads.
