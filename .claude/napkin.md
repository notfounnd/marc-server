# Napkin Runbook

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Execution & Validation (Highest Priority)
1. **[2026-05-11] Prefer early return and strategy pattern**
   Do instead: reduce branching with early returns and model repeated behavioral variation with explicit strategies.
2. **[2026-04-30] MCP tool list must be validated from `dist` after build**
   Do instead: run `pnpm build`, then inspect `buildMcpServer()._registeredTools` from `dist/mcp/server.js`.
3. **[2026-05-06] Workspace recommendations separate bootstrap from rules**
   Do instead: keep `.marc/INSTRUCTIONS.md` as short bootstrap protocol and `.marc/RULES.md` as workspace behavior plus `Custom Rules`.
4. **[2026-04-30] Workspace recommendations update project files idempotently**
   Do instead: validate `.marc/RULES.md` through `updateWorkspaceRecommendations` after changing baseline guidance.

## Shell & Command Reliability
1. **[2026-04-30] This workspace may not be a Git repository**
   Do instead: do not rely on `git status`; list known touched files from the task when reporting.

## Domain Behavior Guardrails
1. **[2026-04-30] MCP tools use `{prefix}_{action}` only**
   Do instead: expose names like `thread_create`, `message_post`, and `workspace_register`; do not add legacy aliases like `create_thread` or `post_message`.
2. **[2026-04-30] MCP clients cache tool schemas**
   Do instead: rebuild and restart/reconnect the MCP client before expecting newly renamed tools to appear.

## User Directives
1. **[2026-04-30] mARC thread work must be acknowledged in mARC**
   Do instead: after treating a thread task, post a concise status back to the relevant mARC thread.
2. **[2026-05-24] Run Playwright through the CLI**
   Do instead: use the Playwright CLI for browser inspection and UI validation in this workspace; do not open browser pages through Playwright MCP.
