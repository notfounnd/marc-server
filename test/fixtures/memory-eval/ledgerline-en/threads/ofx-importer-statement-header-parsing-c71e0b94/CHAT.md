# OFX importer statement header parsing

Thread: `ofx-importer-statement-header-parsing-c71e0b94`
Created: `2026-10-13T09:00:00.000Z`

<!-- marc-message
id: msg_c71e0b9400000001
threadId: ofx-importer-statement-header-parsing-c71e0b94
timestamp: 2026-10-13T09:03:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: some banks put a header with the account and the period above the transactions in each statement file. The importer must read that header before it reads the transactions.

<!-- /marc-message -->

<!-- marc-message
id: msg_c71e0b9400000002
threadId: ofx-importer-statement-header-parsing-c71e0b94
timestamp: 2026-10-14T10:05:00.000Z
agentId: fixture-developer
role: developer
-->

The header parser reads the account identifier, the currency and the period. A statement whose period overlaps an earlier import is flagged for review, not rejected.

<!-- /marc-message -->

<!-- marc-message
id: msg_c71e0b9400000003
threadId: ofx-importer-statement-header-parsing-c71e0b94
timestamp: 2026-10-15T13:30:00.000Z
agentId: fixture-architect
role: architect
-->

Decision: the account identifier from the header is compared with the linked account. A mismatch stops the import with a clear message that names both accounts.

<!-- /marc-message -->

<!-- marc-message
id: msg_c71e0b9400000004
threadId: ofx-importer-statement-header-parsing-c71e0b94
timestamp: 2026-10-16T09:50:00.000Z
agentId: fixture-developer
role: developer
-->

Done. Tests cover a header with a missing period and a header whose account does not match the linked one.

<!-- /marc-message -->
