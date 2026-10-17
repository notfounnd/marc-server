# Backup export of local database

Thread: marc://$backup-export-of-local-database-3e0a7d92

Closed: `2026-10-13T10:00:00.000Z`

---

## Scope

Users ask for a copy of their local database that they can keep outside the machine, for example on an external drive or in a personal backup service. The export must not contain the encryption key in plain text, which shapes the whole design of the command.

## Archive

The export writes a single archive with the database file and the settings file. The encryption key inside the archive stays wrapped by the passphrase, so the archive alone does not reveal the key. The archive is written to a path that the user chooses, and the command reports that path when it finishes.

## Decisions

The export refuses to overwrite an existing file, so a previous backup is never lost by accident. A manifest with the SHA-256 of each entry is written inside the archive, so a later restore can check each file. Tests restore an archive into an empty directory and compare the manifest hashes with the restored files.
