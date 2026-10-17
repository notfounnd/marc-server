# Categorization rule tester command

Thread: `categorization-rule-tester-command-6b5c9e04`
Created: `2026-09-30T09:00:00.000Z`

<!-- marc-message
id: msg_6b5c9e0400000001
threadId: categorization-rule-tester-command-6b5c9e04
timestamp: 2026-09-30T09:02:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: users want to test a categorization rule against a sample of transactions before it changes their ledger. A tester command should show which rule would match.

<!-- /marc-message -->

<!-- marc-message
id: msg_6b5c9e0400000002
threadId: categorization-rule-tester-command-6b5c9e04
timestamp: 2026-10-01T10:10:00.000Z
agentId: fixture-developer
role: developer
-->

The command reads the rules file and a sample file, then prints for each transaction the first matching rule and the category it would receive. Nothing is written to the database.

<!-- /marc-message -->

<!-- marc-message
id: msg_6b5c9e0400000003
threadId: categorization-rule-tester-command-6b5c9e04
timestamp: 2026-10-02T14:20:00.000Z
agentId: fixture-architect
role: architect
-->

Decision: the tester uses the same matcher as the categorizer during import, so the preview cannot disagree with real behavior. Only the import path is allowed to write categories.

<!-- /marc-message -->

<!-- marc-message
id: msg_6b5c9e0400000004
threadId: categorization-rule-tester-command-6b5c9e04
timestamp: 2026-10-05T09:40:00.000Z
agentId: fixture-developer
role: developer
-->

Done. The command exits with success when every sample has a match and with code one, the business failure code defined in the CLI command structure, when at least one transaction has none.

<!-- /marc-message -->
