# Memory evaluation report: 7020a9de1965 (marc)

| Field | Value |
| --- | --- |
| captureId | 7020a9de1965 |
| generation | 20261016002526342_96ca1450 |
| queryFingerprint | d9adccfcbc19ca142075325519089f51d6d48a085593de5139abab4f9d510d3f |
| corpusDigest | bae33c91cf67806703c4ab32bb220986aa83033faacbebfb7f8ee0dde7ed8bba |
| cases by style | direct: 18, indirect: 31, implicit: 31, typo: 16, negative: 14, overcorrection-control: 4 |
| embedding | Xenova/multilingual-e5-small (version transformers-js-4.3.1) |
| reranker | cross-encoder/mmarco-mMiniLMv2-L12-H384-v1/model_O4.onnx (version transformers-js-4.3.1) |
| interpreter | onnx-community/LFM2.5-350M-ONNX/model_q4.onnx (version transformers-js-4.3.1) |
| equivalence (M0 vs production, admitted sequence) | failed (9I) |
| score delta per case (median, p95, max) | 1.70e-11, 1.34e-3, 3.60e-2 |

## Variants and coverage

### M0: complete, pending pairs 0

| Metric | Reach | total | direct | implicit | indirect | negative | overcorrection-control | typo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| top1Target | admittedList | 0.6700 | 0.8333 | 0.4839 | 0.7097 | — | 1.0000 | 0.6875 |
| top1Relevant | admittedList | 0.6800 | 0.8333 | 0.4839 | 0.7419 | — | 1.0000 | 0.6875 |
| top3Target | admittedList | 0.7300 | 0.8333 | 0.6452 | 0.7419 | — | 1.0000 | 0.6875 |
| mrr | admittedList | 0.7106 | 0.8333 | 0.5645 | 0.7601 | — | 1.0000 | 0.6875 |
| ndcg10 | admittedList | 0.6013 | 0.7427 | 0.4984 | 0.6033 | — | 0.7607 | 0.5981 |
| admissionPrecision | admittedList | 0.4554 | 0.3611 | 0.5652 | 0.4559 | — | 0.6667 | 0.4688 |
| admissionRecall | admittedList | 0.5667 | 0.7222 | 0.4906 | 0.5636 | — | 0.6667 | 0.5000 |
| incidentalExposure | admittedList | 0.4300 | 0.6667 | 0.3226 | 0.3871 | — | 0.5000 | 0.4375 |
| abstentionCorrect | admittedList | 1.0000 | — | — | — | 1.0000 | — | — |
| fullRecall10 | fullTop10 | 0.9167 | 0.9722 | 0.9057 | 0.9455 | — | 1.0000 | 0.8000 |
| fullMrr10 | fullTop10 | 0.8335 | 0.9000 | 0.7806 | 0.8694 | — | 1.0000 | 0.7500 |
| condensedTop1Target | diagnosticOnly | 0.6700 | 0.8333 | 0.4839 | 0.7097 | — | 1.0000 | 0.6875 |

### D0: complete, pending pairs 0

| Metric | Reach | total | direct | implicit | indirect | negative | overcorrection-control | typo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| top1Target | admittedList | — | — | — | — | — | — | — |
| top1Relevant | admittedList | — | — | — | — | — | — | — |
| top3Target | admittedList | — | — | — | — | — | — | — |
| mrr | admittedList | — | — | — | — | — | — | — |
| ndcg10 | admittedList | — | — | — | — | — | — | — |
| admissionPrecision | admittedList | — | — | — | — | — | — | — |
| admissionRecall | admittedList | — | — | — | — | — | — | — |
| incidentalExposure | admittedList | — | — | — | — | — | — | — |
| abstentionCorrect | admittedList | — | — | — | — | — | — | — |
| fullRecall10 | fullTop10 | 0.9167 | 0.9722 | 0.9057 | 0.9455 | — | 1.0000 | 0.8000 |
| fullMrr10 | fullTop10 | 0.8335 | 0.9000 | 0.7806 | 0.8694 | — | 1.0000 | 0.7500 |
| condensedTop1Target | diagnosticOnly | — | — | — | — | — | — | — |

### ORACLE_ADMISSION: complete, pending pairs 0

| Metric | Reach | total | direct | implicit | indirect | negative | overcorrection-control | typo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| top1Target | admittedList | 0.9400 | 0.9444 | 0.8710 | 0.9677 | — | 1.0000 | 1.0000 |
| top1Relevant | admittedList | 1.0000 | 1.0000 | 1.0000 | 1.0000 | — | 1.0000 | 1.0000 |
| top3Target | admittedList | 1.0000 | 1.0000 | 1.0000 | 1.0000 | — | 1.0000 | 1.0000 |
| mrr | admittedList | 1.0000 | 1.0000 | 1.0000 | 1.0000 | — | 1.0000 | 1.0000 |
| ndcg10 | admittedList | 0.8909 | 0.8584 | 0.9032 | 0.8939 | — | 0.8855 | 0.8990 |
| admissionPrecision | admittedList | 1.0000 | 1.0000 | 1.0000 | 1.0000 | — | 1.0000 | 1.0000 |
| admissionRecall | admittedList | 1.0000 | 1.0000 | 1.0000 | 1.0000 | — | 1.0000 | 1.0000 |
| incidentalExposure | admittedList | 0.0000 | 0.0000 | 0.0000 | 0.0000 | — | 0.0000 | 0.0000 |
| abstentionCorrect | admittedList | 1.0000 | — | — | — | 1.0000 | — | — |
| fullRecall10 | fullTop10 | 0.9167 | 0.9722 | 0.9057 | 0.9455 | — | 1.0000 | 0.8000 |
| fullMrr10 | fullTop10 | 0.8335 | 0.9000 | 0.7806 | 0.8694 | — | 1.0000 | 0.7500 |
| condensedTop1Target | diagnosticOnly | — | — | — | — | — | — | — |

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
| overcorrection-control | fullRecall10 | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| overcorrection-control | fullMrr10 | 0.0000 | [0.0000, 0.0000] | 0.0300 | não inferior | true | — |
| typo | fullRecall10 | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| typo | fullMrr10 | 0.0000 | [0.0000, 0.0000] | 0.0300 | não inferior | true | — |

### ORACLE_ADMISSION − M0

| Scope | Metric | Difference | Interval 95% | Margin | Term | Non-inferior | McNemar (b/c, p) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| total | top1Target | 0.2700 | [0.1739, 0.3696] | 0.0500 | melhora | true | 0/27, 1.49e-8 |
| total | top1Relevant | 0.3200 | [0.2170, 0.4286] | 0.0500 | melhora | true | — |
| total | top3Target | 0.2700 | [0.1667, 0.3793] | 0.0500 | melhora | true | — |
| total | mrr | 0.2894 | [0.1900, 0.3950] | 0.0300 | melhora | true | — |
| total | ndcg10 | 0.2895 | [0.1950, 0.3888] | 0.0300 | melhora | true | — |
| total | admissionPrecision | 0.5446 | [0.4406, 0.6234] | 0.0500 | melhora | true | — |
| total | admissionRecall | 0.4333 | [0.3250, 0.5403] | 0.0500 | melhora | true | — |
| total | incidentalExposure | -0.4300 | [-0.5600, -0.3061] | 0.0500 | piora | false | — |
| total | abstentionCorrect | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| total | fullRecall10 | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| total | fullMrr10 | 0.0000 | [0.0000, 0.0000] | 0.0300 | não inferior | true | — |
| direct | top1Target | 0.1111 | [0.0000, 0.2609] | 0.0500 | não inferior | true | — |
| direct | top1Relevant | 0.1667 | [0.0000, 0.3333] | 0.0500 | não inferior | true | — |
| direct | top3Target | 0.1667 | [0.0000, 0.3333] | 0.0500 | não inferior | true | — |
| direct | mrr | 0.1667 | [0.0000, 0.3333] | 0.0300 | não inferior | true | — |
| direct | ndcg10 | 0.1157 | [-0.0829, 0.3022] | 0.0300 | inconclusivo | false | — |
| direct | admissionPrecision | 0.6389 | [0.5313, 0.7079] | 0.0500 | melhora | true | — |
| direct | admissionRecall | 0.2778 | [0.0556, 0.4750] | 0.0500 | melhora | true | — |
| direct | incidentalExposure | -0.6667 | [-1.0000, -0.3750] | 0.0500 | piora | false | — |
| direct | abstentionCorrect | — | — | 0.0500 | — | — | — |
| direct | fullRecall10 | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| direct | fullMrr10 | 0.0000 | [0.0000, 0.0000] | 0.0300 | não inferior | true | — |
| implicit | top1Target | 0.3871 | [0.2188, 0.5667] | 0.0500 | melhora | true | — |
| implicit | top1Relevant | 0.5161 | [0.3333, 0.7000] | 0.0500 | melhora | true | — |
| implicit | top3Target | 0.3548 | [0.1875, 0.5333] | 0.0500 | melhora | true | — |
| implicit | mrr | 0.4355 | [0.2742, 0.6000] | 0.0300 | melhora | true | — |
| implicit | ndcg10 | 0.4049 | [0.2674, 0.5488] | 0.0300 | melhora | true | — |
| implicit | admissionPrecision | 0.4348 | [0.2571, 0.5500] | 0.0500 | melhora | true | — |
| implicit | admissionRecall | 0.5094 | [0.3704, 0.6471] | 0.0500 | melhora | true | — |
| implicit | incidentalExposure | -0.3226 | [-0.5000, -0.1613] | 0.0500 | piora | false | — |
| implicit | abstentionCorrect | — | — | 0.0500 | — | — | — |
| implicit | fullRecall10 | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| implicit | fullMrr10 | 0.0000 | [0.0000, 0.0000] | 0.0300 | não inferior | true | — |
| indirect | top1Target | 0.2581 | [0.1212, 0.4194] | 0.0500 | melhora | true | — |
| indirect | top1Relevant | 0.2581 | [0.1212, 0.4194] | 0.0500 | melhora | true | — |
| indirect | top3Target | 0.2581 | [0.1212, 0.4194] | 0.0500 | melhora | true | — |
| indirect | mrr | 0.2399 | [0.1000, 0.3958] | 0.0300 | melhora | true | — |
| indirect | ndcg10 | 0.2906 | [0.1693, 0.4226] | 0.0300 | melhora | true | — |
| indirect | admissionPrecision | 0.5441 | [0.2885, 0.7048] | 0.0500 | melhora | true | — |
| indirect | admissionRecall | 0.4364 | [0.2889, 0.5636] | 0.0500 | melhora | true | — |
| indirect | incidentalExposure | -0.3871 | [-0.5667, -0.2258] | 0.0500 | piora | false | — |
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
| overcorrection-control | top1Target | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| overcorrection-control | top1Relevant | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| overcorrection-control | top3Target | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| overcorrection-control | mrr | 0.0000 | [0.0000, 0.0000] | 0.0300 | não inferior | true | — |
| overcorrection-control | ndcg10 | 0.1248 | [0.0000, 0.2780] | 0.0300 | não inferior | true | — |
| overcorrection-control | admissionPrecision | 0.3333 | [0.0000, 0.5000] | 0.0500 | não inferior | true | — |
| overcorrection-control | admissionRecall | 0.3333 | [0.0000, 0.5000] | 0.0500 | não inferior | true | — |
| overcorrection-control | incidentalExposure | -0.5000 | [-1.0000, 0.0000] | 0.0500 | inconclusivo | false | — |
| overcorrection-control | abstentionCorrect | — | — | 0.0500 | — | — | — |
| overcorrection-control | fullRecall10 | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| overcorrection-control | fullMrr10 | 0.0000 | [0.0000, 0.0000] | 0.0300 | não inferior | true | — |
| typo | top1Target | 0.3125 | [0.0000, 0.5909] | 0.0500 | não inferior | true | — |
| typo | top1Relevant | 0.3125 | [0.0000, 0.5909] | 0.0500 | não inferior | true | — |
| typo | top3Target | 0.3125 | [0.0000, 0.5909] | 0.0500 | não inferior | true | — |
| typo | mrr | 0.3125 | [0.0000, 0.5909] | 0.0300 | não inferior | true | — |
| typo | ndcg10 | 0.3009 | [-0.0085, 0.5419] | 0.0300 | não inferior | true | — |
| typo | admissionPrecision | 0.5313 | [0.3158, 0.6944] | 0.0500 | melhora | true | — |
| typo | admissionRecall | 0.5000 | [0.1667, 0.7250] | 0.0500 | melhora | true | — |
| typo | incidentalExposure | -0.4375 | [-0.8333, -0.1818] | 0.0500 | piora | false | — |
| typo | abstentionCorrect | — | — | 0.0500 | — | — | — |
| typo | fullRecall10 | 0.0000 | [0.0000, 0.0000] | 0.0500 | não inferior | true | — |
| typo | fullMrr10 | 0.0000 | [0.0000, 0.0000] | 0.0300 | não inferior | true | — |

## M0 vs PRODUCTION_RECALL

M0 complete; PRODUCTION_RECALL complete. Reported beside M0, not a decision comparison: the gate is the approvers' call.

| Metric | M0 | PRODUCTION_RECALL | PRODUCTION_RECALL − M0 | Cases with a difference |
| --- | --- | --- | --- | --- |
| top1Target | 0.6700 | 0.6700 | 0.00e+0 | none |
| top1Relevant | 0.6800 | 0.6800 | 0.00e+0 | none |
| top3Target | 0.7300 | 0.7300 | 0.00e+0 | none |
| mrr | 0.7106 | 0.7106 | 0.00e+0 | none |
| ndcg10 | 0.6013 | 0.6013 | 0.00e+0 | none |
| admissionPrecision | 0.4554 | 0.4554 | 0.00e+0 | none |
| admissionRecall | 0.5667 | 0.5667 | 0.00e+0 | none |
| incidentalExposure | 0.4300 | 0.4300 | 0.00e+0 | none |
| abstentionCorrect | 1.0000 | 1.0000 | 0.00e+0 | none |
| fullRecall10 | 0.9167 | 0.5611 | -3.56e-1 | 1P, 3D, 3P, 5P, 6I, 7D, 8I, Q01, Q02, Q03, Q04, Q05, Q06, C2, C5, C6, A01, A04, A05, A07, A10, A11, A12, A13, A14, A16, A20, A21, A22, A23, A24, A25, A26, A27, A30, A32, A33, A34, A35, A37, A39, A40, T02, T03, T06, T07, O02, O04 |
| fullMrr10 | 0.8335 | 0.7100 | -1.24e-1 | 3P, 6I, Q01, Q02, Q03, Q06, C5, A01, A12, A13, A16, A20, A23, A24, A26, A27, A30, A32, A37, A39, A40 |

## Attribution (M0, depth 0)

| Category | Threads of grade 3 |
| --- | --- |
| success | 67 |
| candidate_recall | 0 |
| admission | 32 |
| ordering | 14 |

Passage-selection suspects: 2. M0 Top1 (total): 0.6700. ORACLE_ADMISSION Top1 (total): 0.9400.

## Interpretation

| Metric | Count | Denominator | Value |
| --- | --- | --- | --- |
| correctionCorrect | 12 | 13 | 0.9231 |
| correctionUndue | 0 | 16 | 0.0000 |
| suggestionCorrect | 3 | 3 | 1.0000 |
| suggestionUndue | 15 | 26 | 0.5769 |
| suggestionMissing | 0 | 3 | 0.0000 |

## Latency (milliseconds)

| Samples | Median | p95 | Min free memory (MB) |
| --- | --- | --- | --- |
| 342 | 18171.1986 | 20292.4289 | 4465.0391 |

Measured at 2026-10-17T16:35:32.834Z, from latency.json.

## Judgment agreement

Quadratic kappa 0.3945 over 1215 pairs, 482 divergences.

## Folds

| Fold | Cases | Families |
| --- | --- | --- |
| 0 | 22 | bug-agente-repete-bootstrap-e-investigacao-redundante-em-fluxo-m-58458a82, negative:N05, negative:N06, oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac, oportunidade-gate-de-validacao-proporcional-ao-impacto-da-entreg-054fd58b, oportunidade-indicador-visual-de-memory-na-interface-174c48b6, oportunidade-memory-deep-para-aprofundamento-em-threads-fechadas-f04c7cae, oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3, oportunidade-organizar-css-da-ui-por-dominio-aa4c94ba, oportunidade-popup-para-postar-artifacts-pela-ui-c04986bd, oportunidade-reformatar-custom-rules-com-base-na-auditoria-894072be, oportunidade-revisao-en-us-do-projeto-c14150b8, oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9, remover-comandos-legados-do-mcp-reduzir-sobrecarga-de-contexto-034ad1bf |
| 1 | 25 | ajuste-falha-de-schema-no-rebuild-incremental-da-memoria-94409c8c, negative:N04, negative:N08, negative:N10, oportunidade-atalhos-de-teclado-em-sheet-lateral-5845b8a1, oportunidade-coordenacao-global-de-rebuild-da-memory-entre-proce-774d1e99, oportunidade-documentacao-do-projeto-e-readme-encantador-e54fb794, oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba, oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1, oportunidade-leitura-incremental-de-threads-por-cursor-3c45fa83, oportunidade-mecanismo-de-busca-sobre-o-conhecimento-do-projeto-b64903bd, oportunidade-migracao-de-cabecalhos-de-summaries-com-previas-3c4dda95, oportunidade-politica-de-concorrencia-e-escritas-no-markdown-sot-3d40719f, padronizar-mensagens-marc-em-bullets-concisos-6143a9b5 |
| 2 | 24 | ajustar-a-politica-de-registros-do-loop-para-separar-orquestraca-004a9983, bug-agent-register-nao-sinaliza-agente-existente-9e4e6ab7, documentar-o-fluxo-de-desenvolvimento-em-loop-e-a-politica-de-mo-92413b81, negative:C7, negative:C8, negative:N03, negative:Q13, oportunidade-busca-mcp-de-thread-por-sufixo-de-id-1d4c0daa, oportunidade-esquemas-de-visualizacao-das-colunas-da-ui-604ad99b, oportunidade-ordenar-threads-mais-novas-no-topo-394a14b9, oportunidade-reestruturar-instructions-e-rules-para-bootstrap-d34b7486, oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2, oportunidade-status-health-e-rebuild-de-indice-em-background-6340b186, substituir-componente-sonner-pelo-componente-toast-da-lib-neobru-594973bb |
| 3 | 23 | bug-comentario-pela-ui-adiciona-usuario-ao-rules-md-274b7c9a, bug-workspace-audit-ignora-referencias-marc-em-inline-code-72461180, correcao-do-fluxo-de-agentes-para-independencia-de-fornecedores--dd4a5684, negative:N02, negative:Q14, oportunidade-autocomplete-de-referencias-no-composer-2341bc9f, oportunidade-bootstrap-obrigatorio-nas-tools-marc-d14fb686, oportunidade-daemon-detached-e-instalacao-global-via-npm-39436d9c, oportunidade-encerramento-de-threads-por-summary-e-indice-json-ce47939a, oportunidade-processamento-em-background-para-gerar-memory-aa4908aa, oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4, oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787, oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb |
| 4 | 20 | corrigir-corrida-de-startup-no-teste-de-auto-idle-do-daemon-504e1898, negative:N01, negative:N07, negative:N09, oportunidade-alinhamento-do-harness-e-das-instrucoes-operacionai-094d8894, oportunidade-calibragem-de-recall-lexical-e-candidatos-da-memory-e4478bac, oportunidade-criacao-de-threads-pela-ui-0845d0bb, oportunidade-marc-audit-para-melhorar-custom-rules-184fd8bb, oportunidade-organizar-agentes-registrados-no-rules-md-734062bc, oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4, oportunidade-rebuild-incremental-e-batches-limitados-da-memory-3e422682, oportunidade-reforcar-gatilhos-de-ativacao-da-skill-marc-ops-934c4896, oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7 |

## Corpus size

Threads 56; identity records 56; passage records 295; channel limit 100; identities fit the channel limit: yes.
