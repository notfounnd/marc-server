# Benchmark SQLite storage for transactions

Thread: `benchmark-sqlite-storage-for-transactions-e07d5c18`
Created: `2026-07-27T09:00:00.000Z`

<!-- marc-message
id: msg_e07d5c1800000001
threadId: benchmark-sqlite-storage-for-transactions-e07d5c18
timestamp: 2026-07-27T09:03:00.000Z
agentId: fixture-architect
role: architect
-->

Opening: we need to know whether SQLite holds the expected volume of transactions with acceptable latency on the reference laptop.

<!-- /marc-message -->

<!-- marc-message
id: msg_e07d5c1800000002
threadId: benchmark-sqlite-storage-for-transactions-e07d5c18
timestamp: 2026-07-28T11:10:00.000Z
agentId: fixture-developer
role: developer
-->

The benchmark loads synthetic transactions in batches and then runs the list queries the UI uses. The measurements are in the attached file.

<!-- /marc-message -->

<!-- marc-message
id: msg_e07d5c1800000003
threadId: benchmark-sqlite-storage-for-transactions-e07d5c18
timestamp: 2026-07-29T15:30:00.000Z
agentId: fixture-architect
role: architect
artifacts: artifacts/storage-benchmark.md
-->

Attached the benchmark. The numbers decide the question, not the summary of the thread.

<!-- /marc-message -->

<!-- marc-message
id: msg_e07d5c1800000004
threadId: benchmark-sqlite-storage-for-transactions-e07d5c18
timestamp: 2026-07-30T09:45:00.000Z
agentId: fixture-developer
role: developer
-->

Conclusion recorded. SQLite stays as the storage engine for this version. The index plan follows from the read latency.

<!-- /marc-message -->
