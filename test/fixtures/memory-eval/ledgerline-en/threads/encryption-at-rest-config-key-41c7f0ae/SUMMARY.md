# Encryption at rest: key in config (v1)

Thread: marc://$encryption-at-rest-config-key-41c7f0ae

Closed: `2026-06-18T10:00:00.000Z`

---

## Scope

The local database holds transactions and account data, so it must be encrypted at rest. The first version stores the data key in the settings file, which is the simplest design that meets the requirement for a single user on a personal machine. The thread records the trade-off openly, because the design protects the database only as far as the settings file is protected.

## Design

The database is encrypted with AES-256 in GCM mode, which gives both confidentiality and integrity for each stored value. The data key is generated on the first run and written to the settings file. The file is protected by operating system permissions only, and that is the weakness this version accepts in exchange for a simple startup.

## Decisions

This version keeps the design simple on purpose. A stronger key derivation from a passphrase is a separate thread, because it changes the startup flow for every user and needs its own review. Until that thread is finished, the settings file must be treated as sensitive, and the documentation should say so.

## Outcome

The thread closed after two tests were added. One checks that the database file cannot be read without the key, and the other checks that a wrong key fails with a clear message instead of a crash.
