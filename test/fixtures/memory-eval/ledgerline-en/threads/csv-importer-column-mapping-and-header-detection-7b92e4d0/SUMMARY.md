# CSV importer: column mapping and header detection (v2)

Thread: marc://$csv-importer-column-mapping-and-header-detection-7b92e4d0

Closed: `2026-05-22T09:00:00.000Z`

---

## Scope

This thread extended the CSV importer so that a file with an unknown or unusual header can still be imported. It builds directly on the bank export parser from version one and changes only how columns are found and mapped. The parsing rules of version one stay in force, including the rejection of rows without a valid date and the integer handling of amounts, so this change cannot weaken the guarantees already in place.

## Detection

Headers are detected by content rather than by position. The detector reads the first ten rows and scores each column against the known names for date, description, amount and balance. Names are normalized before the comparison, which removes case and accents. Blank lines before the header are skipped, so a bank that prints a title or an empty line above its columns still works.

## Decisions

A mapping is saved to the bank profile only after the user confirms it. Unconfirmed mappings are never reused on a later import, even when the file looks identical, because a single mismatched column could put amounts into the description field. The eight fixture variants that cover the layouts seen so far are attached to the thread as an artifact for future reference.

## Outcome

All eight variants pass, including the bank whose export prints a title line above the header. The thread closed after that result was recorded, and the fixtures remain the reference for any later change to detection.
