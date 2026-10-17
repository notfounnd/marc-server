# Settings file migration to TOML

Thread: marc://$settings-file-migration-to-toml-e94b1d26

Closed: `2026-09-15T10:00:00.000Z`

---

## Scope

The settings file is JSON, and users keep editing it by hand. That produces trailing commas, missing quotes and broken files that stop the daemon from starting. The thread proposes TOML, which allows comments and is easier to read and edit by hand, so the file can document itself.

## Migration

The loader reads TOML and still accepts the old JSON file. On the first start after the upgrade, the TOML file is written and a copy of the JSON is kept beside it. The migration is one-way and happens only once, so the loader never converts a TOML file back to JSON.

## Decisions

A backup is taken before any schema change, and schema changes follow the migration rule of the project. Tests cover the JSON input, the TOML output and a restore from the backup copy. The restore path was checked on a file with comments, because comments are the main reason for the change.

## Outcome

The thread closed after the tests passed and the restore from the backup copy was confirmed on a sample file.
