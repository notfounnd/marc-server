# Playwright UI Test Backlog

This artifact is the source of truth for pending Playwright scenarios in the mARC UI.

## Agent Instructions

When an agent finishes a UI implementation or refinement:

1. Read this thread.
2. Open this artifact.
3. Add or update only Playwright/E2E scenarios related to the finished UI work.
4. Keep unit tests, pure `node:test` coverage, typecheck, and build validation in the implementation thread, not here.
5. Use checkboxes to track scenario status.
6. Keep each scenario actionable: name the setup, user action, and expected UI result.
7. If a scenario is implemented later, mark it done and add the test file path.

Status convention:

- `[ ]` pending Playwright coverage.
- `[x]` implemented Playwright coverage.
- `Priority: high | medium | low`.
- `Source thread: <thread-id>`.

## Internal References

Source thread: `oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4`  
Priority: high

- [ ] Open a thread with a plain `marc://@agent-id` reference and verify it renders as `@agent-id`.
- [ ] Open a thread with `[custom text](marc://@agent-id)` and verify the UI forces the canonical label `@agent-id`.
- [ ] Verify canonical labels for `marc://#message-id`, `marc://$thread-id`, and artifact references.
- [ ] Click an agent reference and verify navigation to the agent profile.
- [ ] Click a thread reference and verify the selected thread changes.
- [ ] Click a same-thread message reference and verify scroll/focus on the message card.
- [ ] Click a cross-thread message reference and verify thread switch plus message focus.
- [ ] Click an artifact reference and verify the Markdown modal opens.
- [ ] Click the thread copy control and verify a desktop bottom-right toast appears.
- [ ] Click message and agent copy controls and verify toast appears without changing daemon global status.
- [ ] Verify responsive toast layout on a narrow viewport.
- [ ] Verify the header artifact button is aligned to the internal bottom edge.
- [ ] Click the header artifact button and verify a floating artifact list opens.
- [ ] Verify the floating artifact list keeps message order: oldest artifacts at the top, newest at the bottom.

## Artifact Attach Modal

Source thread: `oportunidade-popup-para-postar-artifacts-pela-ui-c04986bd`  
Priority: high

- [ ] Post a short UI message and verify `role=user` messages expose the attach artifact action.
- [ ] Open the attach artifact modal and verify desktop layout is centered in the content area.
- [ ] Open the attach artifact modal on a narrow viewport and verify responsive layout does not overflow.
- [ ] Save an artifact without an extension and verify `.md` is appended.
- [ ] Save an artifact with an arbitrary extension and verify `.md` is appended, for example `notes.txt` becomes `notes.txt.md`.
- [ ] Try a filename containing a directory and verify it is rejected.
- [ ] Verify a saved artifact appears in the thread floating artifact list.
- [ ] Click a saved artifact and verify the Markdown viewer modal opens.
- [ ] Verify the composer character counter decrements.
- [ ] Verify an oversized message disables `Post message` and shows guidance to use an artifact.
- [ ] Verify the composer help tooltip explains using artifacts for large messages.

## Composer Autocomplete

Source thread: `oportunidade-autocomplete-de-referencias-no-composer-2341bc9f`  
Priority: high

- [ ] Type `@`, press `Ctrl+Space`, and verify registered agents appear as canonical `marc://@agent-id` suggestions.
- [ ] Type `$`, press `Ctrl+Space`, and verify workspace threads appear with open threads before closed threads.
- [ ] Verify closed thread suggestions are visually distinguished from open thread suggestions.
- [ ] Type `#`, press `Ctrl+Space`, and verify current-thread messages appear in `CHAT.md` order, oldest first.
- [ ] Verify artifact suggestions appear directly below and indented under their parent message.
- [ ] Select a suggestion with `ArrowUp` and `ArrowDown`, then insert it with `Enter`.
- [ ] Select a suggestion with `ArrowUp` and `ArrowDown`, then insert it with `Tab`.
- [ ] Hover a suggestion and verify only one item is visually selected at a time.
- [ ] Move the mouse away from a hovered suggestion and verify the last active suggestion remains selected for keyboard continuation.
- [ ] Type `marc://$thread-id/#`, press `Ctrl+Space`, and verify messages and artifacts are suggested only from that referenced thread.
- [ ] Verify cross-thread autocomplete does not change the selected thread while suggesting remote messages or artifacts.
- [ ] Press `Escape` while suggestions are open and verify the suggestion list closes.

## Keyboard Shortcuts Modal

Source thread: `oportunidade-autocomplete-de-referencias-no-composer-2341bc9f`  
Priority: medium

- [ ] Verify the content column footer shows an icon-only keyboard shortcuts link on workspace, agent, rules/workspace overview, and thread views.
- [ ] Click the keyboard shortcuts link and verify the modal opens centered in the full viewport.
- [ ] Verify the modal title includes the keyboard icon and `Keyboard shortcuts` text.
- [ ] Verify the modal does not show composer-specific eyebrow or explanatory text.
- [ ] Press `Escape` and verify the keyboard shortcuts modal closes.

## UI Localization

Source thread: `oportunidade-revisao-en-us-do-projeto-c14150b8`  
Priority: medium

- [ ] Start the daemon UI and verify the browser loads `/locales/en_US/translation.json`.
- [ ] Verify common shell labels render from the catalog, including `Threads`, `Workspaces`, `Marckers`, `Post message`, and `Keyboard shortcuts`.
- [ ] Verify composer and artifact modal labels render in en-US after opening their respective UI surfaces.
- [ ] Simulate a missing catalog request and verify the UI still renders readable fallback keys instead of crashing.
- [ ] Verify workspace-authored content is displayed unchanged when messages, thread titles, artifacts, summaries, or rules use a non-English language.

## Three-Column UI Modes And Scroll

Source thread: `oportunidade-esquemas-de-visualizacao-das-colunas-da-ui-604ad99b`  
Priority: high

- [ ] Verify the middle column starts in the `Threads` mode and shows only open threads.
- [ ] Click the Marckers button to the left of the archive button and verify the middle column shows only Marckers plus a close button.
- [ ] Click the close button in Marckers mode and verify the middle column returns to open threads.
- [ ] Click the archive button and verify the middle column shows only closed threads plus a close button.
- [ ] Toggle between Threads, Marckers, and archive modes and verify the top action buttons do not shift horizontally.
- [ ] Open a long thread and verify only the third column content scrolls while the workspace and middle columns keep their own scroll positions.
- [ ] Verify the third-column header scrolls with the content while the footer remains fixed.
- [ ] Verify `Developed by Júnior Sbrissa` appears immediately to the left of the keyboard shortcuts button.
- [ ] Open the centered keyboard shortcuts modal and verify wheel or touch input on the backdrop does not scroll the app behind it.
- [ ] Open the right-side artifact modal and verify wheel or touch input on the backdrop does not scroll the app behind it.
- [ ] Verify the centered keyboard shortcuts modal remains centered and right-side artifact modals remain aligned to the content column.

## Maintenance Notes

- This backlog should grow as UI features are added.
- Prefer adding scenarios immediately after a feature lands, while behavior and edge cases are still fresh.
- Keep this artifact focused on Playwright/browser behavior: real DOM rendering, clipboard, layout, toast, scroll, and modal interactions.
