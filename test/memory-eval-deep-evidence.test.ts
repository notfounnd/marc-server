import assert from "node:assert/strict";
import test from "node:test";
import type { DepthPool } from "../src/core/memory/deep-pool.js";
import type { EvidenceMatch } from "../scripts/memory-eval/matrix-plan.js";
import {
  classifyFailure,
  type FailureInput
} from "../scripts/memory-eval/deep-classes.js";
import { caseReportOf } from "../scripts/memory-eval/deep-run.js";
import type { VariantRuns } from "../scripts/memory-eval/deep-variants.js";
import {
  caseRunsOf,
  metricsOfFixture,
  okRun,
  passageIdOf,
  SCOPE_PASSAGES,
  SCOPE_QUOTE,
  SCOPE_SUMMARY,
  SCOPE_THREAD,
  scopedCase
} from "./memory-eval-deep-fixtures.js";

const [S1, S2, S3, S4] = SCOPE_PASSAGES.map((item) => passageIdOf(item));

function quote(
  passageIds: string[],
  status: EvidenceMatch["status"]
): EvidenceMatch {
  return { sourcePath: SCOPE_SUMMARY, quote: SCOPE_QUOTE, passageIds, status };
}

/** A pool whose consolidated entries are the given passages of the scope thread. */
function poolWith(passageIds: string[]): DepthPool {
  return {
    ranked: [],
    passageScores: new Map(),
    entries: passageIds.map((passageId, index) => ({
      candidate: {},
      evidence: {
        denseRank: index + 1,
        vectorScore: 0.5,
        record: {
          kind: "passage",
          threadId: SCOPE_THREAD,
          passageId,
          recordId: `rec-${index}`
        }
      }
    })) as unknown as DepthPool["entries"]
  } as unknown as DepthPool;
}

/** A failing, complete case with the given evidence. The default is scoped, with DEEP_ALL failing too. */
function failing(overrides: Partial<FailureInput>): FailureInput {
  return {
    scoped: true,
    evidence: [quote([S1], "indexed")],
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

test("segmentation is not decided when one quote is indexed beside an unindexable one", () => {
  const decision = classifyFailure(
    failing({
      evidence: [quote([], "evidence_unindexable"), quote([S1], "indexed")]
    })
  );
  assert.notEqual(decision.class, "segmentation");
  assert.equal(decision.class, "ordering");
});

test("segmentation holds when every quote of the case is unindexable", () => {
  const decision = classifyFailure(
    failing({
      evidence: [
        quote([], "evidence_unindexable"),
        quote([], "evidence_unindexable")
      ]
    })
  );
  assert.deepEqual(decision, {
    class: "segmentation",
    reference: "DEEP",
    alsoTruncated: false
  });
});

test("admission/pool is not decided when one indexed quote is held by the pool", () => {
  const decision = classifyFailure(
    failing({
      scoped: false,
      evidence: [quote([S1], "indexed"), quote([S2], "indexed")],
      pool: poolWith([S1]),
      admittedGroups: new Set([SCOPE_THREAD])
    })
  );
  assert.equal(decision.class, "ordering");
});

test("admission/pool holds when no indexed quote is held by the pool", () => {
  const decision = classifyFailure(
    failing({
      scoped: false,
      evidence: [quote([S1], "indexed"), quote([S2], "indexed")],
      pool: poolWith([S3]),
      admittedGroups: new Set([SCOPE_THREAD])
    })
  );
  assert.deepEqual(decision, {
    class: "admission/pool",
    reference: "DEEP",
    alsoTruncated: false
  });
});

test("a missing quote makes the case incomplete with the missing-evidence reason, and gives it no class", () => {
  const evalCase = scopedCase({
    passageJudgments: { [S1]: 0, [S2]: 0, [S3]: 0, [S4]: 0 }
  });
  const runs: VariantRuns = {
    DEEP: okRun("DEEP", [
      [S4, 0.9999],
      [S2, 0.9]
    ]),
    DEEP_ALL: okRun("DEEP_ALL", [
      [S4, 0.9999],
      [S2, 0.9]
    ]),
    DEEP_COSINE: okRun("DEEP_COSINE", [
      [S1, undefined],
      [S4, undefined]
    ])
  };
  const missing = caseReportOf(
    caseRunsOf(evalCase, runs),
    [quote([], "missing")],
    "DEEP"
  );
  assert.equal(missing.incomplete, true);
  assert.deepEqual(missing.incompleteReasons, ["missing-evidence"]);
  assert.equal(missing.failure, null);
  const indexed = caseReportOf(
    caseRunsOf(evalCase, runs),
    [quote([S1], "indexed")],
    "DEEP"
  );
  assert.equal(indexed.incomplete, false);
  assert.notEqual(indexed.failure, null);
});
