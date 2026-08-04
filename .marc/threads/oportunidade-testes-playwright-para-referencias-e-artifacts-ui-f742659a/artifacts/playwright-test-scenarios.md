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

## Neo-Brutalism UI Migration

Source thread: `oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1`  
Priority: medium

- [ ] Load the UI and verify the three columns use the warm neutral and teal neo-brutalism theme with square bordered controls and solid lower-right shadows.
- [ ] Select a workspace and a thread, hover each selected card, and verify the teal left inset remains visible while the black hover shadow is removed.
- [ ] Open a thread containing rendered Markdown and verify headings, lists, inline code, fenced code, links, bold text, and italic text remain visually distinguishable.
- [ ] Open the artifact menu and autocomplete suggestions, move the active selection, and verify the selected row keeps the teal left indicator without rounded badges or rounded menu items.
- [ ] Open the keyboard shortcuts dialog and an artifact sheet, and verify both use consistent close controls, borders, shadows, focus indication, and close animations.
- [ ] Copy a thread reference by clicking its displayed reference text and verify the value is copied without rendering that reference as a button-like control.

## Workspace Memory Indicator

Source thread: `oportunidade-indicador-visual-de-memory-na-interface-174c48b6`  
Additional source thread: `oportunidade-coordenacao-global-de-rebuild-da-memory-entre-proce-774d1e99`  
Priority: medium

- [ ] Load the UI with a valid daemon token and a workspace whose memory status is `ready`; verify the workspace card shows a `Memory ready` accessible indicator with the `database-check` icon.
- [ ] Simulate or prepare stale/missing memory status and verify the workspace card shows the `database-backup` action state without affecting the daemon `Connected` status.
- [ ] Simulate a memory error or incompatible index status and verify the workspace card shows the `database-x` error state with an accessible label.
- [ ] Trigger a memory rebuild from the UI and verify the workspace card shows the `database-zap` busy state while `/api/status` reports `modules.memory.rebuilding=true`.
- [ ] Start a memory rebuild from MCP or CLI while the UI is connected and verify the workspace card switches to the `database-zap` busy state through the daemon `workspace-changed` event, then returns to `database-check` after the shared lock is released.
- [ ] Verify the indicator remains aligned inside selected and unselected workspace cards across desktop and narrow viewports.

## Workspace Memory Settings

Source threads: `oportunidade-processamento-em-background-para-gerar-memory-aa4908aa`, `oportunidade-rebuild-incremental-e-batches-limitados-da-memory-3e422682`  
Priority: high

- [ ] Load the UI with a valid daemon token and a selected workspace; click the workspace settings button in the third-column header and verify a right-side sheet opens instead of a dropdown.
- [ ] Verify the workspace settings sheet shows a Search section above the Memory section, followed by memory status, the right-aligned `Automatic memory rebuild` switch, the embedding batch-size slider, and the `Prepare models` / `Incremental rebuild` / `Full rebuild` / `Purge unused` actions below without horizontal overflow.
- [ ] Toggle `Automatic memory rebuild` off and on; verify the switch state persists after refresh and the workspace status API reports the same `autoRebuild` value.
- [ ] Verify the embedding batch-size slider defaults to `4`, exposes only even values from `2` through `16`, updates its record-count label while dragged, persists on commit, and restores the saved value after refresh.
- [ ] Trigger `Incremental rebuild` with unchanged summaries and verify the request body sends `mode: "incremental"`, the UI returns to `ready`, and no second rebuild can be started while the shared lock is active.
- [ ] Trigger `Full rebuild` and verify the request body sends `mode: "full"`, the workspace card shows `database-zap` while rebuilding, and both rebuild buttons are disabled until the shared lock is released.
- [ ] With `autoRebuild` enabled, close a thread by creating `SUMMARY.md`; verify memory status transitions through rebuild when needed and returns to `ready` with the new summary indexed.
- [ ] Verify the Neobrutalism/Radix switch thumb is visually aligned in both checked and unchecked states, matching the documented switch spacing.
- [ ] Verify workspace, thread, and agent headers keep the same eyebrow/title/reference structure, including copyable `marc://$threadId`, `marc://@agentId`, and workspace path rows.

## Memory Search Progressive Deep Retry

Source threads: marc://$oportunidade-calibragem-de-recall-lexical-e-candidatos-da-memory-e4478bac, marc://$oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba  
Priority: high

Coverage note: the scenarios below remain pending as durable automated E2E tests. Ad hoc Playwright CLI checks on desktop/mobile and user checks after restart validated early-success visibility, sequential retries, reload persistence, exhaustion, and new-query reset for thread 834716ba. They do not replace this regression backlog.

Current contract: depth 0, 1, 2, and 3 request candidate pools of 100, 200, 300, and 400 per retrieval channel. Depth does not lower semantic eligibility. The former minScore ladder is no longer part of the recall contract.

- [ ] With memory ready, submit a query with no result at depth 0 and verify the empty state retains Deep retry while another depth remains.
- [ ] Configure automatic depth 0 through 3; verify every new query starts at 0, advances sequentially only after empty responses, and stops at the first result or configured limit.
- [ ] Configure automatic depth 3 and return results at depth 0; verify Deep retry remains available and its next request uses depth 1 rather than skipping levels or disappearing.
- [ ] Configure automatic depth 1 and return results at depth 0; verify the first manual retry uses depth 1.
- [ ] Click Deep retry through remaining depths; verify each action requests exactly the next completed depth, replaces the result set, and disappears only when depth 3 completed.
- [ ] Submit a new query after manual retries or exhaustion; verify its first request uses depth 0 and does not inherit prior progress.
- [ ] Refresh after success or exhaustion; verify the latest per-workspace snapshot restores its last completed depth, without replaying a request automatically.
- [ ] Restore a legacy localStorage snapshot without reliable completed-depth metadata; verify it is discarded rather than inventing progress.
- [ ] Switch workspace or submit a new query while a response is pending; verify stale responses cannot replace the active workspace/query result or persisted snapshot.
- [ ] Verify interpretation runs only on the first automatic request; automatic and manual retries use the same effective query with queryMode literal.
- [ ] Verify the UI requests limit 50; do not infer the separate MCP default of 5 from browser behavior.

## Memory Query Interpretation Links

Source thread: marc://$oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba  
Priority: high

- [ ] Return an automatically corrected query; verify the effective-query notice and original-term alternative are shown, with only the alternative query underlined as a link and no boxed button.
- [ ] Return a corpus-backed suggestion without correction; verify the literal search stays effective and the suggested term alone is presented as the alternative link.
- [ ] Activate either alternative after deep retries; verify a new literal search starts at depth 0 and does not inherit prior progress or reinterpret the explicitly selected term.
- [ ] Verify link typography matches adjacent interpretation text and supports keyboard activation/focus without shifting the result layout.

## Memory Model Maintenance

Source thread: marc://$oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba  
Priority: high

- [ ] Open workspace settings with missing interpretation/retrieval/reranking caches; verify Prepare models reflects availability and preparation progress, then enables eligible rebuild/search actions when preparation succeeds.
- [ ] Use a disposable workspace with obsolete managed generations/model variants; activate Purge unused and verify its authenticated maintenance request, released-space notification, and refreshed inventory.
- [ ] Verify purge preserves the committed active generation, selected model variants, and source Markdown files; do not run destructive fixture scenarios against the user's real workspace.
- [ ] Mock a busy shared maintenance operation; verify conflicting actions remain unavailable or surface the busy response without queuing a duplicate operation.
- [ ] Verify preparation/purge errors clear progress states and show localized error feedback rather than leaving actions indefinitely disabled.

## Maintenance Notes

- This backlog should grow as UI features are added.
- Prefer adding scenarios immediately after a feature lands, while behavior and edge cases are still fresh.
- Keep this artifact focused on Playwright/browser behavior: real DOM rendering, clipboard, layout, toast, scroll, and modal interactions.
