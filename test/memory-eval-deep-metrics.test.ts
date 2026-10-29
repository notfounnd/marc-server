import assert from "node:assert/strict";
import test from "node:test";
import type { DepthPool } from "../src/core/memory/deep-pool.js";
import type { EvidenceMatch } from "../scripts/memory-eval/matrix-plan.js";
import {
  classifyFailure,
  type FailureInput
} from "../scripts/memory-eval/deep-classes.js";
import { metricsOf } from "../scripts/memory-eval/deep-metrics.js";
import {
  allPassages,
  metricsOfFixture,
  okRun,
  OTHER_THREAD,
  passageIdOf,
  SCOPE_PASSAGES,
  SCOPE_QUOTE,
  SCOPE_SUMMARY,
  scopedCase
} from "./memory-eval-deep-fixtures.js";

const [S1, S2, S3, S4] = SCOPE_PASSAGES.map((item) => passageIdOf(item));
const OTHER_PASSAGE = allPassages()[4]!;
const OUTSIDE = `${OTHER_THREAD}-outside`;

function evidenceOf(
  passageIds: string[],
  status: EvidenceMatch["status"] = "indexed"
): EvidenceMatch[] {
  return [
    { sourcePath: SCOPE_SUMMARY, quote: SCOPE_QUOTE, passageIds, status }
  ];
}

/** The pool of depth 2 with the given entries: each one is a passage of a group, consolidated. */
function poolWith(
  entries: Array<{ threadId: string; passageId: string }>
): DepthPool {
  return {
    ranked: [],
    passageScores: new Map(),
    entries: entries.map((entry, index) => ({
      candidate: {},
      evidence: {
        denseRank: index + 1,
        vectorScore: 0.5,
        record: {
          kind: "passage",
          threadId: entry.threadId,
          passageId: entry.passageId,
          recordId: `rec-${index}`
        }
      }
    })) as unknown as DepthPool["entries"]
  } as unknown as DepthPool;
}

function failure(overrides: Partial<FailureInput>): FailureInput {
  return {
    scoped: true,
    evidence: evidenceOf([S1]),
    deep: metricsOfFixture({
      variant: "DEEP",
      success: false,
      truncated: false
    }),
    deepAll: metricsOfFixture({
      variant: "DEEP_ALL",
      success: false,
      truncated: false
    }),
    deepRankedIds: [S4, S2],
    ...overrides
  };
}

const scopeCase = scopedCase({
  passageJudgments: { [S1]: 2, [S2]: 0, [S3]: 0, [S4]: 0 }
});

test("the metrics of DEEP are the values computed by hand over the first five", () => {
  const run = okRun("DEEP", [
    [S4, 0.9999],
    [S2, 0.9],
    [S3, 0.5],
    [S1, 0.2]
  ]);
  const evalCase = scopedCase({
    passageJudgments: { [S4]: 0, [S2]: 2, [S3]: 3, [S1]: 0 }
  });
  const metrics = metricsOf(run, evalCase);
  assert.equal(metrics.status, "ok");
  assert.equal(metrics.success, true);
  assert.equal(metrics.mrr, 0.5);
  assert.equal(metrics.precision5, 2 / 5);
  assert.equal(metrics.saturated, 1);
  assert.equal(metrics.scopeConform, true);
  assert.deepEqual(metrics.top5, [S4, S2, S3, S1]);
});

test("a passage without a grade in the first five makes the variant incomplete, and is never read as zero", () => {
  const run = okRun("DEEP", [
    [S4, 0.9999],
    [S2, 0.9],
    [S3, 0.5]
  ]);
  const evalCase = scopedCase({ passageJudgments: { [S4]: 0, [S2]: 0 } });
  const metrics = metricsOf(run, evalCase);
  assert.equal(metrics.status, "incomplete");
  assert.equal(metrics.reason, "missing-grade");
  assert.equal(metrics.success, false);
  assert.deepEqual(metrics.top5, []);
});

test("a passage without a grade outside the first five does not make the variant incomplete", () => {
  const graded5 = passageIdOf(OTHER_PASSAGE);
  const run = okRun("DEEP", [
    [S4, 0.9999],
    [S2, 0.9],
    [S3, 0.5],
    [S1, 0.2],
    [graded5, 0.1],
    [OUTSIDE, 0.05]
  ]);
  const evalCase = scopedCase({
    passageJudgments: { [S4]: 0, [S2]: 2, [S3]: 0, [S1]: 0, [graded5]: 0 }
  });
  const metrics = metricsOf(run, evalCase);
  assert.equal(metrics.status, "ok");
  assert.equal(metrics.success, true);
});

test("a result outside the scope breaks the scope conformance of the variant", () => {
  const run = okRun("DEEP", [
    [S4, 0.9],
    [S1, 0.8]
  ]);
  const leaked = {
    ...run,
    ranked: [run.ranked[0]!, { ...run.ranked[1]!, threadId: OTHER_THREAD }]
  };
  const metrics = metricsOf(leaked, scopeCase);
  assert.equal(metrics.scopeConform, false);
});

test("a missing pair makes the metrics incomplete, with the reason", () => {
  const metrics = metricsOf(
    { variant: "DEEP", status: "incomplete", reason: "missing-pair" },
    scopeCase
  );
  assert.equal(metrics.status, "incomplete");
  assert.equal(metrics.reason, "missing-pair");
});

test("the cap class holds when the scope is truncated and DEEP_ALL succeeds", () => {
  const decision = classifyFailure(
    failure({
      deep: metricsOfFixture({
        variant: "DEEP",
        success: false,
        truncated: true
      }),
      deepAll: metricsOfFixture({ variant: "DEEP_ALL", success: true })
    })
  );
  assert.deepEqual(decision, {
    class: "cap",
    reference: "DEEP_ALL",
    alsoTruncated: false
  });
});

test("the ordering class carries alsoTruncated when the evidence lies outside the budget and DEEP_ALL fails", () => {
  const outside = classifyFailure(
    failure({
      deep: metricsOfFixture({
        variant: "DEEP",
        success: false,
        truncated: true
      }),
      evidence: evidenceOf([S1]),
      deepRankedIds: [S4, S2]
    })
  );
  const inside = classifyFailure(
    failure({
      deep: metricsOfFixture({
        variant: "DEEP",
        success: false,
        truncated: true
      }),
      evidence: evidenceOf([S1]),
      deepRankedIds: [S4, S1]
    })
  );
  assert.deepEqual(outside, {
    class: "ordering",
    reference: "DEEP_ALL",
    alsoTruncated: true
  });
  assert.deepEqual(inside, {
    class: "ordering",
    reference: "DEEP_ALL",
    alsoTruncated: false
  });
});

test("segmentation takes precedence over the cap, which would otherwise hold", () => {
  const decision = classifyFailure(
    failure({
      evidence: evidenceOf([], "evidence_unindexable"),
      deep: metricsOfFixture({
        variant: "DEEP",
        success: false,
        truncated: true
      }),
      deepAll: metricsOfFixture({ variant: "DEEP_ALL", success: true })
    })
  );
  assert.deepEqual(decision, {
    class: "segmentation",
    reference: "DEEP",
    alsoTruncated: false
  });
});

test("the admission class holds when the evidence group is not admitted in the unscoped pool", () => {
  const decision = classifyFailure(
    failure({
      scoped: false,
      evidence: evidenceOf([S1]),
      pool: poolWith([
        { threadId: SCOPE_PASSAGES[0]!.threadId, passageId: S1 }
      ]),
      admittedGroups: new Set([OTHER_THREAD])
    })
  );
  assert.deepEqual(decision, {
    class: "admission/pool",
    reference: "DEEP",
    alsoTruncated: false
  });
});

test("the admission class holds when the admitted group has no consolidated passage that holds the quote", () => {
  const decision = classifyFailure(
    failure({
      scoped: false,
      evidence: evidenceOf([S1]),
      pool: poolWith([
        { threadId: SCOPE_PASSAGES[0]!.threadId, passageId: S2 }
      ]),
      admittedGroups: new Set([SCOPE_PASSAGES[0]!.threadId])
    })
  );
  assert.equal(decision.class, "admission/pool");
});

test("a pool passage without a grade outside every top five does not produce the admission class", () => {
  const decision = classifyFailure(
    failure({
      scoped: false,
      evidence: evidenceOf([S1]),
      pool: poolWith([
        { threadId: SCOPE_PASSAGES[0]!.threadId, passageId: S1 },
        { threadId: SCOPE_PASSAGES[0]!.threadId, passageId: S3 }
      ]),
      admittedGroups: new Set([SCOPE_PASSAGES[0]!.threadId]),
      deepRankedIds: [S4, S2, S1, S3, OUTSIDE]
    })
  );
  assert.equal(decision.class, "ordering");
  assert.notEqual(decision.class, "admission/pool");
});
