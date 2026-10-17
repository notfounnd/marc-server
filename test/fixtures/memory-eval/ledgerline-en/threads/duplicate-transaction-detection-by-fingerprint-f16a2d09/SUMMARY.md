# Duplicate transaction detection by fingerprint

Thread: marc://$duplicate-transaction-detection-by-fingerprint-f16a2d09

Closed: `2026-08-25T10:00:00.000Z`

---

## Scope

Overlapping statements and repeated syncs import the same transaction twice. This thread defines a fingerprint that identifies a transaction across imports, so duplicates can be found without asking the bank for anything more. The fingerprint must be stable for the same transaction and must differ when two transactions only look alike.

## Fingerprint

The fingerprint combines the account, the booking date, the amount in minor units and the normalized description. Bank references are used when the bank provides them, because a reference is the strongest identifier available. A transaction with the same fingerprint as an existing one is a candidate duplicate and is compared before any decision is made.

## Decisions

A duplicate is skipped and counted, never merged, so the stored record stays exactly as the bank reported it. A transaction with the same fingerprint but a different amount is kept and flagged for review, because the bank may have corrected one of the two records. The import report shows the count of skipped duplicates and the list of flagged pairs.
