# 0008 - Localization is scoped to the browser UI

## Decision

mARC uses i18n only for visible product text in the browser UI.

The UI catalog lives in `public/locales/en_US/translation.json` and remains a flat key/value dictionary. UI code initializes localization through `src/ui/i18n.ts` and uses `useTranslation()` from `src/ui/**`.

The i18n contract test scans literal `t("...")` calls in `src/ui/**` and fails when a key is absent from the en_US catalog. This makes missing visible UI copy a validation failure instead of relying on fallback rendering.

MCP tools, core logic, daemon APIs, CLI output, schemas, guards, file contracts, logs, and operational errors keep literal en-US strings. They are technical contracts, not localized UI copy.

User-authored workspace content remains language-flexible. mARC does not normalize or translate messages, thread titles, artifacts, summaries, or custom rules; users may write them in their preferred language.

## Context

mARC is both a product interface and a coordination protocol for coding agents. Those two surfaces have different stability needs.

The browser UI benefits from localization because it is direct user-facing product copy. MCP and backend strings are read by agents, tests, tools, logs, and integrations, so translating them would make behavior less predictable and harder to debug.

## Consequences

- UI text can move toward future language selection without changing backend contracts.
- The translation catalog must not contain MCP, core, daemon, CLI, or workspace contract strings.
- Tests should protect the i18n boundary so localization imports stay scoped to the UI and catalog helpers.
- New literal UI translation calls require matching catalog entries and are enforced by the i18n contract test.
- Backend and MCP changes should keep messages in clear en-US literals.
- Workspace content keeps the language chosen by the user or agent that authored it.
