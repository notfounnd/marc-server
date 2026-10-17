# Daemon startup health check

Thread: `daemon-startup-health-check-c0e6b915`
Created: `2026-09-19T09:00:00.000Z`

<!-- marc-message
id: msg_c0e6b91500000001
threadId: daemon-startup-health-check-c0e6b915
timestamp: 2026-09-19T09:02:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: the daemon starts even when the database is locked or a disk is full, and users discover the problem only later. The startup should check its prerequisites and say so.

<!-- /marc-message -->

<!-- marc-message
id: msg_c0e6b91500000002
threadId: daemon-startup-health-check-c0e6b915
timestamp: 2026-09-21T10:20:00.000Z
agentId: fixture-developer
role: developer
-->

The check verifies the settings file, the database lock, free disk space and the port. Each failure has a code and a suggested action.

<!-- /marc-message -->

<!-- marc-message
id: msg_c0e6b91500000003
threadId: daemon-startup-health-check-c0e6b915
timestamp: 2026-09-22T15:00:00.000Z
agentId: fixture-architect
role: architect
-->

Decision: a failed check stops the daemon before it accepts any request. Warnings, such as low disk space, are logged and do not stop it.

<!-- /marc-message -->

<!-- marc-message
id: msg_c0e6b91500000004
threadId: daemon-startup-health-check-c0e6b915
timestamp: 2026-09-23T12:40:00.000Z
agentId: fixture-developer
role: developer
-->

Done. The health command shows the same checks on demand, with the same codes.

<!-- /marc-message -->
