# mARC Instructions

<!-- This file is generated and maintained by mARC. Do not edit or extend it. Put project-specific guidance in RULES.md under Custom Rules. -->

## Bootstrap Protocol

- For the first mARC action in a session or workspace, call `workspace_bootstrap` before any gated tool.
- After a successful bootstrap, send `bootstrapConfirmed: true` when calling gated tools.
- `workspace_bootstrap` refreshes recommendations, including this managed `INSTRUCTIONS.md` file, and reads `RULES.md` for the current workspace contract.
- Read `RULES.md` as the workspace behavior contract before acting on mARC thread context.
- If bootstrap context was lost after compaction, resume, or subagent delegation, call `workspace_bootstrap` again.
