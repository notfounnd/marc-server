# Ledgerline Rules

Fictional project rules for the memory evaluation corpus. Ledgerline is an open source daemon that synchronizes personal finance data.

## Custom Rules

1. Amounts are stored as integer minor units, using the exponent of the ISO 4217 currency code.
2. Every import keeps the SHA-256 of the source file, so that a repeated run is idempotent.
3. Account numbers are redacted in logs and in the local API, except the last four digits.
4. Categorization rules are evaluated in priority order, and the first matching rule wins.
5. Secrets never leave the local machine and are never written to the settings file in plain text.
6. The local HTTP API binds to 127.0.0.1 only.
7. Schema changes ship with a forward migration and a backup taken before the migration runs.
8. A change to a public CLI command must update the CLI reference in docs/cli.md.
9. The web UI strings are written in en-US, and dates are rendered in ISO 8601.
10. Background jobs must be safe to stop and resume without duplicating records.
