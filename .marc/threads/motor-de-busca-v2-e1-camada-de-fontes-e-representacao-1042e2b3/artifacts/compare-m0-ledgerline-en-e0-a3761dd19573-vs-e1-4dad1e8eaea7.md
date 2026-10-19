# Compare M0: ledgerline-en E0 a3761dd19573 vs E1 4dad1e8eaea7

- Corpus: ledgerline-en
- Verdict: compared
- Baseline: a3761dd19573:M0 (complete, pending 0)
- Candidate: 4dad1e8eaea7:M0 (complete, pending 0)

## Total scope

| Metric | Baseline | Candidate | Delta | Lower bound | Margin | Term |
| --- | --- | --- | --- | --- | --- | --- |
| top1Target | 0.8824 | 0.8824 | 0.0000 | 0.0000 | 0.05 | não inferior |
| top1Relevant | 0.9118 | 0.9118 | 0.0000 | 0.0000 | 0.05 | não inferior |
| mrr | 0.9118 | 0.9118 | 0.0000 | 0.0000 | 0.03 | não inferior |
| ndcg10 | 0.7788 | 0.7788 | 0.0000 | 0.0000 | 0.03 | não inferior |
| admissionPrecision | 1.0000 | 1.0000 | 0.0000 | 0.0000 | 0.05 | não inferior |
| admissionRecall | 0.6552 | 0.6552 | 0.0000 | 0.0000 | 0.05 | não inferior |
| incidentalExposure | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.05 | não inferior |
| abstentionCorrect | 1.0000 | 1.0000 | 0.0000 | 0.0000 | 0.05 | não inferior |
| fullRecall10 | 1.0000 | 1.0000 | 0.0000 | 0.0000 | 0.05 | não inferior |

McNemar top1Target: b=0, c=0, p=1.0000.

Margins: 0.05 for proportions, 0.03 for MRR and nDCG. Generated from the harness compare JSON.
