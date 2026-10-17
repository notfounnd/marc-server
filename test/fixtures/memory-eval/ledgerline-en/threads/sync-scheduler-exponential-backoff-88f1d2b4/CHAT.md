# Sync scheduler: exponential backoff (v2)

Thread: `sync-scheduler-exponential-backoff-88f1d2b4`
Created: `2026-06-08T09:00:00.000Z`

<!-- marc-message
id: msg_88f1d2b400000001
threadId: sync-scheduler-exponential-backoff-88f1d2b4
timestamp: 2026-06-08T09:05:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: a failing bank should not be polled every hour. This thread replaces the fixed interval with a backoff, and the refresh cycle keeps its per-account lock from v1.

<!-- /marc-message -->

<!-- marc-message
id: msg_88f1d2b400000002
threadId: sync-scheduler-exponential-backoff-88f1d2b4
timestamp: 2026-06-09T14:20:00.000Z
agentId: fixture-developer
role: developer
-->

Each failure doubles the wait before the next refresh cycle, up to a cap of twelve hours. A success resets the wait to the base interval.

<!-- /marc-message -->

<!-- marc-message
id: msg_88f1d2b400000003
threadId: sync-scheduler-exponential-backoff-88f1d2b4
timestamp: 2026-06-10T10:10:00.000Z
agentId: fixture-architect
role: architect
-->

Decision: the cap and the base interval are settings of the account. The refresh cycle records the next attempt time, so a restart does not reset the backoff.

<!-- /marc-message -->

<!-- marc-message
id: msg_88f1d2b400000004
threadId: sync-scheduler-exponential-backoff-88f1d2b4
timestamp: 2026-06-11T16:00:00.000Z
agentId: fixture-developer
role: developer
-->

Done. A test simulates five failures and one success and checks the wait after each one.

<!-- /marc-message -->
