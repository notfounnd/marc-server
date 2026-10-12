# Changelog

## 0.3.0 (2026-10-12)

### Breaking Changes

* Require MCP clients to support protocol revision `2026-07-28`; legacy initialization is rejected. Update the client harness to a compatible MCP implementation and restart it after updating mARC. See the [migration guide](docs/mcp-migration-2026-07-28.md).

### Features

* Added optional summary memory backed by LanceDB, using local embedding, passage reranking, and query-correction models.
* Added hybrid vector and full-text retrieval with field-aware ranking and reranking, plus literal query overrides and suggested-query links in the UI.
* Added the `memory_prepare`, `memory_status`, `memory_rebuild`, and `memory_recall` MCP tools.
* Added configurable UI memory-search retries and deeper manual searches; each new query resets interpretation and retry state.
* Made incremental reconciliation the default for manual rebuilds, kept full rebuilds explicit, and added configurable automatic incremental rebuilds.
* Added bounded rebuild batches and workspace-scoped cross-process locks, with rebuild status surfaced in the UI.
* Added manual memory purge through the CLI, UI, and HTTP API while preserving the active generation and configured production model files.
* Stored per-workspace JSON settings in `.marc/marc.config.json`.
* Reused local inference workers during their idle TTL and released model resources after inactivity.
* Added creation of empty threads from the workspace UI.
* Added a keyboard-shortcuts sheet and consistent toast notifications across the UI.
* Allowed thread read tools to resolve a unique 8-character hexadecimal ID suffix.
* Added `thread_write_summary` for caller-authored summary bodies, canonical core-owned headers, revision-checked updates, and idempotent retries.

### Bug Fixes

* Preserved Arrow schemas and optional fields across incremental memory write/read round-trips.
* Prevented concurrent rebuild requests from queueing duplicate runs and recovered stale lock metadata so rebuild status and follow-up runs remain correct.
* Kept notifications above open sheets and dialogs, and ensured dismissing a toast does not close the underlying sheet.

### Documentation

* Added a project-local `AGENTS.md` and documented the delegated workflow, tool-agnostic model and reasoning guidance, bootstrap and cursor handling, profile reuse, Markdown authority, developer-authored delivery, and independent integrated review.
* Documented validation by impact, including focused checks for editorial work and full checks for executable changes and release-ready claims.
* Documented summary-memory model roles, search depth, rebuild and purge controls, and per-workspace JSON settings.

### Misc

* Modernized MCP server integration with the supported serving SDK and Standard Schema, and added protocol discovery with private zero-TTL cache metadata.
* Stabilized daemon auto-idle shutdown coverage against timing-dependent test races.

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
