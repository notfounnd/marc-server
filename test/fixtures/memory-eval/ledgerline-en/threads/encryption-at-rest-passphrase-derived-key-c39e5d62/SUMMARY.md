# Encryption at rest: passphrase-derived key (v2)

Thread: marc://$encryption-at-rest-passphrase-derived-key-c39e5d62

Closed: `2026-06-24T10:00:00.000Z`

---

## Scope

A data key stored next to the database protects nothing when the machine is copied, because anyone with the files can open the database. This version derives the key from a passphrase that the user types at startup, which replaces the settings-file design of the first version. The change affects the startup flow, so it is reviewed separately from the rest of the storage work.

## Derivation

The key is derived with a memory-hard function, which makes guessing passphrases expensive for an attacker who has a copy of the files. The salt, the iteration cost and the other parameters are stored in the database header, so the database can be opened later without any other file. The parameters used by the release build are attached to the thread as an artifact.

## Decisions

The passphrase is never stored anywhere on disk. A lost passphrase means lost data, and the interface states this before the user confirms the new passphrase, so nobody sets one without understanding the consequence. Startup takes longer on purpose, and the measured delay is recorded in the attached file rather than in this summary.

## Outcome

The thread closed after the release parameters were attached to the thread. The version one settings-file key is removed in the same release, and the migration to the new header is covered by the migration rule of the project.
