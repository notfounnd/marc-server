# Ledgerline fixture design notes

This file documents the design of the `ledgerline-en` fixture for the memory evaluation tests. It is not a thread and is not indexed as one. It lists the traps the fixture contains so that a test can check that the search finds them, and so that a later change to the fixture keeps them.

## Scope

The fixture has 33 thread folders under `threads/`. Thirty threads are closed and have a `SUMMARY.md`. Three threads are open (`multi-currency-reconciliation-plan-1a2b3c4d`, `mobile-companion-app-scoping-5e6f7a8b` and `evaluate-lmdb-versus-sqlite-indexing-9c0d1e2f`) and have no `SUMMARY.md`.

## Near-duplicate pairs

Each pair covers the same subject with a first version and a later version. A query for the subject should find both threads, and the later version should be preferred when the query asks for the current behavior.

| Pair                 | First version                                       | Later version                                               |
| -------------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| CSV import           | `csv-importer-bank-export-parsing-3a1f0c21`         | `csv-importer-column-mapping-and-header-detection-7b92e4d0` |
| Categorization rules | `categorization-rules-regex-first-version-5c8e1a77` | `categorization-rules-priority-ordering-0d4f9b13`           |
| Sync scheduling      | `sync-scheduler-fixed-interval-e2a6c590`            | `sync-scheduler-exponential-backoff-88f1d2b4`               |
| Encryption at rest   | `encryption-at-rest-config-key-41c7f0ae`            | `encryption-at-rest-passphrase-derived-key-c39e5d62`        |
| Web UI transactions  | `web-ui-transactions-paged-list-6a0b7f15`           | `web-ui-transactions-virtual-scrolling-b4e8c293`            |
| HTTP API auth        | `http-api-static-token-auth-d2f7a041`               | `http-api-scoped-tokens-per-client-9e1c6b38`                |

## Layer threads

In these four threads the decisive information is not in the first lines of the `CHAT.md`. It is in an artifact or in a later message, so a search that reads only the thread title or the summary misses it.

| Thread                                                | Where the decisive text is           | Literal excerpt                                                                     |
| ----------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------- |
| `ofx-importer-currency-handling-2f5d8a6c`             | `artifacts/ofx-currency-analysis.md` | "it never rounds a value that has more digits than the exponent allows"             |
| `retry-policy-for-bank-connector-timeouts-4b3a9f20`   | `CHAT.md`, decision message          | "retry three times over a fifteen minute window, then mark the connection as stale" |
| `benchmark-sqlite-storage-for-transactions-e07d5c18`  | `artifacts/storage-benchmark.md`     | "At 500,000 rows the p95 read latency is 180 ms"                                    |
| `key-rotation-procedure-for-encrypted-store-a85f3e27` | `CHAT.md`, decision message          | "rotate the data-encryption key every ninety days by rewrapping it"                 |

## Concept drift

Three concepts are named differently across threads. A query that uses one name should still reach the threads that use the other names.

| Concept          | Names used       | Threads                                                                                                |
| ---------------- | ---------------- | ------------------------------------------------------------------------------------------------------ |
| Categorization   | "rules engine"   | `categorization-rules-regex-first-version-5c8e1a77`, `categorization-rules-priority-ordering-0d4f9b13` |
| Categorization   | "categorizer"    | `categorization-rule-tester-command-6b5c9e04`                                                          |
| Bank file import | "bank export"    | `csv-importer-bank-export-parsing-3a1f0c21`                                                            |
| Bank file import | "statement file" | `ofx-importer-statement-header-parsing-c71e0b94`                                                       |
| Scheduled sync   | "sync job"       | `sync-scheduler-fixed-interval-e2a6c590`                                                               |
| Scheduled sync   | "refresh cycle"  | `sync-scheduler-exponential-backoff-88f1d2b4`                                                          |
