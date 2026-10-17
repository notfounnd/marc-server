# Logging redaction of account numbers

Thread: marc://$logging-redaction-of-account-numbers-a2c8f750

Closed: `2026-09-09T10:00:00.000Z`

---

## Scope

Debug logs printed full account numbers during an import, and support bundles are built from those logs. Support bundles must never contain a full account number, so the logging path needed a single control point. This thread defines that control point and the test that proves the rule holds.

## Filter

A logger filter replaces every account number with its last four digits before the line is written. The filter runs for every level, including debug, so no level can leak a full number. Because the replacement happens before the write, a log file that is copied or uploaded never holds the complete value.

## Decisions

The filter is one module used by the command line interface, the daemon and the API. No output path can skip it, which keeps the rule in one place for review. The module is covered by a test that feeds a sample import through all three outputs and searches the captured text for a full number.

## Outcome

The thread closed after that search found no full number in any of the three outputs. The rule is now part of the review checklist for changes to logging.
