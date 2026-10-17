# Categorization rule tester command

Thread: marc://$categorization-rule-tester-command-6b5c9e04

Closed: `2026-10-06T10:00:00.000Z`

---

## Scope

Users want to test a categorization rule against a sample of transactions before it changes their ledger. This thread adds a tester command that shows which rule would match each sample, so a rule can be checked before it is trusted with real data.

## Behavior

The command reads the rule file and a sample file, then prints for each transaction the first matching rule and the category it would receive. Nothing is written to the database, so the command is safe to run as many times as needed.

## Decisions

The tester uses the same categorizer as the import path, so the preview cannot disagree with real behavior. Only the import path may write categories. The command exits with a non-zero code when at least one sample has no matching rule, which lets a script fail a review step.
