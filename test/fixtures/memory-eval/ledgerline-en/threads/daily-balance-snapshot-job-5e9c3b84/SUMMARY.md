# Daily balance snapshot job

Thread: marc://$daily-balance-snapshot-job-5e9c3b84

Closed: `2026-08-31T10:00:00.000Z`

---

## Scope

The balance chart needs one value per account per day. Computing the value from all transactions on each view is too slow for long histories, so a job writes the values ahead of time. The chart then reads a small table instead of replaying the full ledger, which keeps the view responsive for users with many years of data.

## Job

The job writes one snapshot per account at the end of each day. Missing days are filled from the last snapshot, so the chart has no gaps. The job can resume after an interruption without writing a day twice, and a restart test stops the job halfway through a run to check this behavior.

## Retention

Retention notes are attached to the thread as an artifact. Snapshots older than the retention window are compacted instead of deleted, so the chart keeps its shape over long periods while the table stays small. The thread closed after the restart test passed and the retention notes were reviewed.
