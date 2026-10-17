# Web UI: virtual scrolling for transactions (v2)

Thread: `web-ui-transactions-virtual-scrolling-b4e8c293`
Created: `2026-06-29T09:00:00.000Z`

<!-- marc-message
id: msg_b4e8c29300000001
threadId: web-ui-transactions-virtual-scrolling-b4e8c293
timestamp: 2026-06-29T09:04:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: users with years of history find the paged list slow to browse. This version replaces the pages with one continuous list that renders only the rows in view.

<!-- /marc-message -->

<!-- marc-message
id: msg_b4e8c29300000002
threadId: web-ui-transactions-virtual-scrolling-b4e8c293
timestamp: 2026-06-30T10:20:00.000Z
agentId: fixture-developer
role: developer
-->

The list requests windows of two hundred rows as the scroll position changes. Row heights are fixed, so the scroll height is computed without measuring each row.

<!-- /marc-message -->

<!-- marc-message
id: msg_b4e8c29300000003
threadId: web-ui-transactions-virtual-scrolling-b4e8c293
timestamp: 2026-07-01T15:40:00.000Z
agentId: fixture-architect
role: architect
artifacts: artifacts/scrolling-measurements.md
-->

Measurements for the decision are attached. The paged list stays available as a fallback behind a setting.

<!-- /marc-message -->

<!-- marc-message
id: msg_b4e8c29300000004
threadId: web-ui-transactions-virtual-scrolling-b4e8c293
timestamp: 2026-07-02T11:10:00.000Z
agentId: fixture-developer
role: developer
-->

Done. The fallback setting is tested in both modes, and the focus behaves the same way in each.

<!-- /marc-message -->
