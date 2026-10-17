# Encryption at rest: passphrase-derived key (v2)

Thread: `encryption-at-rest-passphrase-derived-key-c39e5d62`
Created: `2026-06-18T09:00:00.000Z`

<!-- marc-message
id: msg_c39e5d6200000001
threadId: encryption-at-rest-passphrase-derived-key-c39e5d62
timestamp: 2026-06-18T09:03:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: a data key stored next to the database protects nothing if the machine is copied. This version derives the key from a passphrase that the user types at startup.

<!-- /marc-message -->

<!-- marc-message
id: msg_c39e5d6200000002
threadId: encryption-at-rest-passphrase-derived-key-c39e5d62
timestamp: 2026-06-19T15:10:00.000Z
agentId: fixture-developer
role: developer
-->

The key is derived with a memory-hard function. The parameters, salt and iteration cost are in the attached file, and they are stored in the database header.

<!-- /marc-message -->

<!-- marc-message
id: msg_c39e5d6200000003
threadId: encryption-at-rest-passphrase-derived-key-c39e5d62
timestamp: 2026-06-22T11:20:00.000Z
agentId: fixture-architect
role: architect
-->

Decision: the passphrase is never stored. A lost passphrase means lost data, and the UI says so before the user confirms it.

<!-- /marc-message -->

<!-- marc-message
id: msg_c39e5d6200000004
threadId: encryption-at-rest-passphrase-derived-key-c39e5d62
timestamp: 2026-06-23T16:45:00.000Z
agentId: fixture-developer
role: developer
-->

Done. Startup takes longer on purpose; the measured delay is in the attached file.

<!-- /marc-message -->

<!-- marc-message
id: msg_c39e5d6200000005
threadId: encryption-at-rest-passphrase-derived-key-c39e5d62
timestamp: 2026-06-23T17:10:00.000Z
agentId: fixture-architect
role: architect
artifacts: artifacts/kdf-parameters.md
-->

Attached the parameters used by the release build.

<!-- /marc-message -->
