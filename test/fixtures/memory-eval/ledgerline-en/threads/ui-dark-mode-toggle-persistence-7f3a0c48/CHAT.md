# UI dark mode toggle persistence

Thread: `ui-dark-mode-toggle-persistence-7f3a0c48`
Created: `2026-09-15T09:00:00.000Z`

<!-- marc-message
id: msg_7f3a0c4800000001
threadId: ui-dark-mode-toggle-persistence-7f3a0c48
timestamp: 2026-09-15T09:03:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: users switch the web UI to dark mode and find it reset after every restart. The choice should persist for the user.

<!-- /marc-message -->

<!-- marc-message
id: msg_7f3a0c4800000002
threadId: ui-dark-mode-toggle-persistence-7f3a0c48
timestamp: 2026-09-16T10:40:00.000Z
agentId: fixture-developer
role: developer
-->

The choice is saved in the settings file under the interface section. The UI reads it before the first paint, so the page does not flash in the wrong theme.

<!-- /marc-message -->

<!-- marc-message
id: msg_7f3a0c4800000003
threadId: ui-dark-mode-toggle-persistence-7f3a0c48
timestamp: 2026-09-17T14:00:00.000Z
agentId: fixture-architect
role: architect
artifacts: artifacts/theme-persistence-checks.md
-->

The checks for the first paint are attached. Please keep them in the thread for the next UI change.

<!-- /marc-message -->

<!-- marc-message
id: msg_7f3a0c4800000004
threadId: ui-dark-mode-toggle-persistence-7f3a0c48
timestamp: 2026-09-18T11:15:00.000Z
agentId: fixture-developer
role: developer
-->

Done. The toggle works in both themes, and the stored value survives a restart.

<!-- /marc-message -->
