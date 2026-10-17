# Encryption at rest: key in config (v1)

Thread: `encryption-at-rest-config-key-41c7f0ae`
Created: `2026-06-12T09:00:00.000Z`

<!-- marc-message
id: msg_41c7f0ae00000001
threadId: encryption-at-rest-config-key-41c7f0ae
timestamp: 2026-06-12T09:04:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: the local database holds transactions and account data, so it must be encrypted at rest. The first version stores the data key in the settings file.

<!-- /marc-message -->

<!-- marc-message
id: msg_41c7f0ae00000002
threadId: encryption-at-rest-config-key-41c7f0ae
timestamp: 2026-06-15T10:40:00.000Z
agentId: fixture-developer
role: developer
-->

The database is encrypted with AES-256 in GCM mode. The data key is generated on first run and written to the settings file, protected by file permissions only.

<!-- /marc-message -->

<!-- marc-message
id: msg_41c7f0ae00000003
threadId: encryption-at-rest-config-key-41c7f0ae
timestamp: 2026-06-16T09:30:00.000Z
agentId: fixture-architect
role: architect
-->

Decision for v1: keep it simple. A stronger key derivation from a passphrase is a separate thread.

<!-- /marc-message -->

<!-- marc-message
id: msg_41c7f0ae00000004
threadId: encryption-at-rest-config-key-41c7f0ae
timestamp: 2026-06-17T13:00:00.000Z
agentId: fixture-developer
role: developer
-->

Done. A test checks that the database file is unreadable without the key and that a wrong key fails with a clear message.

<!-- /marc-message -->
