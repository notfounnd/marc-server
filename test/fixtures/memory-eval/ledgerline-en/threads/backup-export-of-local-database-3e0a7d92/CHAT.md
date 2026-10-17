# Backup export of local database

Thread: `backup-export-of-local-database-3e0a7d92`
Created: `2026-10-06T09:00:00.000Z`

<!-- marc-message
id: msg_3e0a7d9200000001
threadId: backup-export-of-local-database-3e0a7d92
timestamp: 2026-10-06T09:04:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: users ask for a copy of their local database that they can keep outside the machine. The export must not contain the key in plain text.

<!-- /marc-message -->

<!-- marc-message
id: msg_3e0a7d9200000002
threadId: backup-export-of-local-database-3e0a7d92
timestamp: 2026-10-07T11:00:00.000Z
agentId: fixture-developer
role: developer
-->

The export writes a single archive with the database file and the settings file. The encryption key inside it stays wrapped by the passphrase, and the archive is written to a path chosen by the user.

<!-- /marc-message -->

<!-- marc-message
id: msg_3e0a7d9200000003
threadId: backup-export-of-local-database-3e0a7d92
timestamp: 2026-10-08T16:15:00.000Z
agentId: fixture-architect
role: architect
-->

Decision: the export refuses to overwrite an existing file. A manifest with the SHA-256 of each entry is written inside the archive.

<!-- /marc-message -->

<!-- marc-message
id: msg_3e0a7d9200000004
threadId: backup-export-of-local-database-3e0a7d92
timestamp: 2026-10-12T10:25:00.000Z
agentId: fixture-developer
role: developer
-->

Done. Tests restore an archive into an empty directory and compare the manifest hashes with the restored files.

<!-- /marc-message -->
