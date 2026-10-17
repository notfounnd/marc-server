# CSV importer: bank export parsing (v1)

Thread: marc://$csv-importer-bank-export-parsing-3a1f0c21

Closed: `2026-05-07T10:00:00.000Z`

---

## Scope

This thread defined the first CSV importer for bank exports. Each file covers one statement period and is the file that the bank itself provides for download. OFX files are outside this thread, because they have their own structure and belong to a separate thread that covers the OFX importer. The goal of version one is narrow: read a bank export reliably, reject what cannot be trusted, and leave header detection and column mapping for a later version.

## Parsing

The importer streams the file with a CSV parser so that large exports never load fully into memory. It maps four fixed columns, which are date, description, amount and balance. A row without a valid date is rejected and reported with its line number, so the user can see exactly what was left out. The first bank profile is the Harbor Bank demo export, which uses semicolons as separators instead of commas.

## Decisions

Amounts become integer minor units while each row is parsed, so no floating point value reaches the ledger. The date format comes from the bank profile and is never guessed from the data, because a guessed format can silently swap day and month. Header detection was moved to the next thread, which keeps this version small and easy to test.

## Outcome

The thread closed after the tests covered the semicolon profile, the rejected row case and negative amounts. Those three cases define the behavior that version two must keep unchanged.
