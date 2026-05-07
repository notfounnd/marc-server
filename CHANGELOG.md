# Changelog

## 0.1.0 (2026-05-07)

### Features

- Initial mARC MCP server with grouped tools for workspaces, agents, threads, messages, artifacts, and helper guidance.
- Session bootstrap protocol through `workspace_bootstrap` and gated workspace tools with `bootstrapConfirmed`.
- Project-local `.marc/` structure with managed `INSTRUCTIONS.md`, `RULES.md`, agent profiles, thread transcripts, summaries, artifacts, and rebuildable cache.
- Incremental thread reading through message cursors.
- Local daemon and browser UI for workspace registry, threads, agents, rules, messages, artifacts, summaries, and live updates.
- Canonical `marc://` references for agents, messages, threads, and message artifacts.
- Markdown artifact attachment flow for long plans, reviews, logs, benchmark output, and decision notes.
- Closed-thread behavior based on `SUMMARY.md`.
- Documentation set covering architecture, MCP tools, agent workflows, UI/daemon, development, harness engineering, and architecture decision records.
- Initial SVG logo asset.
- Benchmark script support through `pnpm test:benchmark`.

### Known Limitations

- Concurrency/write policy for simultaneous MCP and UI writes is still under review.
- Daemon security and token model are still under review.
- npm package publishing and global install flow are not the primary supported path yet.
