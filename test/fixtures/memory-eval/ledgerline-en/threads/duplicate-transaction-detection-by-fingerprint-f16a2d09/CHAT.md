# Duplicate transaction detection by fingerprint

Thread: `duplicate-transaction-detection-by-fingerprint-f16a2d09`
Created: `2026-08-19T09:00:00.000Z`

<!-- marc-message
id: msg_f16a2d0900000001
threadId: duplicate-transaction-detection-by-fingerprint-f16a2d09
timestamp: 2026-08-19T09:03:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: overlapping statements and repeated syncs import the same transaction twice. We need a fingerprint that identifies a transaction across imports.

<!-- /marc-message -->

<!-- marc-message
id: msg_f16a2d0900000002
threadId: duplicate-transaction-detection-by-fingerprint-f16a2d09
timestamp: 2026-08-20T10:30:00.000Z
agentId: fixture-developer
role: developer
-->

The fingerprint combines the account, the booking date, the amount in minor units and the normalized description. Bank references are used when present.

<!-- /marc-message -->

<!-- marc-message
id: msg_f16a2d0900000003
threadId: duplicate-transaction-detection-by-fingerprint-f16a2d09
timestamp: 2026-08-21T13:00:00.000Z
agentId: fixture-architect
role: architect
-->

Decision: a duplicate is skipped and counted, never merged. A transaction with the same fingerprint but a different amount is kept and flagged for review.

<!-- /marc-message -->

<!-- marc-message
id: msg_f16a2d0900000004
threadId: duplicate-transaction-detection-by-fingerprint-f16a2d09
timestamp: 2026-08-24T16:00:00.000Z
agentId: fixture-developer
role: developer
-->

Done. The import report shows the count of skipped duplicates and the list of flagged pairs.

<!-- /marc-message -->
