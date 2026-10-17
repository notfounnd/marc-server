# Retry policy for bank connector timeouts

Thread: `retry-policy-for-bank-connector-timeouts-4b3a9f20`
Created: `2026-07-21T09:00:00.000Z`

<!-- marc-message
id: msg_4b3a9f2000000001
threadId: retry-policy-for-bank-connector-timeouts-4b3a9f20
timestamp: 2026-07-21T09:04:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: bank connectors time out for reasons that clear up on their own. We need a retry policy that does not hide a broken connection.

<!-- /marc-message -->

<!-- marc-message
id: msg_4b3a9f2000000002
threadId: retry-policy-for-bank-connector-timeouts-4b3a9f20
timestamp: 2026-07-22T10:50:00.000Z
agentId: fixture-developer
role: developer
-->

Options on the table: retry at the next scheduled sync, retry immediately with a counter, or a fixed window with a cap. Each option changes how quickly a stale connection is shown to the user.

<!-- /marc-message -->

<!-- marc-message
id: msg_4b3a9f2000000003
threadId: retry-policy-for-bank-connector-timeouts-4b3a9f20
timestamp: 2026-07-23T14:20:00.000Z
agentId: fixture-architect
role: architect
-->

Decision: retry three times over a fifteen minute window, then mark the connection as stale. The stale state is shown in the UI until the next successful sync.

<!-- /marc-message -->

<!-- marc-message
id: msg_4b3a9f2000000004
threadId: retry-policy-for-bank-connector-timeouts-4b3a9f20
timestamp: 2026-07-24T16:30:00.000Z
agentId: fixture-developer
role: developer
-->

Implemented with a test that simulates three timeouts and then a success. The stale mark is cleared on the success.

<!-- /marc-message -->
