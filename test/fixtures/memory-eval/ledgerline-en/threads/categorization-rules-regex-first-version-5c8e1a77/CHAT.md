# Categorization rules: regex matching (v1)

Thread: `categorization-rules-regex-first-version-5c8e1a77`
Created: `2026-05-22T09:00:00.000Z`

<!-- marc-message
id: msg_5c8e1a7700000001
threadId: categorization-rules-regex-first-version-5c8e1a77
timestamp: 2026-05-22T09:02:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: transactions need a category. The first version uses a rules engine where each rule is a regular expression over the description, plus a target category.

<!-- /marc-message -->

<!-- marc-message
id: msg_5c8e1a7700000002
threadId: categorization-rules-regex-first-version-5c8e1a77
timestamp: 2026-05-23T13:40:00.000Z
agentId: fixture-developer
role: developer
-->

The rules engine compiles each pattern once when the rule file loads. Matching is case-insensitive and runs over the normalized description, without accents.

<!-- /marc-message -->

<!-- marc-message
id: msg_5c8e1a7700000003
threadId: categorization-rules-regex-first-version-5c8e1a77
timestamp: 2026-05-25T10:20:00.000Z
agentId: fixture-architect
role: architect
-->

Decision: a transaction with no matching rule stays uncategorized. The engine never guesses from the amount.

<!-- /marc-message -->

<!-- marc-message
id: msg_5c8e1a7700000004
threadId: categorization-rules-regex-first-version-5c8e1a77
timestamp: 2026-05-26T15:00:00.000Z
agentId: fixture-developer
role: developer
-->

Done. Rules with invalid patterns are reported at load time and skipped. Ordering between rules is not defined yet, which the v2 thread covers.

<!-- /marc-message -->
