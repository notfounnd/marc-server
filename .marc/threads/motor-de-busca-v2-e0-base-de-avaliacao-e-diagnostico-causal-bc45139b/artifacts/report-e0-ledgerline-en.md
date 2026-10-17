# Memory evaluation report: a3761dd19573 (ledgerline-en)

| Field | Value |
| --- | --- |
| captureId | a3761dd19573 |
| generation | 20261016001940846_319ce06e |
| queryFingerprint | 4a30654d3bd33181b73c554bac0e49c1dc5176a2367c75dd4a6540a5a5c47fc8 |
| corpusDigest | 44da053463b186544fc6d781f96204fbbfb9bd053ce72003b0e76bb872c9a535 |
| cases by style | direct: 9, implicit: 10, indirect: 11, negative: 6, typo: 4 |
| embedding | Xenova/multilingual-e5-small (version transformers-js-4.3.1) |
| reranker | cross-encoder/mmarco-mMiniLMv2-L12-H384-v1/model_O4.onnx (version transformers-js-4.3.1) |
| interpreter | onnx-community/LFM2.5-350M-ONNX/model_q4.onnx (version transformers-js-4.3.1) |
| equivalence (M0 vs production, admitted sequence) | passed |
| score delta per case (median, p95, max) | 0.00e+0, 8.54e-5, 2.15e-3 |

## Variants and coverage

### M0: complete, pending pairs 0

| Metric | Reach | total | direct | implicit | indirect | negative | typo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| top1Target | admittedList | 0.8824 | 1.0000 | 1.0000 | 0.6364 | — | 1.0000 |
| top1Relevant | admittedList | 0.9118 | 1.0000 | 1.0000 | 0.7273 | — | 1.0000 |
| top3Target | admittedList | 0.9118 | 1.0000 | 1.0000 | 0.7273 | — | 1.0000 |
| mrr | admittedList | 0.9118 | 1.0000 | 1.0000 | 0.7273 | — | 1.0000 |
| ndcg10 | admittedList | 0.7788 | 0.9083 | 0.7949 | 0.6252 | — | 0.8698 |
| admissionPrecision | admittedList | 1.0000 | 1.0000 | 1.0000 | 1.0000 | — | 1.0000 |
| admissionRecall | admittedList | 0.6552 | 0.8571 | 0.5556 | 0.5789 | — | 0.7143 |
| incidentalExposure | admittedList | 0.0000 | 0.0000 | 0.0000 | 0.0000 | — | 0.0000 |
| abstentionCorrect | admittedList | 1.0000 | — | — | — | 1.0000 | — |
| fullRecall10 | fullTop10 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | — | 1.0000 |
| fullMrr10 | fullTop10 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | — | 1.0000 |
| condensedTop1Target | diagnosticOnly | 0.8824 | 1.0000 | 1.0000 | 0.6364 | — | 1.0000 |

### D0: complete, pending pairs 0

| Metric | Reach | total | direct | implicit | indirect | negative | typo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| top1Target | admittedList | — | — | — | — | — | — |
| top1Relevant | admittedList | — | — | — | — | — | — |
| top3Target | admittedList | — | — | — | — | — | — |
| mrr | admittedList | — | — | — | — | — | — |
| ndcg10 | admittedList | — | — | — | — | — | — |
| admissionPrecision | admittedList | — | — | — | — | — | — |
| admissionRecall | admittedList | — | — | — | — | — | — |
| incidentalExposure | admittedList | — | — | — | — | — | — |
| abstentionCorrect | admittedList | — | — | — | — | — | — |
| fullRecall10 | fullTop10 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | — | 1.0000 |
| fullMrr10 | fullTop10 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | — | 1.0000 |
| condensedTop1Target | diagnosticOnly | — | — | — | — | — | — |

### ORACLE_ADMISSION: complete, pending pairs 0

| Metric | Reach | total | direct | implicit | indirect | negative | typo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| top1Target | admittedList | 0.9412 | 1.0000 | 1.0000 | 0.8182 | — | 1.0000 |
| top1Relevant | admittedList | 1.0000 | 1.0000 | 1.0000 | 1.0000 | — | 1.0000 |
| top3Target | admittedList | 1.0000 | 1.0000 | 1.0000 | 1.0000 | — | 1.0000 |
| mrr | admittedList | 1.0000 | 1.0000 | 1.0000 | 1.0000 | — | 1.0000 |
| ndcg10 | admittedList | 0.9445 | 0.9543 | 0.9603 | 0.9117 | — | 0.9734 |
| admissionPrecision | admittedList | 1.0000 | 1.0000 | 1.0000 | 1.0000 | — | 1.0000 |
| admissionRecall | admittedList | 1.0000 | 1.0000 | 1.0000 | 1.0000 | — | 1.0000 |
| incidentalExposure | admittedList | 0.0000 | 0.0000 | 0.0000 | 0.0000 | — | 0.0000 |
| abstentionCorrect | admittedList | 1.0000 | — | — | — | 1.0000 | — |
| fullRecall10 | fullTop10 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | — | 1.0000 |
| fullMrr10 | fullTop10 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | — | 1.0000 |
| condensedTop1Target | diagnosticOnly | — | — | — | — | — | — |

## Comparisons against M0

### D0 − M0

| Scope | Metric | Difference | Interval 95% | Margin | Term | Non-inferior | McNemar (b/c, p) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| total | fullRecall10 | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| total | fullMrr10 | 0.0000 | [0.0000, 0.0000] | 0.0300 | não inferior | true | — |
| direct | fullRecall10 | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| direct | fullMrr10 | 0.0000 | [0.0000, 0.0000] | 0.0300 | não inferior | true | — |
| implicit | fullRecall10 | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| implicit | fullMrr10 | 0.0000 | [0.0000, 0.0000] | 0.0300 | não inferior | true | — |
| indirect | fullRecall10 | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| indirect | fullMrr10 | 0.0000 | [0.0000, 0.0000] | 0.0300 | não inferior | true | — |
| negative | fullRecall10 | — | — | 0.0500 | — | — | — |
| negative | fullMrr10 | — | — | 0.0300 | — | — | — |
| typo | fullRecall10 | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| typo | fullMrr10 | 0.0000 | [0.0000, 0.0000] | 0.0300 | não inferior | true | — |

### ORACLE_ADMISSION − M0

| Scope | Metric | Difference | Interval 95% | Margin | Term | Non-inferior | McNemar (b/c, p) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| total | top1Target | 0.0588 | [0.0000, 0.1515] | 0.0500 | não inferior | true | 0/2, 5.00e-1 |
| total | top1Relevant | 0.0882 | [0.0000, 0.2000] | 0.0500 | não inferior | true | — |
| total | top3Target | 0.0882 | [0.0000, 0.2000] | 0.0500 | não inferior | true | — |
| total | mrr | 0.0882 | [0.0000, 0.2000] | 0.0300 | não inferior | true | — |
| total | ndcg10 | 0.1657 | [0.0895, 0.2559] | 0.0300 | melhora | true | — |
| total | admissionPrecision | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| total | admissionRecall | 0.3448 | [0.2353, 0.4444] | 0.0500 | melhora | true | — |
| total | incidentalExposure | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| total | abstentionCorrect | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| total | fullRecall10 | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| total | fullMrr10 | 0.0000 | [0.0000, 0.0000] | 0.0300 | não inferior | true | — |
| direct | top1Target | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| direct | top1Relevant | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| direct | top3Target | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| direct | mrr | 0.0000 | [0.0000, 0.0000] | 0.0300 | não inferior | true | — |
| direct | ndcg10 | 0.0460 | [0.0000, 0.1145] | 0.0300 | não inferior | true | — |
| direct | admissionPrecision | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| direct | admissionRecall | 0.1429 | [0.0000, 0.3077] | 0.0500 | não inferior | true | — |
| direct | incidentalExposure | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| direct | abstentionCorrect | — | — | 0.0500 | — | — | — |
| direct | fullRecall10 | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| direct | fullMrr10 | 0.0000 | [0.0000, 0.0000] | 0.0300 | não inferior | true | — |
| implicit | top1Target | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| implicit | top1Relevant | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| implicit | top3Target | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| implicit | mrr | 0.0000 | [0.0000, 0.0000] | 0.0300 | não inferior | true | — |
| implicit | ndcg10 | 0.1654 | [0.0752, 0.2554] | 0.0300 | melhora | true | — |
| implicit | admissionPrecision | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| implicit | admissionRecall | 0.4444 | [0.2857, 0.5652] | 0.0500 | melhora | true | — |
| implicit | incidentalExposure | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| implicit | abstentionCorrect | — | — | 0.0500 | — | — | — |
| implicit | fullRecall10 | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| implicit | fullMrr10 | 0.0000 | [0.0000, 0.0000] | 0.0300 | não inferior | true | — |
| indirect | top1Target | 0.1818 | [0.0000, 0.4545] | 0.0500 | não inferior | true | — |
| indirect | top1Relevant | 0.2727 | [0.0000, 0.5455] | 0.0500 | não inferior | true | — |
| indirect | top3Target | 0.2727 | [0.0000, 0.5455] | 0.0500 | não inferior | true | — |
| indirect | mrr | 0.2727 | [0.0000, 0.5455] | 0.0300 | não inferior | true | — |
| indirect | ndcg10 | 0.2865 | [0.0843, 0.5219] | 0.0300 | melhora | true | — |
| indirect | admissionPrecision | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| indirect | admissionRecall | 0.4211 | [0.2000, 0.6500] | 0.0500 | melhora | true | — |
| indirect | incidentalExposure | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| indirect | abstentionCorrect | — | — | 0.0500 | — | — | — |
| indirect | fullRecall10 | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| indirect | fullMrr10 | 0.0000 | [0.0000, 0.0000] | 0.0300 | não inferior | true | — |
| negative | top1Target | — | — | 0.0500 | — | — | — |
| negative | top1Relevant | — | — | 0.0500 | — | — | — |
| negative | top3Target | — | — | 0.0500 | — | — | — |
| negative | mrr | — | — | 0.0300 | — | — | — |
| negative | ndcg10 | — | — | 0.0300 | — | — | — |
| negative | admissionPrecision | — | — | 0.0500 | — | — | — |
| negative | admissionRecall | — | — | 0.0500 | — | — | — |
| negative | incidentalExposure | — | — | 0.0500 | — | — | — |
| negative | abstentionCorrect | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| negative | fullRecall10 | — | — | 0.0500 | — | — | — |
| negative | fullMrr10 | — | — | 0.0300 | — | — | — |
| typo | top1Target | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| typo | top1Relevant | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| typo | top3Target | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| typo | mrr | 0.0000 | [0.0000, 0.0000] | 0.0300 | não inferior | true | — |
| typo | ndcg10 | 0.1036 | [0.0000, 0.2072] | 0.0300 | não inferior | true | — |
| typo | admissionPrecision | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| typo | admissionRecall | 0.2857 | [0.0000, 0.5000] | 0.0500 | não inferior | true | — |
| typo | incidentalExposure | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| typo | abstentionCorrect | — | — | 0.0500 | — | — | — |
| typo | fullRecall10 | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| typo | fullMrr10 | 0.0000 | [0.0000, 0.0000] | 0.0300 | não inferior | true | — |

## M0 vs PRODUCTION_RECALL

M0 complete; PRODUCTION_RECALL complete. Reported beside M0, not a decision comparison: the gate is the approvers' call.

| Metric | M0 | PRODUCTION_RECALL | PRODUCTION_RECALL − M0 | Cases with a difference |
| --- | --- | --- | --- | --- |
| top1Target | 0.8824 | 0.8824 | 0.00e+0 | none |
| top1Relevant | 0.9118 | 0.9118 | 0.00e+0 | none |
| top3Target | 0.9118 | 0.9118 | 0.00e+0 | none |
| mrr | 0.9118 | 0.9118 | 0.00e+0 | none |
| ndcg10 | 0.7788 | 0.7788 | 0.00e+0 | none |
| admissionPrecision | 1.0000 | 1.0000 | 0.00e+0 | none |
| admissionRecall | 0.6552 | 0.6552 | 0.00e+0 | none |
| incidentalExposure | 0.0000 | 0.0000 | 0.00e+0 | none |
| abstentionCorrect | 1.0000 | 1.0000 | 0.00e+0 | none |
| fullRecall10 | 1.0000 | 0.6552 | -3.45e-1 | L02, L06, L09, L10, L13, L15, L16, L18, L19, L21, L22, L26, L27, L30, LT02, LT04 |
| fullMrr10 | 1.0000 | 0.9118 | -8.82e-2 | L16, L19, L22 |

## Attribution (M0, depth 0)

| Category | Threads of grade 3 |
| --- | --- |
| success | 30 |
| candidate_recall | 0 |
| admission | 4 |
| ordering | 2 |

Passage-selection suspects: 0. M0 Top1 (total): 0.8824. ORACLE_ADMISSION Top1 (total): 0.9412.

## Interpretation

| Metric | Count | Denominator | Value |
| --- | --- | --- | --- |
| correctionCorrect | 2 | 4 | 0.5000 |
| correctionUndue | 0 | 0 | — |
| suggestionCorrect | 0 | 0 | — |
| suggestionUndue | 4 | 4 | 1.0000 |
| suggestionMissing | 0 | 0 | — |

## Latency (milliseconds)

| Samples | Median | p95 | Min free memory (MB) |
| --- | --- | --- | --- |
| 120 | 5686.6637 | 6227.3432 | 4025.9648 |

Measured at 2026-10-17T16:19:30.664Z, from latency.json.

## Judgment agreement

Quadratic kappa 0.6826 over 377 pairs, 75 divergences.

## Folds

| Fold | Cases | Families |
| --- | --- | --- |
| 0 | 8 | categorization-rule-tester-command-6b5c9e04, csv-importer-column-mapping-and-header-detection-7b92e4d0, daemon-startup-health-check-c0e6b915, encryption-at-rest-config-key-41c7f0ae, negative:LN01, negative:LN04, sync-scheduler-fixed-interval-e2a6c590, web-ui-transactions-virtual-scrolling-b4e8c293 |
| 1 | 9 | account-linking-flow-for-bank-connections-0b7d6e31, benchmark-sqlite-storage-for-transactions-e07d5c18, categorization-rules-regex-first-version-5c8e1a77, duplicate-transaction-detection-by-fingerprint-f16a2d09, import-batch-size-limits-and-progress-events-1d8f2a73, settings-file-migration-to-toml-e94b1d26, sync-scheduler-exponential-backoff-88f1d2b4 |
| 2 | 7 | categorization-rules-priority-ordering-0d4f9b13, cli-command-structure-and-exit-codes-3c9e0a52, http-api-scoped-tokens-per-client-9e1c6b38, local-api-json-error-envelope-8d4b1f67, negative:LN03, negative:LN06, ui-dark-mode-toggle-persistence-7f3a0c48 |
| 3 | 8 | bank-connector-plugin-interface-decision-5d2e8a17, csv-importer-bank-export-parsing-3a1f0c21, daily-balance-snapshot-job-5e9c3b84, encryption-at-rest-passphrase-derived-key-c39e5d62, http-api-static-token-auth-d2f7a041, key-rotation-procedure-for-encrypted-store-a85f3e27, negative:LN02 |
| 4 | 8 | backup-export-of-local-database-3e0a7d92, logging-redaction-of-account-numbers-a2c8f750, negative:LN05, ofx-importer-currency-handling-2f5d8a6c, ofx-importer-statement-header-parsing-c71e0b94, retry-policy-for-bank-connector-timeouts-4b3a9f20, web-ui-transactions-paged-list-6a0b7f15 |

## Corpus size

Threads 30; identity records 30; passage records 106; channel limit 100; identities fit the channel limit: yes.
