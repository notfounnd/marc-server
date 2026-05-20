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

## Build

```bash
pnpm build
```

The build removes `dist`, runs TypeScript with `tsconfig.build.json`, and builds the UI with Vite.

After changing MCP tools or their schemas, rebuild and restart the MCP client session. Many MCP clients cache tool definitions for the lifetime of a session.

## Tests

```bash
pnpm test
```

The test suite uses Node's built-in test runner with `tsx`.

Current test areas include:

- core workspace behavior;
- daemon behavior;
- MCP tool registration and bootstrap rules;
- UI i18n catalog boundaries;
- mARC reference parsing;
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

Before acting on a mARC thread, run:

```text
workspace_bootstrap
```

or refresh recommendations directly with:

```text
workspace_update_recommendations
```

## Validation checklist

Before calling documentation or tooling work complete:

```bash
pnpm run validate
pnpm test
pnpm build
```

If the work changes MCP tool names, schemas, or behavior, inspect the built server from `dist/mcp/server.js` after the build and restart the MCP client before live validation.

## Also see

- [Harness Engineering](harness-engineering.md)
- [Architecture](architecture.md)
- [Architecture Decision Records (ADR)](adrs/README.md)
