# CSV importer: bank export parsing (v1)

Thread: `csv-importer-bank-export-parsing-3a1f0c21`
Created: `2026-05-04T09:00:00.000Z`

<!-- marc-message
id: msg_3a1f0c2100000001
threadId: csv-importer-bank-export-parsing-3a1f0c21
timestamp: 2026-05-04T09:02:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: we need a CSV importer for bank exports. Scope is one file per statement period, parsed from the file that each bank provides. OFX is out of scope and belongs to a separate thread.

<!-- /marc-message -->

<!-- marc-message
id: msg_3a1f0c2100000002
threadId: csv-importer-bank-export-parsing-3a1f0c21
timestamp: 2026-05-04T11:30:00.000Z
agentId: fixture-developer
role: developer
-->

Plan: stream the file with a CSV parser, map the fixed columns (date, description, amount, balance) and reject rows without a valid date. The first bank profile is the Harbor Bank demo export, which uses semicolons.

<!-- /marc-message -->

<!-- marc-message
id: msg_3a1f0c2100000003
threadId: csv-importer-bank-export-parsing-3a1f0c21
timestamp: 2026-05-05T10:15:00.000Z
agentId: fixture-architect
role: architect
-->

Decision: amounts become integer minor units while the row is parsed, so no float reaches the ledger. The date format comes from the bank profile and is never guessed.

<!-- /marc-message -->

<!-- marc-message
id: msg_3a1f0c2100000004
threadId: csv-importer-bank-export-parsing-3a1f0c21
timestamp: 2026-05-06T16:40:00.000Z
agentId: fixture-developer
role: developer
-->

Done for v1. Tests cover the semicolon profile, the rejected-row case and negative amounts. Header detection goes to the v2 thread.

<!-- /marc-message -->
