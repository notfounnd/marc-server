# OFX importer statement header parsing

Thread: marc://$ofx-importer-statement-header-parsing-c71e0b94

Closed: `2026-10-19T10:00:00.000Z`

---

## Scope

Some banks place a header with the account and the period above the transactions in each statement file. The OFX importer must read that header before it reads any transaction, so that the statement is matched to the right account and the right period. This thread defines the header handling and its checks.

## Header

The header parser reads the account identifier, the currency and the period. A statement whose period overlaps an earlier import is flagged for review rather than rejected, because overlaps are common when banks reissue statements that already partly overlap an earlier file.

## Decisions

The account identifier from the header is compared with the linked account. A mismatch stops the import with a clear message that names both accounts, so the user can see the problem before anything is written. Tests cover a header with a missing period and a header whose account does not match the linked one.
