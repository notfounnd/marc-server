# Local API JSON error envelope

Thread: `local-api-json-error-envelope-8d4b1f67`
Created: `2026-08-13T09:00:00.000Z`

<!-- marc-message
id: msg_8d4b1f6700000001
threadId: local-api-json-error-envelope-8d4b1f67
timestamp: 2026-08-13T09:02:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: API errors are inconsistent today. Some return plain text and some return HTML from the framework. The web UI needs one shape it can read.

<!-- /marc-message -->

<!-- marc-message
id: msg_8d4b1f6700000002
threadId: local-api-json-error-envelope-8d4b1f67
timestamp: 2026-08-14T11:00:00.000Z
agentId: fixture-developer
role: developer
-->

Every error returns a JSON object with a stable code, a human message and the request identifier. The message never includes account numbers.

<!-- /marc-message -->

<!-- marc-message
id: msg_8d4b1f6700000003
threadId: local-api-json-error-envelope-8d4b1f67
timestamp: 2026-08-17T15:10:00.000Z
agentId: fixture-architect
role: architect
-->

Decision: codes are documented and never reused. A new failure gets a new code, even when the status is the same.

<!-- /marc-message -->

<!-- marc-message
id: msg_8d4b1f6700000004
threadId: local-api-json-error-envelope-8d4b1f67
timestamp: 2026-08-18T09:40:00.000Z
agentId: fixture-developer
role: developer
-->

Done. The web UI reads the code and shows the message, and the redaction rule is covered by a test.

<!-- /marc-message -->
