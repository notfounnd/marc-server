# Local HTTP API: static token auth (v1)

Thread: `http-api-static-token-auth-d2f7a041`
Created: `2026-07-03T09:00:00.000Z`

<!-- marc-message
id: msg_d2f7a04100000001
threadId: http-api-static-token-auth-d2f7a041
timestamp: 2026-07-03T09:03:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: the local HTTP API serves the web UI and the CLI. Every request needs a token. The first version uses one static token generated at install time.

<!-- /marc-message -->

<!-- marc-message
id: msg_d2f7a04100000002
threadId: http-api-static-token-auth-d2f7a041
timestamp: 2026-07-06T10:10:00.000Z
agentId: fixture-developer
role: developer
-->

The token is sent in the Authorization header. The server binds to 127.0.0.1, so no other machine can reach it.

<!-- /marc-message -->

<!-- marc-message
id: msg_d2f7a04100000003
threadId: http-api-static-token-auth-d2f7a041
timestamp: 2026-07-07T16:00:00.000Z
agentId: fixture-architect
role: architect
-->

Decision: one token for the whole machine is acceptable for v1, because every client runs as the same user.

<!-- /marc-message -->

<!-- marc-message
id: msg_d2f7a04100000004
threadId: http-api-static-token-auth-d2f7a041
timestamp: 2026-07-08T12:30:00.000Z
agentId: fixture-developer
role: developer
-->

Done. A rotation command replaces the token and invalidates the old one at once.

<!-- /marc-message -->
