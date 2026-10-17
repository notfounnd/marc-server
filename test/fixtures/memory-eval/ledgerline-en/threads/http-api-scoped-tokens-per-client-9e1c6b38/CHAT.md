# Local HTTP API: scoped tokens per client (v2)

Thread: `http-api-scoped-tokens-per-client-9e1c6b38`
Created: `2026-07-09T09:00:00.000Z`

<!-- marc-message
id: msg_9e1c6b3800000001
threadId: http-api-scoped-tokens-per-client-9e1c6b38
timestamp: 2026-07-09T09:04:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: a static token gives the browser UI and a third-party script the same powers. Each client should get its own token with its own scope.

<!-- /marc-message -->

<!-- marc-message
id: msg_9e1c6b3800000002
threadId: http-api-scoped-tokens-per-client-9e1c6b38
timestamp: 2026-07-10T11:45:00.000Z
agentId: fixture-developer
role: developer
-->

A token records its client name and a list of scopes, such as read accounts or write categories. Requests outside the scope return a forbidden response.

<!-- /marc-message -->

<!-- marc-message
id: msg_9e1c6b3800000003
threadId: http-api-scoped-tokens-per-client-9e1c6b38
timestamp: 2026-07-13T14:00:00.000Z
agentId: fixture-architect
role: architect
-->

Decision: tokens are issued by the CLI, stored hashed, and listed with their scopes. Revoking one does not affect the others.

<!-- /marc-message -->

<!-- marc-message
id: msg_9e1c6b3800000004
threadId: http-api-scoped-tokens-per-client-9e1c6b38
timestamp: 2026-07-14T10:20:00.000Z
agentId: fixture-developer
role: developer
-->

Done. Migration from the v1 static token keeps the old token working until the user revokes it.

<!-- /marc-message -->
