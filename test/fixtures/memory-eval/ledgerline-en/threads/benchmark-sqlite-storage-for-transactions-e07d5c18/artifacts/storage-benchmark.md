# Storage benchmark results

Synthetic data on the reference laptop. Read latency is measured for the list query used by the paged UI, with the default index.

| Rows    | Read latency p50 | Read latency p95 | Batch of 1,000 rows, write time |
| ------- | ---------------- | ---------------- | ------------------------------- |
| 50,000  | 22 ms            | 60 ms            | 0.3 s                           |
| 200,000 | 41 ms            | 120 ms           | 0.6 s                           |
| 500,000 | 74 ms            | 180 ms           | 0.9 s                           |

At 500,000 rows the p95 read latency is 180 ms, which is within the budget of 250 ms for the list. Write batches of 1,000 rows take 0.9 s, so the sync jobs finish within their interval.
