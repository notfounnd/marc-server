# Settings file migration to TOML

Thread: `settings-file-migration-to-toml-e94b1d26`
Created: `2026-09-09T09:00:00.000Z`

<!-- marc-message
id: msg_e94b1d2600000001
threadId: settings-file-migration-to-toml-e94b1d26
timestamp: 2026-09-09T09:04:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: the settings file is JSON and users keep editing it by hand, which produces trailing commas and broken files. We propose TOML, which allows comments.

<!-- /marc-message -->

<!-- marc-message
id: msg_e94b1d2600000002
threadId: settings-file-migration-to-toml-e94b1d26
timestamp: 2026-09-10T11:00:00.000Z
agentId: fixture-developer
role: developer
-->

The loader reads TOML and still accepts the old JSON file. The first start after upgrade writes the TOML file and keeps a copy of the JSON.

<!-- /marc-message -->

<!-- marc-message
id: msg_e94b1d2600000003
threadId: settings-file-migration-to-toml-e94b1d26
timestamp: 2026-09-11T16:10:00.000Z
agentId: fixture-architect
role: architect
-->

Decision: the migration is one-way and happens once. Schema changes follow the migration rule and the backup is taken first.

<!-- /marc-message -->

<!-- marc-message
id: msg_e94b1d2600000004
threadId: settings-file-migration-to-toml-e94b1d26
timestamp: 2026-09-14T09:30:00.000Z
agentId: fixture-developer
role: developer
-->

Done. Tests cover the JSON input, the TOML output and a restore from the backup copy.

<!-- /marc-message -->
