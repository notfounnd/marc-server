# Compare M0: marc E0 7020a9de1965 vs E1 8af296ddeca8

- Corpus: marc
- Verdict: compared
- Baseline: 7020a9de1965:M0 (complete, pending 0)
- Candidate: 8af296ddeca8:M0 (complete, pending 0)

## Total scope

| Metric | Baseline | Candidate | Delta | Lower bound | Margin | Term |
| --- | --- | --- | --- | --- | --- | --- |
| top1Target | 0.6700 | 0.6600 | -0.0100 | -0.0337 | 0.05 | não inferior |
| top1Relevant | 0.6800 | 0.6700 | -0.0100 | -0.0337 | 0.05 | não inferior |
| mrr | 0.7106 | 0.7056 | -0.0050 | -0.0169 | 0.03 | não inferior |
| ndcg10 | 0.5915 | 0.5884 | -0.0032 | -0.0107 | 0.03 | não inferior |
| admissionPrecision | 0.4554 | 0.4574 | 0.0020 | 0.0000 | 0.05 | não inferior |
| admissionRecall | 0.5313 | 0.5313 | 0.0000 | 0.0000 | 0.05 | não inferior |
| incidentalExposure | 0.4300 | 0.4300 | 0.0000 | 0.0000 | 0.05 | não inferior |
| abstentionCorrect | 1.0000 | 1.0000 | 0.0000 | 0.0000 | 0.05 | não inferior |
| fullRecall10 | 0.8594 | 0.8750 | 0.0156 | 0.0000 | 0.05 | não inferior |

McNemar top1Target: b=1, c=0, p=1.0000.

Margins: 0.05 for proportions, 0.03 for MRR and nDCG. Generated from the harness compare JSON.
