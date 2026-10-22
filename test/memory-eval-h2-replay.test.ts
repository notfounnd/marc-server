import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { CalibrationSet } from "../scripts/memory-eval/calibration.js";
import { calibratedProbability } from "../scripts/memory-eval/calibration.js";
import type { EvalDataset } from "../scripts/memory-eval/dataset.js";
import { bandOf } from "../scripts/memory-eval/fit-model.js";
import { buildFit } from "../scripts/memory-eval/fit.js";
import { caseFolds } from "../scripts/memory-eval/folds.js";
import {
  replayCapture,
  type CaseReplay
} from "../scripts/memory-eval/replay.js";
import type { VariantResult } from "../scripts/memory-eval/variants.js";
import {
  captureFixture,
  dataset,
  THREAD_RULES,
  THREAD_SETTINGS,
  THREAD_TOKEN
} from "./memory-eval-capture-fixtures.js";

const JUDGED_DATASET: EvalDataset = {
  ...dataset,
  cases: dataset.cases.map((evalCase) => ({
    ...evalCase,
    judgments: {
      [THREAD_TOKEN]: 3,
      [THREAD_SETTINGS]: 2,
      [THREAD_RULES]: 0
    }
  }))
};

function calibrationsOf(a: number, b: number): CalibrationSet {
  const result = { valid: true, reason: null, a, b };
  return { N1: result, N2: result };
}

function variantOf(replay: CaseReplay, variant: string): VariantResult[] {
  return (
    replay.variants.find((item) => item.variant === variant)?.results ?? []
  );
}

test("the H2 variants keep the admission and the order of H1_CALIBRATED", async (t: TestContext) => {
  const capture = await captureFixture(t);
  assert.ok(
    (capture.syntheticQueries?.length ?? 0) > 0,
    "the fixture capture must carry synthetic queries"
  );
  const { fit } = await buildFit({ capture, dataset: JUDGED_DATASET });
  const folds = caseFolds(JUDGED_DATASET.cases);
  const calibrations = calibrationsOf(1.5, -0.5);
  const replay = await replayCapture({
    capture,
    dataset: JUDGED_DATASET,
    variantIds: ["H1_CALIBRATED", "H2_N1", "H2_N2"],
    fit,
    calibrations
  });
  for (const caseReplay of replay.cases) {
    const h1 = variantOf(caseReplay, "H1_CALIBRATED");
    const fold = folds.get(caseReplay.caseId);
    assert.ok(fold !== undefined, `no fold for ${caseReplay.caseId}`);
    for (const variant of ["H2_N1", "H2_N2"]) {
      const h2 = variantOf(caseReplay, variant);
      assert.deepEqual(
        h2.map((item) => [item.threadId, item.admitted, item.score]),
        h1.map((item) => [item.threadId, item.admitted, item.score])
      );
      const cuts = fit.folds[fold].cuts;
      h2.filter((item) => !item.admitted).forEach((item) => {
        assert.equal(item.band, undefined);
      });
      h2.filter((item) => item.admitted).forEach((item) => {
        const expected = bandOf(
          calibratedProbability(item.score, { a: 1.5, b: -0.5 }),
          cuts
        );
        assert.equal(item.band, expected);
      });
    }
  }
});

test("with the identity calibration the H2 bands equal the H1 bands: only the band depends on p'", async (t: TestContext) => {
  const capture = await captureFixture(t);
  const { fit } = await buildFit({ capture, dataset: JUDGED_DATASET });
  const replay = await replayCapture({
    capture,
    dataset: JUDGED_DATASET,
    variantIds: ["H1_CALIBRATED", "H2_N1", "H2_N2"],
    fit,
    calibrations: calibrationsOf(1, 0)
  });
  for (const caseReplay of replay.cases) {
    const h1 = variantOf(caseReplay, "H1_CALIBRATED");
    for (const variant of ["H2_N1", "H2_N2"]) {
      assert.deepEqual(
        variantOf(caseReplay, variant).map((item) => item.band),
        h1.map((item) => item.band)
      );
    }
  }
});

test("an H2 variant without a valid calibration stops the replay with its reason", async (t: TestContext) => {
  const capture = await captureFixture(t);
  const { fit } = await buildFit({ capture, dataset: JUDGED_DATASET });
  const invalid = {
    valid: false,
    reason: "declared invalid for the test",
    a: null,
    b: null
  };
  await assert.rejects(
    replayCapture({
      capture,
      dataset: JUDGED_DATASET,
      variantIds: ["H2_N1"],
      fit,
      calibrations: { N1: invalid, N2: invalid }
    }),
    /The N1 calibration is invalid: declared invalid for the test/
  );
});
