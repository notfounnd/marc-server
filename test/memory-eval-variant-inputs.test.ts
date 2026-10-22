import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import {
  calibrateCapture,
  h2PairBandOf,
  type CalibrationFile
} from "../scripts/memory-eval/calibrate.js";
import { compareCaptures } from "../scripts/memory-eval/compare.js";
import type { CalibrationSet } from "../scripts/memory-eval/calibration.js";
import type { EvalDataset } from "../scripts/memory-eval/dataset.js";
import {
  buildFit,
  judgeKeyOf,
  labelledPairsOf,
  type JudgeTable
} from "../scripts/memory-eval/fit.js";
import {
  calibrationsOfCase,
  replayCapture
} from "../scripts/memory-eval/replay.js";
import {
  captureOf,
  NESTED_JUDGED_DATASET
} from "./memory-eval-nested-fixture.js";

const JUDGED_DATASET: EvalDataset = NESTED_JUDGED_DATASET;

/** A judge that separates the labels with a margin, covering every labelled pair. */
async function separatingTable(
  capture: Parameters<typeof labelledPairsOf>[0]
): Promise<JudgeTable> {
  const pairs = await labelledPairsOf(capture, JUDGED_DATASET);
  return new Map(
    pairs.map(
      (pair, index) =>
        [
          judgeKeyOf(pair.caseId, pair.threadId),
          0.2 + 0.6 * pair.label + 0.05 * (index % 3)
        ] as const
    )
  );
}

const NEW_VARIANTS = [
  "H1_CALIBRATED",
  "H1_FALLBACK",
  "H2_N1",
  "H2_N2",
  "H7_JUDGE_QWEN",
  "H7_JUDGE_QWEN_FALLBACK"
];

test("the replay of the H1, H2 and H7 variants with their fallbacks reads the inputs they declare", async (t: TestContext) => {
  const capture = await captureOf(t, JUDGED_DATASET);
  const table = await separatingTable(capture);
  const { fit, predictions } = await buildFit({
    capture,
    dataset: JUDGED_DATASET,
    judges: { qwen: table }
  });
  const { calibrations } = await calibrateCapture({
    capture,
    dataset: JUDGED_DATASET,
    corpus: "marc",
    model: { fit, predictions }
  });
  const replay = await replayCapture({
    capture,
    dataset: JUDGED_DATASET,
    variantIds: NEW_VARIANTS,
    fit,
    calibrations,
    judgeTables: { qwen: table }
  });
  assert.ok(
    replay.cases.every((caseReplay) =>
      NEW_VARIANTS.every((id) =>
        caseReplay.variants.some((variant) => variant.variant === id)
      )
    )
  );
});

test("compare between two new variants reads the inputs of each side", async (t: TestContext) => {
  const capture = await captureOf(t, JUDGED_DATASET);
  const table = await separatingTable(capture);
  const { fit, predictions } = await buildFit({
    capture,
    dataset: JUDGED_DATASET,
    judges: { qwen: table }
  });
  const { calibrations } = await calibrateCapture({
    capture,
    dataset: JUDGED_DATASET,
    corpus: "marc",
    model: { fit, predictions }
  });
  const result = await compareCaptures({
    dataset: JUDGED_DATASET,
    baseline: {
      capture,
      variant: "H7_JUDGE_QWEN",
      inputs: { fit, judgeTables: { qwen: table } }
    },
    candidate: { capture, variant: "H2_N1", inputs: { fit, calibrations } }
  });
  assert.ok(result.rows.length > 0);
});

test("on marc the H2 replay bands equal the H2 evaluation bands, pair by pair, with each external fold's calibration", async (t: TestContext) => {
  const capture = await captureOf(t, JUDGED_DATASET);
  const bundle = await buildFit({ capture, dataset: JUDGED_DATASET });
  const { file } = await calibrateCapture({
    capture,
    dataset: JUDGED_DATASET,
    corpus: "marc",
    model: bundle
  });
  // The calibration file as the CLI writes it and reads it back.
  const persisted = JSON.parse(JSON.stringify(file)) as CalibrationFile;
  const replay = await replayCapture({
    capture,
    dataset: JUDGED_DATASET,
    variantIds: ["H2_N1", "H2_N2"],
    fit: bundle.fit,
    calibrations: { N1: persisted.n1, N2: persisted.n2 },
    foldCalibrations: persisted.folds
  });
  const bandOf = new Map(
    replay.cases.flatMap((caseReplay) =>
      caseReplay.variants.flatMap((variant) =>
        variant.results.map(
          (result) =>
            [
              `${caseReplay.caseId}|${variant.variant}|${result.threadId}`,
              result.band
            ] as const
        )
      )
    )
  );
  const admitted = bundle.predictions.pairs.filter(
    (pair) => pair.calibratedAdmitted
  );
  assert.ok(admitted.length > 0, "the fixture must admit labelled pairs");
  for (const pair of admitted) {
    const folded = persisted.folds[pair.fold];
    assert.ok(folded !== undefined, `no calibrations for fold ${pair.fold}`);
    const cuts = bundle.fit.folds[pair.fold].cuts;
    for (const [variant, name] of [
      ["H2_N1", "N1"],
      ["H2_N2", "N2"]
    ] as const) {
      const expected = h2PairBandOf(pair, folded[name], cuts);
      assert.equal(
        bandOf.get(`${pair.caseId}|${variant}|${pair.threadId}`),
        expected,
        `${variant} on ${pair.caseId}/${pair.threadId}`
      );
    }
  }
});

test("the calibrations of a case are those of its own fold on marc, and the production set elsewhere", () => {
  const set = (a: number): CalibrationSet => {
    const result = { valid: true, reason: null, a, b: 0 };
    return { N1: result, N2: result };
  };
  const production = set(1);
  const folds = [set(10), set(11), set(12), set(13), set(14)];
  assert.equal(
    calibrationsOfCase(
      { calibrations: production, foldCalibrations: folds },
      3
    ),
    folds[3]
  );
  assert.equal(calibrationsOfCase({ calibrations: production }, 3), production);
  assert.equal(
    calibrationsOfCase(
      { calibrations: production, foldCalibrations: folds },
      undefined
    ),
    production
  );
  assert.throws(
    () =>
      calibrationsOfCase(
        { calibrations: production, foldCalibrations: folds },
        9
      ),
    /No calibrations for fold 9/
  );
});
