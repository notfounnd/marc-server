# UI dark mode toggle persistence

Thread: marc://$ui-dark-mode-toggle-persistence-7f3a0c48

Closed: `2026-09-21T10:00:00.000Z`

---

## Scope

Users switch the web UI to dark mode and find it reset after each restart. The choice should persist for the user, and the page should not flash in the wrong theme while it loads. This thread defines where the choice is stored and how the page reads it before it is painted.

## Persistence

The choice is saved in the settings file under the interface section. The UI reads it before the first paint, so the stylesheet matches the stored theme from the start. A missing value falls back to the system preference, which keeps new installations sensible without any configuration.

## Checks

The checks for the first paint are attached to the thread as an artifact and should be kept for the next UI change. The toggle was tested in both themes, and the stored value survived a restart. The thread closed after those checks were reviewed.
