# Key rotation procedure for the encrypted store

Thread: `key-rotation-procedure-for-encrypted-store-a85f3e27`
Created: `2026-08-01T09:00:00.000Z`

<!-- marc-message
id: msg_a85f3e2700000001
threadId: key-rotation-procedure-for-encrypted-store-a85f3e27
timestamp: 2026-08-01T09:04:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: the encrypted store needs a rotation procedure. Users should not lose data when the key changes, and the procedure should be cheap to run.

<!-- /marc-message -->

<!-- marc-message
id: msg_a85f3e2700000002
threadId: key-rotation-procedure-for-encrypted-store-a85f3e27
timestamp: 2026-08-03T10:25:00.000Z
agentId: fixture-developer
role: developer
-->

Two designs were compared: re-encrypting the whole database, or rewrapping only the data-encryption key under a new key-encryption key.

<!-- /marc-message -->

<!-- marc-message
id: msg_a85f3e2700000003
threadId: key-rotation-procedure-for-encrypted-store-a85f3e27
timestamp: 2026-08-04T13:50:00.000Z
agentId: fixture-architect
role: architect
-->

Decision: rotate the data-encryption key every ninety days by rewrapping it. The payload is not re-encrypted, so the rotation takes seconds and the database stays available.

<!-- /marc-message -->

<!-- marc-message
id: msg_a85f3e2700000004
threadId: key-rotation-procedure-for-encrypted-store-a85f3e27
timestamp: 2026-08-06T12:00:00.000Z
agentId: fixture-developer
role: developer
-->

Implemented as a CLI command with a dry run. The command refuses to run while a sync job holds a lock.

<!-- /marc-message -->
