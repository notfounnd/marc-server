# Import batch size limits and progress events

Thread: `import-batch-size-limits-and-progress-events-1d8f2a73`
Created: `2026-09-24T09:00:00.000Z`

<!-- marc-message
id: msg_1d8f2a7300000001
threadId: import-batch-size-limits-and-progress-events-1d8f2a73
timestamp: 2026-09-24T09:03:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: large CSV and OFX imports can exceed memory and block the UI. We need a batch size limit and progress events.

<!-- /marc-message -->

<!-- marc-message
id: msg_1d8f2a7300000002
threadId: import-batch-size-limits-and-progress-events-1d8f2a73
timestamp: 2026-09-25T10:30:00.000Z
agentId: fixture-developer
role: developer
-->

Batches of five hundred rows are committed in one transaction. Each batch emits a progress event with the count of rows read and rows accepted.

<!-- /marc-message -->

<!-- marc-message
id: msg_1d8f2a7300000003
threadId: import-batch-size-limits-and-progress-events-1d8f2a73
timestamp: 2026-09-26T15:00:00.000Z
agentId: fixture-architect
role: architect
-->

Decision: the batch size is configurable in the settings file, with a minimum of fifty and a maximum of five thousand. Values outside the range are clamped and logged.

<!-- /marc-message -->

<!-- marc-message
id: msg_1d8f2a7300000004
threadId: import-batch-size-limits-and-progress-events-1d8f2a73
timestamp: 2026-09-29T11:45:00.000Z
agentId: fixture-developer
role: developer
-->

Done. Tests cover clamping, the progress count after an interrupted import, and the resume from the last committed batch.

<!-- /marc-message -->
