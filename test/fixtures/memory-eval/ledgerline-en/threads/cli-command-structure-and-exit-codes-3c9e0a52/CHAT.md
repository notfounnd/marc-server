# CLI command structure and exit codes

Thread: `cli-command-structure-and-exit-codes-3c9e0a52`
Created: `2026-08-07T09:00:00.000Z`

<!-- marc-message
id: msg_3c9e0a5200000001
threadId: cli-command-structure-and-exit-codes-3c9e0a52
timestamp: 2026-08-07T09:03:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: the CLI grows with every feature. We need one command grammar: a verb, a noun, then flags. Exit codes must tell scripts what happened.

<!-- /marc-message -->

<!-- marc-message
id: msg_3c9e0a5200000002
threadId: cli-command-structure-and-exit-codes-3c9e0a52
timestamp: 2026-08-10T10:00:00.000Z
agentId: fixture-developer
role: developer
-->

Proposal: zero for success, one for a business failure such as a rejected import, two for a usage error, and three for an unreachable daemon.

<!-- /marc-message -->

<!-- marc-message
id: msg_3c9e0a5200000003
threadId: cli-command-structure-and-exit-codes-3c9e0a52
timestamp: 2026-08-11T14:30:00.000Z
agentId: fixture-architect
role: architect
-->

Decision: the grammar and the exit codes are fixed for version one. Every command with a changed behavior updates the CLI reference.

<!-- /marc-message -->

<!-- marc-message
id: msg_3c9e0a5200000004
threadId: cli-command-structure-and-exit-codes-3c9e0a52
timestamp: 2026-08-12T16:20:00.000Z
agentId: fixture-developer
role: developer
-->

Done. A test table checks the exit code of each command for success and for the usage error.

<!-- /marc-message -->
