# Snapshot retention notes

Snapshots are kept at full daily detail for ninety days. Older snapshots are compacted into one value per month, which keeps the shape of the balance chart with a small fraction of the rows.

Compaction runs as a background job. The job is safe to stop, because each month is written in one transaction and the source days are removed only after the write commits.
