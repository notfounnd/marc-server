# Executive Summary

## Outcome

This thread corrected how mARC manages registered agents and workspace rules.

`RULES.md` no longer stores a duplicated registered-agent inventory. Agent profiles in `.marc/agents/*.md` are the source of truth, and agents should use MCP tools to discover and inspect them.

## Decisions

- `agent_register` writes or updates only `.marc/agents/<agent-id>.md`.
- `agent_list` was added so agents can discover registered agents and valid IDs for mentions.
- `agent_read_profile` remains the tool for inspecting one agent profile.
- `RULES.md` is split into a managed mARC baseline above `## Custom Rules` and project-owned rules below the Custom Rules comments.
- `workspace_update_recommendations` may rebuild managed sections above `## Custom Rules`.
- Project-specific rules must be placed below the Custom Rules comments.
- `###` or deeper headings are preferred for organizing project-specific rules.
- Content below the Custom Rules comments is preserved by position, even if it uses `#` or `##` headings.
- Unknown `##` headings above `## Custom Rules` are treated as invalid or managed-area drift and may be removed.
- A legacy fallback migrates misplaced `###` or deeper custom subsections, such as `### Flow Rules`, below the preserved Custom Rules boundary.

## Changes

- Updated core workspace recommendation logic in `src/core/workspace.ts`.
- Removed the `RULES.md` append behavior from `agent_register`.
- Added MCP tool `agent_list` in `src/mcp/server.ts`.
- Updated tests in `test/core.test.ts` and `test/mcp.test.ts`.
- Updated the real project `.marc/RULES.md`.
- Added ADR `docs/adrs/0007-rules-managed-baseline-and-custom-rules.md`.
- Linked ADR 0007 from `docs/adrs/README.md` and `docs/architecture.md`.

## Validation

- `pnpm test test/core.test.ts` passed with 39 tests and 0 failures.
- `pnpm test test/mcp.test.ts` passed with 39 tests and 0 failures.
- `pnpm test` passed with 39 tests and 0 failures.
- `pnpm typecheck` passed.
- `pnpm build` passed.
- `dist/mcp/server.js` was inspected and confirmed to register `agent_list`.
- ADR 0007 links were validated in the ADR index and architecture documentation.

## Notes

- No Playwright backlog update was needed in `oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a` because this work changed core/MCP/documentation behavior, not UI/browser behavior.
- MCP clients must restart after this change so the new `agent_list` tool schema is visible.
