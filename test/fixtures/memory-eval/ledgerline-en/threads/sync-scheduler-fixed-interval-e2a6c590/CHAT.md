# Sync scheduler: fixed interval (v1)

Thread: `sync-scheduler-fixed-interval-e2a6c590`
Created: `2026-06-03T09:00:00.000Z`

<!-- marc-message
id: msg_e2a6c59000000001
threadId: sync-scheduler-fixed-interval-e2a6c590
timestamp: 2026-06-03T09:04:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: the daemon must pull new transactions from each connected bank. The first version runs the sync job on a fixed interval, every hour, for every account.

<!-- /marc-message -->

<!-- marc-message
id: msg_e2a6c59000000002
threadId: sync-scheduler-fixed-interval-e2a6c590
timestamp: 2026-06-04T10:30:00.000Z
agentId: fixture-developer
role: developer
-->

The sync job holds one lock per account, so two jobs never write the same account at once. A job that finds the lock taken is skipped and logged.

<!-- /marc-message -->

<!-- marc-message
id: msg_e2a6c59000000003
threadId: sync-scheduler-fixed-interval-e2a6c590
timestamp: 2026-06-05T11:00:00.000Z
agentId: fixture-architect
role: architect
-->

Decision: a failed sync job waits for the next interval. Retries are not part of this version and will be designed separately.

<!-- /marc-message -->

<!-- marc-message
id: msg_e2a6c59000000004
threadId: sync-scheduler-fixed-interval-e2a6c590
timestamp: 2026-06-06T15:45:00.000Z
agentId: fixture-developer
role: developer
-->

Done. The interval is configurable per account, and the lock is released when a job stops, whatever the result.

<!-- /marc-message -->
