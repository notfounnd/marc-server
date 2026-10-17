# Categorization rules: regex matching (v1)

Thread: marc://$categorization-rules-regex-first-version-5c8e1a77

Closed: `2026-05-27T09:00:00.000Z`

---

## Scope

Transactions need a category before the user can review spending, and this thread starts the first version of the categorization feature. The categorization uses a rules engine in which each rule is a regular expression over the transaction description, paired with a target category. The thread defined only this basic mechanism, so that the matching behavior is clear before any ordering or priority is added.

## Matching

The rules engine compiles each pattern once, when the rule file loads, so matching many transactions does not repeat the compilation. Matching is case-insensitive and runs over the normalized description, with accents removed, so a pattern written without accents still matches a description that has them. Rules with invalid patterns are reported at load time and skipped, which means one broken line in the file does not stop the other rules from working.

## Decisions

A transaction with no matching rule stays uncategorized and appears in a review list. The engine never guesses a category from the amount, because the same amount can belong to very different purchases. The ordering between rules was left undefined in this version, and the next version of the rules engine covers that gap with explicit priorities.

## Outcome

The thread closed after tests covered invalid patterns, the normalization of accents and the uncategorized case. Those tests are the baseline that the later ordering work must keep passing.
