# 0013 - memory_deep returns scoped passages with a reranker budget of 232

## Decision

`memory_deep` has two modes.

- **Scoped (`threadId` given).** The thread must be closed and indexed. Its passages in the layers present form the scope, optionally filtered by `sourceTypes` (summary, artifact or chat). When the scope holds at most 232 passages, all of them go to the reranker. Otherwise the 232 passages with the highest cosine similarity to the query go to the reranker, and the result reports `scopeTruncated: true`. The results carry no `groupBand`.
- **Unscoped (no `threadId`).** The search runs the depth-2 pool. It keeps the passages of the groups that the pool admits, and each hit carries its group's band (ADR 0011). `sourceTypes` filters the output only. The `abstained` flag is set only in this mode.

Both modes return one hit per `passageId`, the first occurrence in score order.

The budget of 232 is the E3 budget, applied to the scoped path of `memory_deep` only. The decision is conditioned on the evaluation in the context below. It does not adopt the funnel that ADR 0012 keeps out of production.

## Context

Agents recall historical decisions through `memory_recall`, which returns closed-thread summaries (ADR 0012 describes the depth of that search). When a recalled thread is closed and its summary lacks the detail that the agent needs, the agent had to read the whole `CHAT.md`. E4 adds `memory_deep`, which returns passages with full provenance: for a thread that the agent has already chosen, or for evidence without a thread.

The E3 study fixed a budget of 232 reranker pairs (B), which it measured within 1.2 times the M0 median on the reference machine. E4 evaluates that budget on marc-deep, a corpus of 62 closed threads: the 56 threads of marc plus six more. Its 14 cases are 10 scoped to a thread and 4 unscoped.

The evaluation gave these results:

- `DEEP`, with budget 232: Success@5 13 of 14, MRR@5 0.738, P@5 0.571, zero incomplete cases, and 100 percent scope conformance. `DEEP_ALL`, with no budget, has the same three metrics. The two are not identical: in case D14 the top five differ, with the same outcome.
- The one failure, D03, is classified as `ordering`. The CHAT evidence is at position 10 of the DEEP output, which holds the 18 passages of admitted groups after `firstPerPassage`, in the core order (score, then dense rank, then recordId). Among all 132 scored pool entries, which include the 7 identity records, the same evidence is at position 15. The SUMMARY evidence is not in the pool. Either position is outside the top five, so the classification does not change.
- Latency, in one execution on the reference machine. Each case gets one warm-up call per path, then three timed rounds with the order of the paths rotated between rounds. The M0 reference is the layer-0 copy in input order. The scoped path has a median of 11,486 ms and a p95 of 34,990 ms, against a gate of 33,765 ms (1.2 times the M0 median of 28,137 ms over the ten scoped queries). The unscoped path has a median of 26,515 ms and a p95 of 37,725 ms, against a gate of 36,580 ms (1.2 times the M0 median of 30,484 ms over the fourteen queries). Both gates pass. The informative reference of 5 seconds at p95 is exceeded by both paths, and it does not gate. The overhead of the scoped path is 2,290 ms, and the reranker ran at 6.74 pairs per second. The recuo B' computed from these numbers is 212. It was not run, because the scoped gate passed.

## Consequences

- Quality and both latency gates passed in the same execution, which is the adoption condition of the E4 plan (criteria 2, 4 and 5). Budget 232 is therefore adopted for `memory_deep`. B' is not used, and the single re-evaluation of the plan is not consumed.
- The absolute latencies are conservative. The reranker ran at 6.74 pairs per second in this execution, against about 11.7 pairs per second in the E3 estimate (232 pairs in about 19.8 seconds). The machine was slower than in E3, and the relative gates, measured in the same execution, are not affected. A release must repeat the measurement.
- The reranking time grows with the passages reranked. In this measurement the 95th percentile of scoped calls was about 35 seconds on the reference machine. The MCP tool description states this.
- Agents call `memory_deep` with `threadId` for a closed thread that `memory_recall` points to, and without `threadId` for the evidence of a passage. Chat passages are intermediate context, to be confirmed in the thread summary or the final message.
- The budget bounds the reranker work, not the call as a whole. A thread with at most 232 passages is searched in full. A larger thread keeps the 232 passages with the highest cosine similarity.
- The evidence covers one corpus, one machine and one measurement. A new corpus, a new machine, or a change to the reranker or the segmentation requires a new measurement. The plan's fallback B' applies only to a scoped latency failure, and it does not replace this decision.
- The E3 funnel stays rejected. This decision does not change production recall, which still runs at depth 0 in the UI (ADR 0012).
