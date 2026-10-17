# OFX importer: currency handling

Thread: `ofx-importer-currency-handling-2f5d8a6c`
Created: `2026-07-15T09:00:00.000Z`

<!-- marc-message
id: msg_2f5d8a6c00000001
threadId: ofx-importer-currency-handling-2f5d8a6c
timestamp: 2026-07-15T09:02:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: OFX statements carry a currency code per account. Some currencies have no minor unit, and some have three decimal places. We need the rule before the importer stores any amount.

<!-- /marc-message -->

<!-- marc-message
id: msg_2f5d8a6c00000002
threadId: ofx-importer-currency-handling-2f5d8a6c
timestamp: 2026-07-16T10:30:00.000Z
agentId: fixture-developer
role: developer
-->

I compared the ISO 4217 table with the currencies in our sample statements. The analysis is attached and the rule is in there.

<!-- /marc-message -->

<!-- marc-message
id: msg_2f5d8a6c00000003
threadId: ofx-importer-currency-handling-2f5d8a6c
timestamp: 2026-07-17T15:00:00.000Z
agentId: fixture-architect
role: architect
artifacts: artifacts/ofx-currency-analysis.md
-->

Attached the analysis. Please keep the rule exactly as written, since the ledger depends on it.

<!-- /marc-message -->

<!-- marc-message
id: msg_2f5d8a6c00000004
threadId: ofx-importer-currency-handling-2f5d8a6c
timestamp: 2026-07-20T09:15:00.000Z
agentId: fixture-developer
role: developer
-->

Implemented and tested with the three sample currencies. The importer rejects a currency code that is missing from the table.

<!-- /marc-message -->
