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

## Maintenance Notes

- This backlog should grow as UI features are added.
- Prefer adding scenarios immediately after a feature lands, while behavior and edge cases are still fresh.
- Keep this artifact focused on Playwright/browser behavior: real DOM rendering, clipboard, layout, toast, scroll, and modal interactions.
