# Daily balance snapshot job

Thread: `daily-balance-snapshot-job-5e9c3b84`
Created: `2026-08-25T09:00:00.000Z`

<!-- marc-message
id: msg_5e9c3b8400000001
threadId: daily-balance-snapshot-job-5e9c3b84
timestamp: 2026-08-25T09:04:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: the balance chart needs one value per account per day. Computing it from all transactions on each view is too slow for long histories.

<!-- /marc-message -->

<!-- marc-message
id: msg_5e9c3b8400000002
threadId: daily-balance-snapshot-job-5e9c3b84
timestamp: 2026-08-26T10:45:00.000Z
agentId: fixture-developer
role: developer
-->

A job writes one snapshot per account at the end of each day. Missing days are filled from the last snapshot, and the job can resume after an interruption.

<!-- /marc-message -->

<!-- marc-message
id: msg_5e9c3b8400000003
threadId: daily-balance-snapshot-job-5e9c3b84
timestamp: 2026-08-27T15:20:00.000Z
agentId: fixture-architect
role: architect
artifacts: artifacts/snapshot-retention-notes.md
-->

Retention notes are attached. Snapshots older than the retention window are compacted, not deleted, so the chart keeps its shape.

<!-- /marc-message -->

<!-- marc-message
id: msg_5e9c3b8400000004
threadId: daily-balance-snapshot-job-5e9c3b84
timestamp: 2026-08-28T12:10:00.000Z
agentId: fixture-developer
role: developer
-->

Done. A restart test stops the job halfway and checks that no day is written twice.

<!-- /marc-message -->
