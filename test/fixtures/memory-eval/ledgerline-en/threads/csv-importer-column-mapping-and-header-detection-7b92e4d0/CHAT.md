# CSV importer: column mapping and header detection (v2)

Thread: `csv-importer-column-mapping-and-header-detection-7b92e4d0`
Created: `2026-05-18T09:00:00.000Z`

<!-- marc-message
id: msg_7b92e4d000000001
threadId: csv-importer-column-mapping-and-header-detection-7b92e4d0
timestamp: 2026-05-18T09:03:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: extend the CSV importer so a file with an unknown header can still be imported. Headers are detected by content, not by position. This builds on the v1 bank export thread.

<!-- /marc-message -->

<!-- marc-message
id: msg_7b92e4d000000002
threadId: csv-importer-column-mapping-and-header-detection-7b92e4d0
timestamp: 2026-05-19T14:10:00.000Z
agentId: fixture-developer
role: developer
-->

Detection reads the first ten rows and scores each column against the known names for date, description, amount and balance. Names are normalized before the comparison. A confirmed mapping is saved in the bank profile.

<!-- /marc-message -->

<!-- marc-message
id: msg_7b92e4d000000003
threadId: csv-importer-column-mapping-and-header-detection-7b92e4d0
timestamp: 2026-05-20T11:25:00.000Z
agentId: fixture-architect
role: architect
artifacts: artifacts/column-mapping-fixtures.md
-->

Decision: a mapping is saved only after the user confirms it. Unconfirmed mappings are never reused. The eight fixture variants are attached.

<!-- /marc-message -->

<!-- marc-message
id: msg_7b92e4d000000004
threadId: csv-importer-column-mapping-and-header-detection-7b92e4d0
timestamp: 2026-05-21T16:05:00.000Z
agentId: fixture-developer
role: developer
-->

Done. The eight variants pass, including the bank that prints a title line above its header. Blank lines before the header are skipped.

<!-- /marc-message -->
