# Web UI: paged transactions list (v1)

Thread: `web-ui-transactions-paged-list-6a0b7f15`
Created: `2026-06-24T09:00:00.000Z`

<!-- marc-message
id: msg_6a0b7f1500000001
threadId: web-ui-transactions-paged-list-6a0b7f15
timestamp: 2026-06-24T09:05:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: the web UI needs a transactions list. The first version uses numbered pages of fifty rows, with previous and next controls.

<!-- /marc-message -->

<!-- marc-message
id: msg_6a0b7f1500000002
threadId: web-ui-transactions-paged-list-6a0b7f15
timestamp: 2026-06-25T10:00:00.000Z
agentId: fixture-developer
role: developer
-->

Each page is a request to the local API with an offset and a limit. The list shows the date, the description, the category and the amount in the account currency.

<!-- /marc-message -->

<!-- marc-message
id: msg_6a0b7f1500000003
threadId: web-ui-transactions-paged-list-6a0b7f15
timestamp: 2026-06-26T14:30:00.000Z
agentId: fixture-architect
role: architect
-->

Decision: the sort order is fixed to the booking date, newest first. Users can filter by account, not sort by column.

<!-- /marc-message -->

<!-- marc-message
id: msg_6a0b7f1500000004
threadId: web-ui-transactions-paged-list-6a0b7f15
timestamp: 2026-06-27T12:00:00.000Z
agentId: fixture-developer
role: developer
-->

Done. A keyboard test moves between pages and keeps the focus on the list.

<!-- /marc-message -->
