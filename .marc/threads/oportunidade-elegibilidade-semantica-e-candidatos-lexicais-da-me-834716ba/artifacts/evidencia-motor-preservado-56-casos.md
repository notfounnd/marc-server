# Evidencia dos 56 casos do motor preservado

Dados originais em JSON, preservados em um anexo Markdown compativel com a auditoria do mARC. Os criterios e os resultados nao foram alterados.

```json
{
  "schemaVersion": 1,
  "scope": "Accepted engine preserved; existing quality gates evaluated without recalibration.",
  "totals": {
    "units": 32,
    "cases": 56,
    "passed": 28,
    "failed": 28
  },
  "units": [
    {
      "family": "brutalism",
      "depth": 0,
      "exitCode": 0,
      "strategy": "hybrid-prefix",
      "caseCount": 5,
      "aggregate": {
        "meanNdcgAt10": 0.9503916476277743,
        "meanReciprocalRank": 1,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 1,
        "eligibilityRecall": 1
      },
      "failures": [],
      "cases": [
        {
          "query": "brutal",
          "depth": 0,
          "durationMs": 12375,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "brutal",
            "mode": "auto",
            "originalQuery": "brutal"
          },
          "eligible": [
            {
              "threadId": "oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1",
              "eligibility": 0.678763
            }
          ],
          "passed": true
        },
        {
          "query": "brutalismp",
          "depth": 0,
          "durationMs": 12513,
          "interpretation": {
            "correctionApplied": true,
            "effectiveQuery": "brutalism",
            "mode": "auto",
            "originalQuery": "brutalismp",
            "suggestedQuery": "brutalism"
          },
          "eligible": [
            {
              "threadId": "oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1",
              "eligibility": 0.538356
            }
          ],
          "passed": true
        },
        {
          "query": "brutalism",
          "depth": 0,
          "durationMs": 11073,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "brutalism",
            "mode": "auto",
            "originalQuery": "brutalism"
          },
          "eligible": [
            {
              "threadId": "oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1",
              "eligibility": 0.538356
            }
          ],
          "passed": true
        },
        {
          "query": "interface com brutalism",
          "depth": 0,
          "durationMs": 14670,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "interface com brutalism",
            "mode": "auto",
            "originalQuery": "interface com brutalism"
          },
          "eligible": [
            {
              "threadId": "oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1",
              "eligibility": 0.999444
            }
          ],
          "passed": true
        },
        {
          "query": "interace com brutalism",
          "depth": 0,
          "durationMs": 13903,
          "interpretation": {
            "correctionApplied": true,
            "effectiveQuery": "interface com brutalism",
            "mode": "auto",
            "originalQuery": "interace com brutalism",
            "suggestedQuery": "interface com brutalism"
          },
          "eligible": [
            {
              "threadId": "oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1",
              "eligibility": 0.999444
            }
          ],
          "passed": true
        }
      ]
    },
    {
      "family": "toggle",
      "depth": 0,
      "exitCode": 1,
      "strategy": "hybrid-prefix",
      "caseCount": 2,
      "aggregate": {
        "meanNdcgAt10": 0.17470390214769696,
        "meanReciprocalRank": 0.12698412698412698,
        "meanRecallAt10": 0.5,
        "eligibilityPrecision": 1,
        "eligibilityRecall": 0
      },
      "failures": [
        "toggle depth 0 expected oportunidade-processamento-em-background-para-gerar-memory-aa4908aa, received no result",
        "toogle depth 0 expected oportunidade-processamento-em-background-para-gerar-memory-aa4908aa, received no result"
      ],
      "cases": [
        {
          "query": "toggle",
          "depth": 0,
          "durationMs": 13105,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "toggle",
            "mode": "auto",
            "originalQuery": "toggle"
          },
          "eligible": [],
          "passed": false
        },
        {
          "query": "toogle",
          "depth": 0,
          "durationMs": 13234,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "toogle",
            "mode": "auto",
            "originalQuery": "toogle",
            "suggestedQuery": "toggle"
          },
          "eligible": [],
          "passed": false
        }
      ]
    },
    {
      "family": "security",
      "depth": 0,
      "exitCode": 1,
      "strategy": "hybrid-prefix",
      "caseCount": 1,
      "aggregate": {
        "meanNdcgAt10": 1,
        "meanReciprocalRank": 1,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 0.3333333333333333,
        "eligibilityRecall": 1
      },
      "failures": [
        "interface token rotation security depth 0 exposed incidental thread oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb"
      ],
      "cases": [
        {
          "query": "interface token rotation security",
          "depth": 0,
          "durationMs": 15244,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "interface token rotation security",
            "mode": "auto",
            "originalQuery": "interface token rotation security"
          },
          "eligible": [
            {
              "threadId": "oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3",
              "eligibility": 0.976517
            },
            {
              "threadId": "oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb",
              "eligibility": 0.976517
            },
            {
              "threadId": "oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac",
              "eligibility": 0.975779
            }
          ],
          "passed": false
        }
      ]
    },
    {
      "family": "settings",
      "depth": 0,
      "exitCode": 1,
      "strategy": "hybrid-prefix",
      "caseCount": 1,
      "aggregate": {
        "meanNdcgAt10": 1,
        "meanReciprocalRank": 1,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 0.6666666666666666,
        "eligibilityRecall": 1
      },
      "failures": [
        "structured workspace settings json depth 0 exposed incidental thread oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4"
      ],
      "cases": [
        {
          "query": "structured workspace settings json",
          "depth": 0,
          "durationMs": 15046,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "structured workspace settings json",
            "mode": "auto",
            "originalQuery": "structured workspace settings json"
          },
          "eligible": [
            {
              "threadId": "oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9",
              "eligibility": 1
            },
            {
              "threadId": "oportunidade-processamento-em-background-para-gerar-memory-aa4908aa",
              "eligibility": 0.980582
            },
            {
              "threadId": "oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4",
              "eligibility": 0.952177
            }
          ],
          "passed": false
        }
      ]
    },
    {
      "family": "security-pt",
      "depth": 0,
      "exitCode": 1,
      "strategy": "hybrid-prefix",
      "caseCount": 2,
      "aggregate": {
        "meanNdcgAt10": 1,
        "meanReciprocalRank": 1,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 0.3333333333333333,
        "eligibilityRecall": 1
      },
      "failures": [
        "seguranca da rotacao de token da interface depth 0 exposed incidental thread oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb",
        "seguranca da rotacao de toke da interface depth 0 exposed incidental thread oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb"
      ],
      "cases": [
        {
          "query": "seguranca da rotacao de token da interface",
          "depth": 0,
          "durationMs": 17190,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "seguranca da rotacao de token da interface",
            "mode": "auto",
            "originalQuery": "seguranca da rotacao de token da interface"
          },
          "eligible": [
            {
              "threadId": "oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3",
              "eligibility": 0.992751
            },
            {
              "threadId": "oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb",
              "eligibility": 0.992751
            },
            {
              "threadId": "oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac",
              "eligibility": 0.992751
            }
          ],
          "passed": false
        },
        {
          "query": "seguranca da rotacao de toke da interface",
          "depth": 0,
          "durationMs": 14253,
          "interpretation": {
            "correctionApplied": true,
            "effectiveQuery": "seguranca da rotacao de token da interface",
            "mode": "auto",
            "originalQuery": "seguranca da rotacao de toke da interface",
            "suggestedQuery": "seguranca da rotacao de token da interface"
          },
          "eligible": [
            {
              "threadId": "oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3",
              "eligibility": 0.992751
            },
            {
              "threadId": "oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb",
              "eligibility": 0.992751
            },
            {
              "threadId": "oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac",
              "eligibility": 0.992751
            }
          ],
          "passed": false
        }
      ]
    },
    {
      "family": "settings-typo",
      "depth": 0,
      "exitCode": 1,
      "strategy": "hybrid-prefix",
      "caseCount": 1,
      "aggregate": {
        "meanNdcgAt10": 1,
        "meanReciprocalRank": 1,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 0.6666666666666666,
        "eligibilityRecall": 1
      },
      "failures": [
        "structured worksapce settings json depth 0 exposed incidental thread oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4"
      ],
      "cases": [
        {
          "query": "structured worksapce settings json",
          "depth": 0,
          "durationMs": 15714,
          "interpretation": {
            "correctionApplied": true,
            "effectiveQuery": "structured workspace settings json",
            "mode": "auto",
            "originalQuery": "structured worksapce settings json",
            "suggestedQuery": "structured workspace settings json"
          },
          "eligible": [
            {
              "threadId": "oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9",
              "eligibility": 1
            },
            {
              "threadId": "oportunidade-processamento-em-background-para-gerar-memory-aa4908aa",
              "eligibility": 0.980582
            },
            {
              "threadId": "oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4",
              "eligibility": 0.952177
            }
          ],
          "passed": false
        }
      ]
    },
    {
      "family": "negative-finance",
      "depth": 0,
      "exitCode": 0,
      "strategy": "hybrid-prefix",
      "caseCount": 1,
      "aggregate": {
        "meanNdcgAt10": 1,
        "meanReciprocalRank": 0,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 1,
        "eligibilityRecall": 1
      },
      "failures": [],
      "cases": [
        {
          "query": "invoice tax reconciliation for international payments",
          "depth": 0,
          "durationMs": 13105,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "invoice tax reconciliation for international payments",
            "mode": "auto",
            "originalQuery": "invoice tax reconciliation for international payments"
          },
          "eligible": [],
          "passed": true
        }
      ]
    },
    {
      "family": "negative-infrastructure",
      "depth": 0,
      "exitCode": 0,
      "strategy": "hybrid-prefix",
      "caseCount": 1,
      "aggregate": {
        "meanNdcgAt10": 1,
        "meanReciprocalRank": 0,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 1,
        "eligibilityRecall": 1
      },
      "failures": [],
      "cases": [
        {
          "query": "kubernetes autoscaling policy for production clusters",
          "depth": 0,
          "durationMs": 14476,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "kubernetes autoscaling policy for production clusters",
            "mode": "auto",
            "originalQuery": "kubernetes autoscaling policy for production clusters"
          },
          "eligible": [],
          "passed": true
        }
      ]
    },
    {
      "family": "brutalism",
      "depth": 1,
      "exitCode": 0,
      "strategy": "hybrid-prefix",
      "caseCount": 5,
      "aggregate": {
        "meanNdcgAt10": 0.9503916476277743,
        "meanReciprocalRank": 1,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 1,
        "eligibilityRecall": 1
      },
      "failures": [],
      "cases": [
        {
          "query": "brutal",
          "depth": 1,
          "durationMs": 15989,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "brutal",
            "mode": "auto",
            "originalQuery": "brutal"
          },
          "eligible": [
            {
              "threadId": "oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1",
              "eligibility": 0.678763
            }
          ],
          "passed": true
        },
        {
          "query": "brutalismp",
          "depth": 1,
          "durationMs": 12884,
          "interpretation": {
            "correctionApplied": true,
            "effectiveQuery": "brutalism",
            "mode": "auto",
            "originalQuery": "brutalismp",
            "suggestedQuery": "brutalism"
          },
          "eligible": [
            {
              "threadId": "oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1",
              "eligibility": 0.538356
            }
          ],
          "passed": true
        },
        {
          "query": "brutalism",
          "depth": 1,
          "durationMs": 11957,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "brutalism",
            "mode": "auto",
            "originalQuery": "brutalism"
          },
          "eligible": [
            {
              "threadId": "oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1",
              "eligibility": 0.538356
            }
          ],
          "passed": true
        },
        {
          "query": "interface com brutalism",
          "depth": 1,
          "durationMs": 15418,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "interface com brutalism",
            "mode": "auto",
            "originalQuery": "interface com brutalism"
          },
          "eligible": [
            {
              "threadId": "oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1",
              "eligibility": 0.999446
            }
          ],
          "passed": true
        },
        {
          "query": "interace com brutalism",
          "depth": 1,
          "durationMs": 13945,
          "interpretation": {
            "correctionApplied": true,
            "effectiveQuery": "interface com brutalism",
            "mode": "auto",
            "originalQuery": "interace com brutalism",
            "suggestedQuery": "interface com brutalism"
          },
          "eligible": [
            {
              "threadId": "oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1",
              "eligibility": 0.999446
            }
          ],
          "passed": true
        }
      ]
    },
    {
      "family": "toggle",
      "depth": 1,
      "exitCode": 1,
      "strategy": "hybrid-prefix",
      "caseCount": 2,
      "aggregate": {
        "meanNdcgAt10": 0.18038514370700248,
        "meanReciprocalRank": 0.13392857142857142,
        "meanRecallAt10": 0.5,
        "eligibilityPrecision": 1,
        "eligibilityRecall": 0
      },
      "failures": [
        "toggle depth 1 expected oportunidade-processamento-em-background-para-gerar-memory-aa4908aa, received no result",
        "toogle depth 1 expected oportunidade-processamento-em-background-para-gerar-memory-aa4908aa, received no result"
      ],
      "cases": [
        {
          "query": "toggle",
          "depth": 1,
          "durationMs": 16239,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "toggle",
            "mode": "auto",
            "originalQuery": "toggle"
          },
          "eligible": [],
          "passed": false
        },
        {
          "query": "toogle",
          "depth": 1,
          "durationMs": 13356,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "toogle",
            "mode": "auto",
            "originalQuery": "toogle",
            "suggestedQuery": "toggle"
          },
          "eligible": [],
          "passed": false
        }
      ]
    },
    {
      "family": "security",
      "depth": 1,
      "exitCode": 1,
      "strategy": "hybrid-prefix",
      "caseCount": 1,
      "aggregate": {
        "meanNdcgAt10": 1,
        "meanReciprocalRank": 1,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 0.3333333333333333,
        "eligibilityRecall": 1
      },
      "failures": [
        "interface token rotation security depth 1 exposed incidental thread oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb"
      ],
      "cases": [
        {
          "query": "interface token rotation security",
          "depth": 1,
          "durationMs": 19432,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "interface token rotation security",
            "mode": "auto",
            "originalQuery": "interface token rotation security"
          },
          "eligible": [
            {
              "threadId": "oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3",
              "eligibility": 0.976517
            },
            {
              "threadId": "oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb",
              "eligibility": 0.976517
            },
            {
              "threadId": "oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac",
              "eligibility": 0.975779
            }
          ],
          "passed": false
        }
      ]
    },
    {
      "family": "settings",
      "depth": 1,
      "exitCode": 1,
      "strategy": "hybrid-prefix",
      "caseCount": 1,
      "aggregate": {
        "meanNdcgAt10": 1,
        "meanReciprocalRank": 1,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 0.6666666666666666,
        "eligibilityRecall": 1
      },
      "failures": [
        "structured workspace settings json depth 1 exposed incidental thread oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4"
      ],
      "cases": [
        {
          "query": "structured workspace settings json",
          "depth": 1,
          "durationMs": 17086,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "structured workspace settings json",
            "mode": "auto",
            "originalQuery": "structured workspace settings json"
          },
          "eligible": [
            {
              "threadId": "oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9",
              "eligibility": 1
            },
            {
              "threadId": "oportunidade-processamento-em-background-para-gerar-memory-aa4908aa",
              "eligibility": 0.980582
            },
            {
              "threadId": "oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4",
              "eligibility": 0.952217
            }
          ],
          "passed": false
        }
      ]
    },
    {
      "family": "security-pt",
      "depth": 1,
      "exitCode": 1,
      "strategy": "hybrid-prefix",
      "caseCount": 2,
      "aggregate": {
        "meanNdcgAt10": 1,
        "meanReciprocalRank": 1,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 0.3333333333333333,
        "eligibilityRecall": 1
      },
      "failures": [
        "seguranca da rotacao de token da interface depth 1 exposed incidental thread oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb",
        "seguranca da rotacao de toke da interface depth 1 exposed incidental thread oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb"
      ],
      "cases": [
        {
          "query": "seguranca da rotacao de token da interface",
          "depth": 1,
          "durationMs": 19669,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "seguranca da rotacao de token da interface",
            "mode": "auto",
            "originalQuery": "seguranca da rotacao de token da interface"
          },
          "eligible": [
            {
              "threadId": "oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3",
              "eligibility": 0.992751
            },
            {
              "threadId": "oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb",
              "eligibility": 0.992751
            },
            {
              "threadId": "oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac",
              "eligibility": 0.992751
            }
          ],
          "passed": false
        },
        {
          "query": "seguranca da rotacao de toke da interface",
          "depth": 1,
          "durationMs": 15907,
          "interpretation": {
            "correctionApplied": true,
            "effectiveQuery": "seguranca da rotacao de token da interface",
            "mode": "auto",
            "originalQuery": "seguranca da rotacao de toke da interface",
            "suggestedQuery": "seguranca da rotacao de token da interface"
          },
          "eligible": [
            {
              "threadId": "oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3",
              "eligibility": 0.992751
            },
            {
              "threadId": "oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb",
              "eligibility": 0.992751
            },
            {
              "threadId": "oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac",
              "eligibility": 0.992751
            }
          ],
          "passed": false
        }
      ]
    },
    {
      "family": "settings-typo",
      "depth": 1,
      "exitCode": 1,
      "strategy": "hybrid-prefix",
      "caseCount": 1,
      "aggregate": {
        "meanNdcgAt10": 1,
        "meanReciprocalRank": 1,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 0.6666666666666666,
        "eligibilityRecall": 1
      },
      "failures": [
        "structured worksapce settings json depth 1 exposed incidental thread oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4"
      ],
      "cases": [
        {
          "query": "structured worksapce settings json",
          "depth": 1,
          "durationMs": 19330,
          "interpretation": {
            "correctionApplied": true,
            "effectiveQuery": "structured workspace settings json",
            "mode": "auto",
            "originalQuery": "structured worksapce settings json",
            "suggestedQuery": "structured workspace settings json"
          },
          "eligible": [
            {
              "threadId": "oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9",
              "eligibility": 1
            },
            {
              "threadId": "oportunidade-processamento-em-background-para-gerar-memory-aa4908aa",
              "eligibility": 0.980582
            },
            {
              "threadId": "oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4",
              "eligibility": 0.952217
            }
          ],
          "passed": false
        }
      ]
    },
    {
      "family": "negative-finance",
      "depth": 1,
      "exitCode": 0,
      "strategy": "hybrid-prefix",
      "caseCount": 1,
      "aggregate": {
        "meanNdcgAt10": 1,
        "meanReciprocalRank": 0,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 1,
        "eligibilityRecall": 1
      },
      "failures": [],
      "cases": [
        {
          "query": "invoice tax reconciliation for international payments",
          "depth": 1,
          "durationMs": 16145,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "invoice tax reconciliation for international payments",
            "mode": "auto",
            "originalQuery": "invoice tax reconciliation for international payments"
          },
          "eligible": [],
          "passed": true
        }
      ]
    },
    {
      "family": "negative-infrastructure",
      "depth": 1,
      "exitCode": 0,
      "strategy": "hybrid-prefix",
      "caseCount": 1,
      "aggregate": {
        "meanNdcgAt10": 1,
        "meanReciprocalRank": 0,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 1,
        "eligibilityRecall": 1
      },
      "failures": [],
      "cases": [
        {
          "query": "kubernetes autoscaling policy for production clusters",
          "depth": 1,
          "durationMs": 18205,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "kubernetes autoscaling policy for production clusters",
            "mode": "auto",
            "originalQuery": "kubernetes autoscaling policy for production clusters"
          },
          "eligible": [],
          "passed": true
        }
      ]
    },
    {
      "family": "brutalism",
      "depth": 2,
      "exitCode": 0,
      "strategy": "hybrid-prefix",
      "caseCount": 5,
      "aggregate": {
        "meanNdcgAt10": 0.9503916476277743,
        "meanReciprocalRank": 1,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 1,
        "eligibilityRecall": 1
      },
      "failures": [],
      "cases": [
        {
          "query": "brutal",
          "depth": 2,
          "durationMs": 16119,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "brutal",
            "mode": "auto",
            "originalQuery": "brutal"
          },
          "eligible": [
            {
              "threadId": "oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1",
              "eligibility": 0.678763
            }
          ],
          "passed": true
        },
        {
          "query": "brutalismp",
          "depth": 2,
          "durationMs": 15796,
          "interpretation": {
            "correctionApplied": true,
            "effectiveQuery": "brutalism",
            "mode": "auto",
            "originalQuery": "brutalismp",
            "suggestedQuery": "brutalism"
          },
          "eligible": [
            {
              "threadId": "oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1",
              "eligibility": 0.538356
            }
          ],
          "passed": true
        },
        {
          "query": "brutalism",
          "depth": 2,
          "durationMs": 14882,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "brutalism",
            "mode": "auto",
            "originalQuery": "brutalism"
          },
          "eligible": [
            {
              "threadId": "oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1",
              "eligibility": 0.538356
            }
          ],
          "passed": true
        },
        {
          "query": "interface com brutalism",
          "depth": 2,
          "durationMs": 16572,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "interface com brutalism",
            "mode": "auto",
            "originalQuery": "interface com brutalism"
          },
          "eligible": [
            {
              "threadId": "oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1",
              "eligibility": 0.999446
            }
          ],
          "passed": true
        },
        {
          "query": "interace com brutalism",
          "depth": 2,
          "durationMs": 16075,
          "interpretation": {
            "correctionApplied": true,
            "effectiveQuery": "interface com brutalism",
            "mode": "auto",
            "originalQuery": "interace com brutalism",
            "suggestedQuery": "interface com brutalism"
          },
          "eligible": [
            {
              "threadId": "oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1",
              "eligibility": 0.999446
            }
          ],
          "passed": true
        }
      ]
    },
    {
      "family": "toggle",
      "depth": 2,
      "exitCode": 1,
      "strategy": "hybrid-prefix",
      "caseCount": 2,
      "aggregate": {
        "meanNdcgAt10": 0.18038514370700248,
        "meanReciprocalRank": 0.13392857142857142,
        "meanRecallAt10": 0.5,
        "eligibilityPrecision": 1,
        "eligibilityRecall": 0
      },
      "failures": [
        "toggle depth 2 expected oportunidade-processamento-em-background-para-gerar-memory-aa4908aa, received no result",
        "toogle depth 2 expected oportunidade-processamento-em-background-para-gerar-memory-aa4908aa, received no result"
      ],
      "cases": [
        {
          "query": "toggle",
          "depth": 2,
          "durationMs": 16229,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "toggle",
            "mode": "auto",
            "originalQuery": "toggle"
          },
          "eligible": [],
          "passed": false
        },
        {
          "query": "toogle",
          "depth": 2,
          "durationMs": 15504,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "toogle",
            "mode": "auto",
            "originalQuery": "toogle",
            "suggestedQuery": "toggle"
          },
          "eligible": [],
          "passed": false
        }
      ]
    },
    {
      "family": "security",
      "depth": 2,
      "exitCode": 1,
      "strategy": "hybrid-prefix",
      "caseCount": 1,
      "aggregate": {
        "meanNdcgAt10": 1,
        "meanReciprocalRank": 1,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 0.3333333333333333,
        "eligibilityRecall": 1
      },
      "failures": [
        "interface token rotation security depth 2 exposed incidental thread oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb"
      ],
      "cases": [
        {
          "query": "interface token rotation security",
          "depth": 2,
          "durationMs": 41504,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "interface token rotation security",
            "mode": "auto",
            "originalQuery": "interface token rotation security"
          },
          "eligible": [
            {
              "threadId": "oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3",
              "eligibility": 0.976517
            },
            {
              "threadId": "oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb",
              "eligibility": 0.976517
            },
            {
              "threadId": "oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac",
              "eligibility": 0.975779
            }
          ],
          "passed": false
        }
      ]
    },
    {
      "family": "settings",
      "depth": 2,
      "exitCode": 1,
      "strategy": "hybrid-prefix",
      "caseCount": 1,
      "aggregate": {
        "meanNdcgAt10": 1,
        "meanReciprocalRank": 1,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 0.6666666666666666,
        "eligibilityRecall": 1
      },
      "failures": [
        "structured workspace settings json depth 2 exposed incidental thread oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4"
      ],
      "cases": [
        {
          "query": "structured workspace settings json",
          "depth": 2,
          "durationMs": 32451,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "structured workspace settings json",
            "mode": "auto",
            "originalQuery": "structured workspace settings json"
          },
          "eligible": [
            {
              "threadId": "oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9",
              "eligibility": 1
            },
            {
              "threadId": "oportunidade-processamento-em-background-para-gerar-memory-aa4908aa",
              "eligibility": 0.980582
            },
            {
              "threadId": "oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4",
              "eligibility": 0.952217
            }
          ],
          "passed": false
        }
      ]
    },
    {
      "family": "security-pt",
      "depth": 2,
      "exitCode": 1,
      "strategy": "hybrid-prefix",
      "caseCount": 2,
      "aggregate": {
        "meanNdcgAt10": 1,
        "meanReciprocalRank": 1,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 0.3333333333333333,
        "eligibilityRecall": 1
      },
      "failures": [
        "seguranca da rotacao de token da interface depth 2 exposed incidental thread oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb",
        "seguranca da rotacao de toke da interface depth 2 exposed incidental thread oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb"
      ],
      "cases": [
        {
          "query": "seguranca da rotacao de token da interface",
          "depth": 2,
          "durationMs": 34195,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "seguranca da rotacao de token da interface",
            "mode": "auto",
            "originalQuery": "seguranca da rotacao de token da interface"
          },
          "eligible": [
            {
              "threadId": "oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3",
              "eligibility": 0.992751
            },
            {
              "threadId": "oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb",
              "eligibility": 0.992751
            },
            {
              "threadId": "oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac",
              "eligibility": 0.992751
            }
          ],
          "passed": false
        },
        {
          "query": "seguranca da rotacao de toke da interface",
          "depth": 2,
          "durationMs": 36965,
          "interpretation": {
            "correctionApplied": true,
            "effectiveQuery": "seguranca da rotacao de token da interface",
            "mode": "auto",
            "originalQuery": "seguranca da rotacao de toke da interface",
            "suggestedQuery": "seguranca da rotacao de token da interface"
          },
          "eligible": [
            {
              "threadId": "oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3",
              "eligibility": 0.992751
            },
            {
              "threadId": "oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb",
              "eligibility": 0.992751
            },
            {
              "threadId": "oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac",
              "eligibility": 0.992751
            }
          ],
          "passed": false
        }
      ]
    },
    {
      "family": "settings-typo",
      "depth": 2,
      "exitCode": 1,
      "strategy": "hybrid-prefix",
      "caseCount": 1,
      "aggregate": {
        "meanNdcgAt10": 1,
        "meanReciprocalRank": 1,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 0.6666666666666666,
        "eligibilityRecall": 1
      },
      "failures": [
        "structured worksapce settings json depth 2 exposed incidental thread oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4"
      ],
      "cases": [
        {
          "query": "structured worksapce settings json",
          "depth": 2,
          "durationMs": 24422,
          "interpretation": {
            "correctionApplied": true,
            "effectiveQuery": "structured workspace settings json",
            "mode": "auto",
            "originalQuery": "structured worksapce settings json",
            "suggestedQuery": "structured workspace settings json"
          },
          "eligible": [
            {
              "threadId": "oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9",
              "eligibility": 1
            },
            {
              "threadId": "oportunidade-processamento-em-background-para-gerar-memory-aa4908aa",
              "eligibility": 0.980582
            },
            {
              "threadId": "oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4",
              "eligibility": 0.952217
            }
          ],
          "passed": false
        }
      ]
    },
    {
      "family": "negative-finance",
      "depth": 2,
      "exitCode": 0,
      "strategy": "hybrid-prefix",
      "caseCount": 1,
      "aggregate": {
        "meanNdcgAt10": 1,
        "meanReciprocalRank": 0,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 1,
        "eligibilityRecall": 1
      },
      "failures": [],
      "cases": [
        {
          "query": "invoice tax reconciliation for international payments",
          "depth": 2,
          "durationMs": 19262,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "invoice tax reconciliation for international payments",
            "mode": "auto",
            "originalQuery": "invoice tax reconciliation for international payments"
          },
          "eligible": [],
          "passed": true
        }
      ]
    },
    {
      "family": "negative-infrastructure",
      "depth": 2,
      "exitCode": 0,
      "strategy": "hybrid-prefix",
      "caseCount": 1,
      "aggregate": {
        "meanNdcgAt10": 1,
        "meanReciprocalRank": 0,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 1,
        "eligibilityRecall": 1
      },
      "failures": [],
      "cases": [
        {
          "query": "kubernetes autoscaling policy for production clusters",
          "depth": 2,
          "durationMs": 19062,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "kubernetes autoscaling policy for production clusters",
            "mode": "auto",
            "originalQuery": "kubernetes autoscaling policy for production clusters"
          },
          "eligible": [],
          "passed": true
        }
      ]
    },
    {
      "family": "brutalism",
      "depth": 3,
      "exitCode": 0,
      "strategy": "hybrid-prefix",
      "caseCount": 5,
      "aggregate": {
        "meanNdcgAt10": 0.9503916476277743,
        "meanReciprocalRank": 1,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 1,
        "eligibilityRecall": 1
      },
      "failures": [],
      "cases": [
        {
          "query": "brutal",
          "depth": 3,
          "durationMs": 16280,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "brutal",
            "mode": "auto",
            "originalQuery": "brutal"
          },
          "eligible": [
            {
              "threadId": "oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1",
              "eligibility": 0.678763
            }
          ],
          "passed": true
        },
        {
          "query": "brutalismp",
          "depth": 3,
          "durationMs": 16985,
          "interpretation": {
            "correctionApplied": true,
            "effectiveQuery": "brutalism",
            "mode": "auto",
            "originalQuery": "brutalismp",
            "suggestedQuery": "brutalism"
          },
          "eligible": [
            {
              "threadId": "oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1",
              "eligibility": 0.538356
            }
          ],
          "passed": true
        },
        {
          "query": "brutalism",
          "depth": 3,
          "durationMs": 14215,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "brutalism",
            "mode": "auto",
            "originalQuery": "brutalism"
          },
          "eligible": [
            {
              "threadId": "oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1",
              "eligibility": 0.538356
            }
          ],
          "passed": true
        },
        {
          "query": "interface com brutalism",
          "depth": 3,
          "durationMs": 14266,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "interface com brutalism",
            "mode": "auto",
            "originalQuery": "interface com brutalism"
          },
          "eligible": [
            {
              "threadId": "oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1",
              "eligibility": 0.999446
            }
          ],
          "passed": true
        },
        {
          "query": "interace com brutalism",
          "depth": 3,
          "durationMs": 13576,
          "interpretation": {
            "correctionApplied": true,
            "effectiveQuery": "interface com brutalism",
            "mode": "auto",
            "originalQuery": "interace com brutalism",
            "suggestedQuery": "interface com brutalism"
          },
          "eligible": [
            {
              "threadId": "oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1",
              "eligibility": 0.999446
            }
          ],
          "passed": true
        }
      ]
    },
    {
      "family": "toggle",
      "depth": 3,
      "exitCode": 1,
      "strategy": "hybrid-prefix",
      "caseCount": 2,
      "aggregate": {
        "meanNdcgAt10": 0.18038514370700248,
        "meanReciprocalRank": 0.13392857142857142,
        "meanRecallAt10": 0.5,
        "eligibilityPrecision": 1,
        "eligibilityRecall": 0
      },
      "failures": [
        "toggle depth 3 expected oportunidade-processamento-em-background-para-gerar-memory-aa4908aa, received no result",
        "toogle depth 3 expected oportunidade-processamento-em-background-para-gerar-memory-aa4908aa, received no result"
      ],
      "cases": [
        {
          "query": "toggle",
          "depth": 3,
          "durationMs": 16195,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "toggle",
            "mode": "auto",
            "originalQuery": "toggle"
          },
          "eligible": [],
          "passed": false
        },
        {
          "query": "toogle",
          "depth": 3,
          "durationMs": 13410,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "toogle",
            "mode": "auto",
            "originalQuery": "toogle",
            "suggestedQuery": "toggle"
          },
          "eligible": [],
          "passed": false
        }
      ]
    },
    {
      "family": "security",
      "depth": 3,
      "exitCode": 1,
      "strategy": "hybrid-prefix",
      "caseCount": 1,
      "aggregate": {
        "meanNdcgAt10": 1,
        "meanReciprocalRank": 1,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 0.3333333333333333,
        "eligibilityRecall": 1
      },
      "failures": [
        "interface token rotation security depth 3 exposed incidental thread oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb"
      ],
      "cases": [
        {
          "query": "interface token rotation security",
          "depth": 3,
          "durationMs": 16383,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "interface token rotation security",
            "mode": "auto",
            "originalQuery": "interface token rotation security"
          },
          "eligible": [
            {
              "threadId": "oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3",
              "eligibility": 0.976517
            },
            {
              "threadId": "oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb",
              "eligibility": 0.976517
            },
            {
              "threadId": "oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac",
              "eligibility": 0.975779
            }
          ],
          "passed": false
        }
      ]
    },
    {
      "family": "settings",
      "depth": 3,
      "exitCode": 1,
      "strategy": "hybrid-prefix",
      "caseCount": 1,
      "aggregate": {
        "meanNdcgAt10": 1,
        "meanReciprocalRank": 1,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 0.6666666666666666,
        "eligibilityRecall": 1
      },
      "failures": [
        "structured workspace settings json depth 3 exposed incidental thread oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4"
      ],
      "cases": [
        {
          "query": "structured workspace settings json",
          "depth": 3,
          "durationMs": 17168,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "structured workspace settings json",
            "mode": "auto",
            "originalQuery": "structured workspace settings json"
          },
          "eligible": [
            {
              "threadId": "oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9",
              "eligibility": 1
            },
            {
              "threadId": "oportunidade-processamento-em-background-para-gerar-memory-aa4908aa",
              "eligibility": 0.980582
            },
            {
              "threadId": "oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4",
              "eligibility": 0.952217
            }
          ],
          "passed": false
        }
      ]
    },
    {
      "family": "security-pt",
      "depth": 3,
      "exitCode": 1,
      "strategy": "hybrid-prefix",
      "caseCount": 2,
      "aggregate": {
        "meanNdcgAt10": 1,
        "meanReciprocalRank": 1,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 0.3333333333333333,
        "eligibilityRecall": 1
      },
      "failures": [
        "seguranca da rotacao de token da interface depth 3 exposed incidental thread oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb",
        "seguranca da rotacao de toke da interface depth 3 exposed incidental thread oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb"
      ],
      "cases": [
        {
          "query": "seguranca da rotacao de token da interface",
          "depth": 3,
          "durationMs": 18840,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "seguranca da rotacao de token da interface",
            "mode": "auto",
            "originalQuery": "seguranca da rotacao de token da interface"
          },
          "eligible": [
            {
              "threadId": "oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3",
              "eligibility": 0.992751
            },
            {
              "threadId": "oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb",
              "eligibility": 0.992751
            },
            {
              "threadId": "oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac",
              "eligibility": 0.992751
            }
          ],
          "passed": false
        },
        {
          "query": "seguranca da rotacao de toke da interface",
          "depth": 3,
          "durationMs": 14555,
          "interpretation": {
            "correctionApplied": true,
            "effectiveQuery": "seguranca da rotacao de token da interface",
            "mode": "auto",
            "originalQuery": "seguranca da rotacao de toke da interface",
            "suggestedQuery": "seguranca da rotacao de token da interface"
          },
          "eligible": [
            {
              "threadId": "oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3",
              "eligibility": 0.992751
            },
            {
              "threadId": "oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb",
              "eligibility": 0.992751
            },
            {
              "threadId": "oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac",
              "eligibility": 0.992751
            }
          ],
          "passed": false
        }
      ]
    },
    {
      "family": "settings-typo",
      "depth": 3,
      "exitCode": 1,
      "strategy": "hybrid-prefix",
      "caseCount": 1,
      "aggregate": {
        "meanNdcgAt10": 1,
        "meanReciprocalRank": 1,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 0.6666666666666666,
        "eligibilityRecall": 1
      },
      "failures": [
        "structured worksapce settings json depth 3 exposed incidental thread oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4"
      ],
      "cases": [
        {
          "query": "structured worksapce settings json",
          "depth": 3,
          "durationMs": 18854,
          "interpretation": {
            "correctionApplied": true,
            "effectiveQuery": "structured workspace settings json",
            "mode": "auto",
            "originalQuery": "structured worksapce settings json",
            "suggestedQuery": "structured workspace settings json"
          },
          "eligible": [
            {
              "threadId": "oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9",
              "eligibility": 1
            },
            {
              "threadId": "oportunidade-processamento-em-background-para-gerar-memory-aa4908aa",
              "eligibility": 0.980582
            },
            {
              "threadId": "oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4",
              "eligibility": 0.952217
            }
          ],
          "passed": false
        }
      ]
    },
    {
      "family": "negative-finance",
      "depth": 3,
      "exitCode": 0,
      "strategy": "hybrid-prefix",
      "caseCount": 1,
      "aggregate": {
        "meanNdcgAt10": 1,
        "meanReciprocalRank": 0,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 1,
        "eligibilityRecall": 1
      },
      "failures": [],
      "cases": [
        {
          "query": "invoice tax reconciliation for international payments",
          "depth": 3,
          "durationMs": 16016,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "invoice tax reconciliation for international payments",
            "mode": "auto",
            "originalQuery": "invoice tax reconciliation for international payments"
          },
          "eligible": [],
          "passed": true
        }
      ]
    },
    {
      "family": "negative-infrastructure",
      "depth": 3,
      "exitCode": 0,
      "strategy": "hybrid-prefix",
      "caseCount": 1,
      "aggregate": {
        "meanNdcgAt10": 1,
        "meanReciprocalRank": 0,
        "meanRecallAt10": 1,
        "eligibilityPrecision": 1,
        "eligibilityRecall": 1
      },
      "failures": [],
      "cases": [
        {
          "query": "kubernetes autoscaling policy for production clusters",
          "depth": 3,
          "durationMs": 17605,
          "interpretation": {
            "correctionApplied": false,
            "effectiveQuery": "kubernetes autoscaling policy for production clusters",
            "mode": "auto",
            "originalQuery": "kubernetes autoscaling policy for production clusters"
          },
          "eligible": [],
          "passed": true
        }
      ]
    }
  ]
}
```
