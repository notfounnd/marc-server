# Changelog

## 0.2.0 (2026-05-26)

### Features

* Added composer reference autocomplete with canonical `marc://` insertion for agents, threads, messages, and artifacts, including keyboard navigation and cross-thread lookups.
* Added `agent_list` and profile-backed agent discovery, removing duplicated registered-agent inventories from generated rules.
* Added an en-US localization catalog for visible UI text, with an explicit boundary that keeps backend, MCP, and workspace-authored content outside UI translation.
* Added background thread-index reconciliation and health reporting through `/api/status`, `workspace_status`, and visible UI index states.
* Added detached daemon lifecycle commands and operational support for global CLI installs, including stored daemon state, status detection, leases, and idle shutdown.
* Added `workspace_audit` checks to provide actionable findings for custom rules and workspace content.
* Added cooperative resource locks and atomic Markdown writes while retaining Markdown as the authoritative project state.
* Added middle-column modes for Threads, Marckers, and files, with independent column scrolling, a fixed content footer, and consistent modal behavior.
* Restyled the UI with the neo-brutalist visual system, including legible rendered Markdown and consolidated dialog/sheet interactions.

### Bug Fixes

* Prevented bootstrap and recommendation refreshes from unintentionally rewriting preserved custom rules.
* Made `agent_register` explicitly signal whether a registered agent was created, updated, or already present.
* Stopped `marc-ops` guidance from causing repeated bootstrap calls and redundant investigation while session context remains valid.
* Reported non-linkable `marc://` references written in inline code during workspace audit while leaving fenced code examples unaffected.

### Documentation

* Reformatted custom rules into the audit-oriented `Trigger`, `Do instead`, `Evidence`, and `Severity` structure.
* Recorded the local daemon security and token-management boundary without introducing an unsupported remote authorization model.

### Misc

* Refactored the core, daemon, MCP, and UI architecture into focused modules while preserving established behavior.
* Split the UI stylesheet into domain-specific CSS files behind the existing aggregate entrypoint while preserving cascade order.

## 0.1.0 (2026-05-07)

### Features

* Initial mARC MCP server with grouped tools for workspaces, agents, threads, messages, artifacts, and helper guidance.
* Session bootstrap protocol through `workspace_bootstrap` and gated workspace tools with `bootstrapConfirmed`.
* Project-local `.marc/` structure with managed `INSTRUCTIONS.md`, `RULES.md`, agent profiles, thread transcripts, summaries, artifacts, and rebuildable cache.
* Incremental thread reading through message cursors.
* Local daemon and browser UI for workspace registry, threads, agents, rules, messages, artifacts, summaries, and live updates.
* Canonical `marc://` references for agents, messages, threads, and message artifacts.
* Markdown artifact attachment flow for long plans, reviews, logs, benchmark output, and decision notes.
* Closed-thread behavior based on `SUMMARY.md`.
* Documentation set covering architecture, MCP tools, agent workflows, UI/daemon, development, harness engineering, and architecture decision records.
* Initial SVG logo asset.
* Benchmark script support through `pnpm test:benchmark`.

### Known Limitations

* Concurrency/write policy for simultaneous MCP and UI writes is still under review.
* Daemon security and token model are still under review.
* npm package publishing and global install flow are not the primary supported path yet.
