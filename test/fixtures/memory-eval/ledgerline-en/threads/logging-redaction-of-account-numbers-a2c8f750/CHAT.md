# Logging redaction of account numbers

Thread: `logging-redaction-of-account-numbers-a2c8f750`
Created: `2026-09-03T09:00:00.000Z`

<!-- marc-message
id: msg_a2c8f75000000001
threadId: logging-redaction-of-account-numbers-a2c8f750
timestamp: 2026-09-03T09:02:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: debug logs printed full account numbers during an import. Support bundles must never contain them.

<!-- /marc-message -->

<!-- marc-message
id: msg_a2c8f75000000002
threadId: logging-redaction-of-account-numbers-a2c8f750
timestamp: 2026-09-04T10:30:00.000Z
agentId: fixture-developer
role: developer
-->

A logger filter replaces every account number with its last four digits before the line is written. The filter runs for all levels, including debug.

<!-- /marc-message -->

<!-- marc-message
id: msg_a2c8f75000000003
threadId: logging-redaction-of-account-numbers-a2c8f750
timestamp: 2026-09-07T13:00:00.000Z
agentId: fixture-architect
role: architect
-->

Decision: the filter is a single module used by the CLI, the daemon and the API, so no output path can skip it.

<!-- /marc-message -->

<!-- marc-message
id: msg_a2c8f75000000004
threadId: logging-redaction-of-account-numbers-a2c8f750
timestamp: 2026-09-08T15:25:00.000Z
agentId: fixture-developer
role: developer
-->

Done. A test feeds a sample import through all three outputs and searches the captured text for a full number.

<!-- /marc-message -->
