# Development

This repository is a TypeScript project with a Node MCP server, a local HTTP daemon, and a React UI built by Vite.

## Structure

```text
src/
  cli.ts
  core/
    guards.ts
    ids.ts
    marc-references.ts
    markdown.ts
    paths.ts
    thread-index.ts
    types.ts
    workspace.ts
  daemon/
    config.ts
    server.ts
    store.ts
    ui.ts
  mcp/
    server.ts
  i18n/
    index.ts
  ui/
    i18n.ts
    main.tsx
    marc-links.ts
    styles.css
```

## Scripts

```bash
pnpm dev:daemon
pnpm dev:mcp
pnpm dev:ui
pnpm typecheck
pnpm run lint:check
pnpm run format:check
pnpm run code:check
pnpm run code:fix
pnpm run validate
pnpm test
pnpm build
```

Benchmarks are run through:

```bash
pnpm test:benchmark ./performance/<file>.benchmark.mjs
```

`performance/thread-index.benchmark.mjs` reports direct scans, JSON rebuilds, warm JSON reads, and stale reads while a background rebuild is running.

Memory evaluation is an opt-in offline suite run with `pnpm memory:eval <command> --corpus <name>`. The commands and their order are described in [Memory](memory.md#evaluation-harness-memoryeval).

## Build

```bash
pnpm build
```

The build removes `dist`, runs TypeScript with `tsconfig.build.json`, and builds the UI with Vite.

Commands that mARC prints or copies for `marc open` and `marc wait` start from the build when one exists. From a development server (`pnpm dev:daemon`, `pnpm dev:mcp`, which run `src/cli.ts` through `tsx`), they use `node dist/cli.js` when `dist/cli.js` exists, or a `marc` on `PATH` when one is installed, and carry no dev loader. Without a build they keep the `tsx` loader. So the listening command that `marc_helper` prints (topic `listening`) changes with the build: run `pnpm build` before you copy one from a development server.

After changing MCP tools or their schemas, rebuild and restart the MCP client session. Many MCP clients cache tool definitions for the lifetime of a session.

The MCP server reports its version from `package.json`. Protocol changes are made against the pinned official server and client SDK versions listed in the manifest; the compatibility target is documented in [the MCP migration note](mcp-migration-2026-07-28.md).

## Tests

```bash
pnpm test
```

The test suite uses Node's built-in test runner with `tsx`.

The `marc open` tests inject the daemon client, the spawner, timers, signals, and the process environment, so no test starts the real `claude`. MCP subprocess tests strip inherited daemon credentials by default. Tests that exercise lease cleanup provide a local fake daemon explicitly. Memory tests use empty temporary workspaces and verify the missing-model state without loading or downloading model assets.

Current test areas include:

- core workspace behavior;
- daemon behavior;
- MCP source and built-CLI stdio negotiation, tool schemas, cache metadata, error envelopes, rate limiting, and shutdown;
- MCP tool behavior through the public client SDK using isolated temporary workspaces;
- UI i18n catalog boundaries;
- mARC reference parsing;
- mention reconciliation, the `marc wait` loop and command, and the `listening` helper and skill section;
- session slots: the pure state table, pending-action warnings, reservations, and the absence proof without a verified start time (`test/core-session-slots*.test.ts`);
- daemon sessions: the registry (generation, reservations, owner calls, fail-closed reads, the lost-registry marker, real-filesystem writes), adoption rules, the `claude agents` reader with an injected runner, and the thread sessions routes (`test/daemon-session-*.test.ts`);
- daemon open command: the short `marc open` command in the thread sessions view (thread suffix, data directory and URL only when they differ from the defaults, `--new` only for a posted unbound slot), the native copy command (`claude --resume` for an ended slot, the single-quoted new-session prompt for an unbound one), no token, and the heartbeat that fills the start time from the agents source (`test/daemon-session-open-*.test.ts`);
- MCP session identity and adoption through a real MCP child process with a fake `CLAUDE_CODE_SESSION_ID` and an in-process daemon whose agents runner is injected, so no real `claude` is called (`test/mcp-session-*.test.ts`);
- the agent launch builder: argument order (prompt before flags), session flag by mode, CLAUDE variable removal with case rules by platform, tool shell environment, the initial prompt shared with the copied command (no single quote in it), the native resume and new-session commands, and the shared `marc` command builder with its pinned `marc wait` output (`test/core-agent-launch*.test.ts`);
- the short `marc` runtime: a source entry runs its built `dist/cli.js` with no execArgv, a `marc` on `PATH` is run by name (`marc.cmd` and `marc.exe` on Windows), and the rules' order, with the probes injected (`test/mcp-listening.test.ts`);
- `marc open`: the acquire, heartbeat, release, and exit-code flow, refusals and input errors from a table, dry run, spawn failure, the data-directory default (`MARC_DAEMON_DIR`, then the workspace's `.marc-daemon` when it exists), and the daemon client and runtime-state reader (`test/cli-open-*.test.ts`);
- thread sessions menu: the Active, Ended, and Other profiles groups with the empty group omitted and the Other group collapsed, the Pending chip and its collapsed panel, the two-line pending items with their own titles and go-to links to the last message, the row dot, sub-line and title tooltip, the Copy button enabled only for an ended or unbound slot with its disabled reason, the pressed header triggers, the single degraded-source line (none when healthy), the fetch states, and the label catalog, with no command or token rendered (`test/ui-thread-sessions-*.test.ts`);
- UI link rendering utilities.

Run type checking separately:

```bash
pnpm typecheck
```

Run linting and formatting separately:

```bash
pnpm run lint:check
pnpm run lint:fix
pnpm run format:check
pnpm run format:fix
pnpm run code:check
pnpm run code:fix
```

The lint configuration enforces the project file-size limit and control-flow rules for TypeScript, TSX, JavaScript, and test files. `code:fix` applies ESLint fixes and Prettier formatting. `code:check` verifies both.

## UI localization

The browser UI uses `i18next` and `react-i18next`. The default and only supported locale is `en_US`.

Visible product text belongs in `public/locales/en_US/translation.json`. Keep this catalog flat: each key maps directly to one string value, with no nested objects or arrays.

Localization is scoped to the browser UI:

- use `useTranslation()` in `src/ui/**`;
- use `src/ui/i18n.ts` to initialize the browser runtime;
- use `src/i18n/index.ts` only for build-time or test helpers that inspect the catalog.

Do not route MCP, daemon, core, CLI, workspace files, user messages, thread content, artifacts, summaries, or custom rules through i18n. Those contracts remain literal en-US code or user-authored content.

## Documentation

Keep user-facing documentation in `docs/` and keep the root `README.md` focused on project introduction, quickstart, and links.

When documenting future capabilities, clearly mark them as planned instead of presenting them as available.

## mARC workspace recommendations

The project-local `.marc/INSTRUCTIONS.md` file is managed by mARC. Do not edit or extend it manually.

Project-specific guidance belongs in `.marc/RULES.md` under `Custom Rules`.

`workspace_bootstrap` establishes or restores the current workspace contract. Call it at session start or when bootstrap context is missing, stale, or uncertain; reuse a known current contract while it remains valid.

Use `workspace_update_recommendations` only to refresh managed recommendations. A refresh does not establish or restore bootstrap context and is not a substitute for `workspace_bootstrap`.

## Validation by impact

Select checks by delivery impact, not by file extension, using the canonical policy in `.marc/RULES.md` under `Custom Rules` and the [delegated workflow](agent-workflows.md#development-loop-for-delegated-work). Editorial content, including changelog corrections, and mARC records need applicable content, Markdown, link, reference, and metadata checks. Harness changes also need review of instruction coherence, source authority, scenarios, and workflow preservation. Executable documentation examples need safe, specific checks, not blind or destructive execution. Documentation alone does not trigger the full product suite.

Run the full flow below, plus specific checks, for code, tests, tooling, dependencies, executable configuration, or parsing and persistence contract changes. Mixed deliveries use the broadest impact. A release-ready declaration requires the full flow even if the last change was documentation. Clarify uncertain impact before omitting checks; record the classification, checks actually run, results, and limits. Non-applicable commands are neither passes nor pending checks. The principal's independent integrated review remains required.

```bash
pnpm validate
pnpm build
pnpm test
```

If executable work changes MCP tool names, schemas, or behavior, include the full flow, inspect the built server from `dist/mcp/server.js` after the build, and restart the MCP client before live validation.

## Also see

- [Harness Engineering](harness-engineering.md)
- [Architecture](architecture.md)
- [Architecture Decision Records (ADR)](adrs/README.md)
