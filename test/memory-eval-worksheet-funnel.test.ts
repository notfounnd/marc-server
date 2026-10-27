import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { funnelConfigOf } from "../scripts/memory-eval/funnel-variants.js";
import { replayCapture, funnelInputOf } from "../scripts/memory-eval/replay.js";
import {
  funnelParamsOf,
  funnelWorksheetGridOf
} from "../scripts/memory-eval/replay-funnel.js";
import { exhaustiveReachesOf } from "../scripts/memory-eval/worksheet-reach.js";
import {
  exhaustiveReachOf,
  type FunnelParams
} from "../scripts/memory-eval/variants.js";
import { runFunnel } from "../src/core/memory/funnel-run.js";
import { dataset } from "./memory-eval-capture-fixtures.js";
import { e3WorksheetCapture } from "./memory-eval-worksheet-fixtures.js";

const BUDGET = 232;
const COSINE: FunnelParams = {
  budget: BUDGET,
  k: 12,
  mode: "cosine",
  exhaustiveSteps: true
};
const COSINE_FTS: FunnelParams = {
  budget: BUDGET,
  k: 12,
  mode: "cosine-fts",
  exhaustiveSteps: true
};
/** Band cuts that every eligibility reaches: an ADAPTIVE replay with them stops at layer 0. */
const CUTS_BELOW_EVERY_ELIGIBILITY = { high: -1, medium: -1 };

test("the worksheet grid is every K with every mode, all exhaustive, and it refuses a missing or invalid value", () => {
  const grid = funnelWorksheetGridOf({
    budget: "232",
    ks: "8,12",
    modes: "cosine,cosine-fts"
  });
  assert.deepEqual(
    grid?.map((item) => [item.k, item.mode, item.exhaustiveSteps]),
    [
      [8, "cosine", true],
      [8, "cosine-fts", true],
      [12, "cosine", true],
      [12, "cosine-fts", true]
    ]
  );
  assert.equal(
    funnelWorksheetGridOf({ budget: undefined, ks: "8", modes: "cosine" }),
    undefined
  );
  assert.equal(
    funnelWorksheetGridOf({ budget: "232", ks: "8", modes: "bm25" }),
    undefined
  );
  assert.equal(
    funnelWorksheetGridOf({ budget: "232", ks: "8,x", modes: "cosine" }),
    undefined
  );
  assert.throws(() =>
    funnelWorksheetGridOf({ budget: "232", ks: "200", modes: "cosine" })
  );
});

test("the replay parser never sets exhaustiveSteps, so a replay of ADAPTIVE still needs the band cuts", async (t: TestContext) => {
  const params = await funnelParamsOf({
    budget: "232",
    k: "12",
    mode: "cosine",
    bandCutsPath: undefined
  });
  assert.ok(params !== undefined);
  assert.equal(Object.hasOwn(params, "exhaustiveSteps"), false);

  const { capture, vectors } = await e3WorksheetCapture(t);
  const replay = await replayCapture({
    capture,
    dataset,
    variantIds: ["ADAPTIVE"],
    vectors,
    funnelParams: params
  });
  for (const caseReplay of replay.cases) {
    assert.deepEqual(caseReplay.variants[0]?.incomplete, {
      reason: "missing-funnel-params"
    });
  }
});

test("an exhaustive ADAPTIVE run takes every step: with the same cuts that stop at layer 0, it is judged deeper", async (t: TestContext) => {
  const { capture, vectors } = await e3WorksheetCapture(t);
  const replay = await replayCapture({
    capture,
    dataset,
    variantIds: ["ADAPTIVE"],
    vectors,
    funnelParams: {
      ...COSINE,
      cuts: CUTS_BELOW_EVERY_ELIGIBILITY,
      exhaustiveSteps: true
    }
  });
  const answered = replay.cases.filter(
    (caseReplay) => (caseReplay.variants[0]?.results.length ?? 0) > 0
  );
  assert.ok(answered.length > 0);
  for (const caseReplay of answered) {
    assert.equal(
      caseReplay.variants[0]?.incomplete,
      undefined,
      caseReplay.caseId
    );
    assert.ok(
      (caseReplay.variants[0]?.judgedDepth ?? 0) > 0,
      caseReplay.caseId
    );
  }
});

test("the exhaustive reach holds every group that the exhaustive ADAPTIVE run admits, so no stop point is missed", async (t: TestContext) => {
  const { capture, vectors } = await e3WorksheetCapture(t);
  const reaches = exhaustiveReachesOf({
    capture,
    variants: ["ADAPTIVE"],
    grid: [COSINE],
    vectors
  });
  const replay = await replayCapture({
    capture,
    dataset,
    variantIds: ["ADAPTIVE"],
    vectors,
    funnelParams: {
      ...COSINE,
      cuts: CUTS_BELOW_EVERY_ELIGIBILITY,
      exhaustiveSteps: true
    }
  });
  let admitted = 0;
  for (const caseReplay of replay.cases) {
    const reach = reaches.get(caseReplay.caseId);
    assert.ok(reach !== undefined, caseReplay.caseId);
    for (const result of caseReplay.variants[0]?.results ?? []) {
      admitted += 1;
      assert.ok(
        reach.has(result.threadId),
        `${caseReplay.caseId} ${result.threadId}`
      );
    }
  }
  assert.ok(admitted > 0);
});

test("every group that a step admits is reached at that step's depth, by the per-step reach rule", async (t: TestContext) => {
  const { capture, vectors } = await e3WorksheetCapture(t);
  const records = new Map(
    capture.records.map((record) => [record.recordId, record] as const)
  );
  let admittedSteps = 0;
  for (const captured of capture.cases) {
    const funnel = funnelInputOf({ captured, records, vectors });
    assert.ok(funnel !== undefined, captured.id);
    const reach = exhaustiveReachOf("ADAPTIVE", {
      funnel,
      funnelParams: COSINE
    });
    const run = runFunnel(
      { ...funnel, ...COSINE },
      { ...funnelConfigOf("ADAPTIVE"), stopOn: "none" }
    );
    for (const step of run.steps) {
      for (const item of step.admitted) {
        admittedSteps += 1;
        assert.ok(
          (reach.get(item.groupId) ?? -1) >= step.depth,
          `${captured.id} ${item.groupId} depth ${step.depth}`
        );
      }
    }
  }
  assert.ok(admittedSteps > 0);
});

test("the grid reach is the union over its points: each point is contained in the union", async (t: TestContext) => {
  const { capture, vectors } = await e3WorksheetCapture(t);
  const union = exhaustiveReachesOf({
    capture,
    variants: ["ADAPTIVE"],
    grid: [COSINE, COSINE_FTS],
    vectors
  });
  const single = exhaustiveReachesOf({
    capture,
    variants: ["ADAPTIVE"],
    grid: [COSINE],
    vectors
  });
  for (const [caseId, reach] of single) {
    for (const [groupId, depth] of reach) {
      assert.ok(
        (union.get(caseId)?.get(groupId) ?? -1) >= depth,
        `${caseId} ${groupId}`
      );
    }
  }
});
