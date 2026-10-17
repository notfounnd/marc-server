# Account linking flow for bank connections

Thread: marc://$account-linking-flow-for-bank-connections-0b7d6e31

Closed: `2026-09-03T10:00:00.000Z`

---

## Scope

A user connects a bank and then chooses which accounts to sync. The flow must not store any credential inside the ledger, so the ledger only keeps identifiers for the connection. This thread defines what is stored, what the user sees while linking and what happens when the bank stops listing an account.

## Flow

The connector returns the list of accounts that the bank exposes for the connection. The user marks the ones to link, and the link stores only the connector identifier and the account identifier. Nothing else from the connector response is persisted, which keeps the ledger free of the bank's session details.

## Decisions

An account that disappears from the connector list is unlinked after a warning, and its transactions are kept. The warning tells the user that the account is no longer reachable through the connector, and the user can relink it later if the bank restores access. Keeping the transactions protects the history from an unrelated bank change.

## Outcome

A test removes an account from a connector response and checks the warning and that the transactions remain in the ledger. The thread closed after that test passed.
