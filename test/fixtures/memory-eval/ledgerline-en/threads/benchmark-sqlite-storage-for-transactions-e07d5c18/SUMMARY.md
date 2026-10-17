# Benchmark SQLite storage for transactions

Thread: marc://$benchmark-sqlite-storage-for-transactions-e07d5c18

Closed: `2026-07-31T10:00:00.000Z`

---

## Scope

This thread asked whether SQLite holds the expected volume of transactions with acceptable latency on the reference laptop. The question matters because the storage choice shapes every later decision about indexes and the list queries. The thread answers it with synthetic data rather than with a sample from a real user, so the result is repeatable.

## Method

The benchmark loads synthetic transactions in batches and then runs the list queries that the interface uses. Latency is measured for the list query, so the numbers reflect what users will wait for. The full measurements, with the table of results and the setup of the run, were attached to the thread as an artifact.

## Outcome

The thread recorded a conclusion for the storage engine and a follow-up item for the index plan, and the index plan depends on the read latency reported in the attachment. The conclusion was recorded after the numbers were reviewed. The thread closed after that review.
