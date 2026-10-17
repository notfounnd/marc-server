# OFX importer: currency handling

Thread: marc://$ofx-importer-currency-handling-2f5d8a6c

Closed: `2026-07-21T10:00:00.000Z`

---

## Scope

OFX statements carry a currency code for each account, and the importer must know how each currency is written before it stores any amount. The importer cannot store an amount until it knows the currency that the amount belongs to. This thread defines the handling of the currency codes before the first amount is written to the ledger.

## Analysis

The thread compared the ISO 4217 table with the currencies found in the sample statements. The comparison was written as an analysis and attached to the thread for review, so the reasoning can be checked against the sample files. The analysis is the reference for the rule that the importer applies to each amount.

## Outcome

The importer was implemented and tested with three sample currencies. A currency code that is missing from the table is rejected rather than guessed, so an unknown currency can never reach the ledger silently. The thread closed after the implementation passed its tests.
