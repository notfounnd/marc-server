import assert from "node:assert/strict";
import test from "node:test";
import type { RerankingProviderMetadata } from "../src/core/memory/types.js";
import type {
  CapturedCase,
  CapturedRecord
} from "../scripts/memory-eval/capture-types.js";
import type {
  EvalCase,
  RelevanceGrade
} from "../scripts/memory-eval/dataset.js";
import {
  deepReportOf,
  runDeepCases,
  type CaseRuns,
  type DeepInputs
} from "../scripts/memory-eval/deep-run.js";
import {
  runDeepVariants,
  type VariantRuns
} from "../scripts/memory-eval/deep-variants.js";
import type { EvidenceMatch } from "../scripts/memory-eval/matrix-plan.js";
import {
  capturedRecordOf,
  okRun,
  pairKeyOf,
  passageIdOf,
  QUERY,
  SCOPE_PASSAGES,
  SCOPE_THREAD
} from "./memory-eval-deep-fixtures.js";

/** Each scoped case of the reproduction holds 233 passages: more than the core budget of 232. */
const ROWS = 233;
const SCOPED_CASES = 10;
const UNSCOPED_CASES = 4;
const USEFUL_SCORE = 0.99;
const WEAK_SCORE = 0.1;
const USEFUL_GRADE: RelevanceGrade = 2;
const WEAK_GRADE: RelevanceGrade = 0;

/** Scores by row index: row 0 is weak, row 1 is useful, and the remaining rows are weak distractors. */
const ROW_SCORES: readonly number[] = [
  WEAK_SCORE,
  USEFUL_SCORE,
  ...Array.from({ length: ROWS - 2 }, () => WEAK_SCORE)
];

/** Grades by row index, in the same order as ROW_SCORES: only row 1 is judged relevant. */
const ROW_GRADES: readonly RelevanceGrade[] = [
  WEAK_GRADE,
  USEFUL_GRADE,
  ...Array.from({ length: ROWS - 2 }, () => WEAK_GRADE)
];

type Case = CaseRuns & { evidence: EvidenceMatch[] };

function hexOf(index: number): string {
  return index.toString(16).padStart(16, "0");
}

/**
 * The passages of one scoped case. Row 0 is the closest by cosine and carries a weak score; row 1 is the useful
 * passage, second by cosine and first by score. So a budget of one keeps only row 0, and a budget of 231 or 232
 * keeps row 1.
 */
function scopedSpecs(k: number) {
  const threadId = `thread-repro-${k}`;
  const sourcePath = `.marc/threads/${threadId}/SUMMARY.md`;
  return Array.from({ length: ROWS }, (_, index) => ({
    recordId: `case${k}-row${index}`,
    threadId,
    sourcePath,
    passageHex: hexOf(index + 1),
    vector: [Math.cos(index * 0.001), Math.sin(index * 0.001)],
    score: ROW_SCORES[index]!,
    text: `caso ${k} trecho ${index}`,
    sourceType: "summary" as const
  }));
}

/** One scoped case, run for real over its own capture by runDeepVariants, with the given budget of the recuo. */
async function scopedCase(
  k: number,
  deepBudget: number | undefined
): Promise<Case> {
  const specs = scopedSpecs(k);
  const useful = passageIdOf(specs[1]!);
  const sourcePath = specs[1]!.sourcePath.replace(".marc/", "");
  const evalCase: EvalCase = {
    id: `D-scoped-${k}`,
    family: "repro",
    style: "deep",
    query: QUERY,
    queryMode: "auto",
    judgments: {},
    evidence: [{ sourcePath, quote: "caso trecho" }],
    scope: { threadId: specs[0]!.threadId },
    passageJudgments: Object.fromEntries(
      specs.map(
        (item, index) => [passageIdOf(item), ROW_GRADES[index]!] as const
      )
    ),
    origin: "reproduction"
  };
  const captured = {
    id: `C-repro-${k}`,
    interpretation: { effectiveQuery: QUERY },
    queryVectors: { [QUERY]: [1, 0] },
    rerankScores: Object.fromEntries(
      specs.map((item) => [pairKeyOf(item), item.score] as const)
    )
  } as unknown as CapturedCase;
  const records = new Map<string, CapturedRecord>(
    specs.map((item) => [item.recordId, capturedRecordOf(item)] as const)
  );
  const vectors = new Map(
    specs.map((item) => [item.recordId, item.vector] as const)
  );
  const caseRuns = await runDeepVariants({
    evalCase,
    captured,
    records,
    vectors,
    rerankerMetadata: {} as RerankingProviderMetadata,
    deepBudget
  });
  const evidence: EvidenceMatch[] = [
    {
      sourcePath,
      quote: "caso trecho",
      passageIds: [useful],
      status: "indexed"
    }
  ];
  return { evalCase, captured, caseRuns, evidence };
}

/** One unscoped case with its runs ready: the pool is not the subject of this test. DEEP_BUDGET succeeds here. */
function unscopedCase(k: number): Case {
  const useful = passageIdOf(SCOPE_PASSAGES[0]!);
  const distractor = passageIdOf(SCOPE_PASSAGES[1]!);
  const evalCase: EvalCase = {
    id: `D-unscoped-${k}`,
    family: "repro",
    style: "deep",
    query: QUERY,
    queryMode: "auto",
    judgments: {},
    evidence: [
      { sourcePath: `threads/${SCOPE_THREAD}/SUMMARY.md`, quote: "trecho" }
    ],
    passageJudgments: { [useful]: 2, [distractor]: 0 },
    origin: "reproduction"
  };
  const runs: VariantRuns = {
    DEEP: okRun("DEEP", [
      [useful, 0.99],
      [distractor, 0.1]
    ]),
    DEEP_ALL: okRun("DEEP_ALL", [
      [useful, 0.99],
      [distractor, 0.1]
    ]),
    DEEP_COSINE: okRun("DEEP_COSINE", [
      [useful, undefined],
      [distractor, undefined]
    ]),
    DEEP_BUDGET: okRun("DEEP_BUDGET", [
      [useful, 0.99],
      [distractor, 0.1]
    ])
  };
  return {
    evalCase,
    captured: { id: evalCase.id } as unknown as CapturedCase,
    caseRuns: { runs, admittedGroups: new Set([SCOPE_THREAD]) },
    evidence: [
      {
        sourcePath: `threads/${SCOPE_THREAD}/SUMMARY.md`,
        quote: "trecho",
        passageIds: [useful],
        status: "indexed"
      }
    ]
  };
}

/** The fourteen cases of the protocol: ten scoped cases run over their captures, and four unscoped cases ready. */
async function fourteenCases(
  deepBudget: number | undefined
): Promise<{ runs: CaseRuns[]; evidence: Map<string, EvidenceMatch[]> }> {
  const cases: Case[] = [];
  for (let k = 0; k < SCOPED_CASES; k += 1)
    cases.push(await scopedCase(k, deepBudget));
  for (let k = 0; k < UNSCOPED_CASES; k += 1) cases.push(unscopedCase(k));
  const evidence = new Map(
    cases.map((item) => [item.evalCase.id, item.evidence] as const)
  );
  const runs = cases.map(({ evalCase, captured, caseRuns }) => ({
    evalCase,
    captured,
    caseRuns
  }));
  return { runs, evidence };
}

test("the reproduction: a recuo of B'=1 fails the gate with 4 of 14, while DEEP keeps 14 of 14", async () => {
  const { runs, evidence } = await fourteenCases(1);
  const report = deepReportOf(runs, evidence, 1, "C-repro");
  assert.equal(report.adoptedVariant, "DEEP_BUDGET");
  assert.equal(report.deepBudget, 1);
  assert.equal(report.protocol.protocolIncomplete, false);
  assert.equal(report.protocol.scopedAboveBudget, SCOPED_CASES);
  assert.equal(report.summary.success.DEEP, 14);
  assert.equal(report.summary.successAdopted, 4);
  assert.equal(report.gate.applied, true);
  assert.equal(report.gate.successAdopted, 4);
  assert.equal(report.gate.passed, false);
  assert.equal(report.summary.failures.cap, SCOPED_CASES);
  assert.equal(
    report.cases.some((item) => item.incomplete),
    false
  );
});

test("a complete recuo with fourteen of fourteen successes passes the gate", async () => {
  const { runs, evidence } = await fourteenCases(231);
  const report = deepReportOf(runs, evidence, 231, "C-repro");
  assert.equal(report.adoptedVariant, "DEEP_BUDGET");
  assert.equal(report.gate.successAdopted, 14);
  assert.equal(report.gate.passed, true);
});

test("without a budget the adopted variant is DEEP, and the gate reads DEEP as before", async () => {
  const { runs, evidence } = await fourteenCases(undefined);
  const report = deepReportOf(runs, evidence, undefined, "C-repro");
  assert.equal(report.adoptedVariant, "DEEP");
  assert.equal(report.deepBudget, null);
  assert.equal(report.summary.successAdopted, report.summary.success.DEEP);
  assert.equal(report.gate.successAdopted, 14);
  assert.equal(report.gate.passed, true);
});

test("a budget outside 1 to 231 is refused by the report and by the runs, before any case is read", async () => {
  const { runs, evidence } = await fourteenCases(undefined);
  for (const invalid of [0, 232, 1.5]) {
    assert.throws(
      () => deepReportOf(runs, evidence, invalid, "C-repro"),
      /from 1 to 231/
    );
  }
  await assert.rejects(runDeepCases({} as DeepInputs, 232), /from 1 to 231/);
});

test("the report holds the DEEP baseline and the adopted variant side by side", async () => {
  const { runs, evidence } = await fourteenCases(1);
  const report = deepReportOf(runs, evidence, 1, "C-repro");
  const first = report.cases.find((item) => item.id === "D-scoped-0");
  assert.equal(first?.variants.DEEP?.success, true);
  assert.equal(first?.variants.DEEP_BUDGET?.status, "ok");
  assert.equal(first?.successAdopted, false);
  assert.equal(
    report.cases.every((item) => item.variants.DEEP?.success === true),
    true
  );
});
