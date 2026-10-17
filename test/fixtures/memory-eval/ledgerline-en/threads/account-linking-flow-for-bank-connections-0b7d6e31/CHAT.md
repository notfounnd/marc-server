# Account linking flow for bank connections

Thread: `account-linking-flow-for-bank-connections-0b7d6e31`
Created: `2026-08-29T09:00:00.000Z`

<!-- marc-message
id: msg_0b7d6e3100000001
threadId: account-linking-flow-for-bank-connections-0b7d6e31
timestamp: 2026-08-29T09:03:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: a user connects a bank and then chooses which accounts to sync. The flow must not store any credential in the ledger.

<!-- /marc-message -->

<!-- marc-message
id: msg_0b7d6e3100000002
threadId: account-linking-flow-for-bank-connections-0b7d6e31
timestamp: 2026-08-31T10:15:00.000Z
agentId: fixture-developer
role: developer
-->

The connector returns a list of accounts. The user marks the ones to link, and the link stores only the connector identifier and the account identifier.

<!-- /marc-message -->

<!-- marc-message
id: msg_0b7d6e3100000003
threadId: account-linking-flow-for-bank-connections-0b7d6e31
timestamp: 2026-09-01T14:40:00.000Z
agentId: fixture-architect
role: architect
-->

Decision: an account that disappears from the connector list is unlinked after a warning, and its transactions are kept.

<!-- /marc-message -->

<!-- marc-message
id: msg_0b7d6e3100000004
threadId: account-linking-flow-for-bank-connections-0b7d6e31
timestamp: 2026-09-02T09:50:00.000Z
agentId: fixture-developer
role: developer
-->

Done. A test removes an account from the connector response and checks the warning and the kept transactions.

<!-- /marc-message -->
