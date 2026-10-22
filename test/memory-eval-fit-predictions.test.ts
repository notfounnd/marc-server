import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { EvalDataset } from "../scripts/memory-eval/dataset.js";
import { buildFit, type PairPrediction } from "../scripts/memory-eval/fit.js";
import { replayCapture } from "../scripts/memory-eval/replay.js";
import {
  captureFixture,
  dataset,
  THREAD_RULES,
  THREAD_SETTINGS,
  THREAD_TOKEN
} from "./memory-eval-capture-fixtures.js";

/**
 * The fixture cases with judgments on every fixture thread, so that each
 * candidate pair is labelled and the predictions cover the whole candidate set.
 */
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

function replayKey(caseId: string, variant: string, threadId: string): string {
  return `${caseId}|${variant}|${threadId}`;
}

test("the external predictions written by the fit equal the H1 replay", async (t: TestContext) => {
  const capture = await captureFixture(t);
  const { fit, predictions } = await buildFit({
    capture,
    dataset: JUDGED_DATASET
  });
  const replay = await replayCapture({
    capture,
    dataset: JUDGED_DATASET,
    variantIds: ["H1_CALIBRATED", "H1_FALLBACK"],
    fit
  });
  const results = new Map(
    replay.cases.flatMap((caseReplay) =>
      caseReplay.variants.flatMap((variant) =>
        variant.results.map(
          (result) =>
            [
              replayKey(caseReplay.caseId, variant.variant, result.threadId),
              result
            ] as const
        )
      )
    )
  );
  const pairs: PairPrediction[] = predictions.pairs;
  assert.equal(predictions.captureId, capture.captureId);
  assert.equal(pairs.length, fit.labelled.pairs);
  assert.ok(pairs.length > 0);

  for (const pair of pairs) {
    const calibrated = results.get(
      replayKey(pair.caseId, "H1_CALIBRATED", pair.threadId)
    );
    const fallback = results.get(
      replayKey(pair.caseId, "H1_FALLBACK", pair.threadId)
    );
    assert.equal(calibrated?.score, pair.p);
    assert.equal(calibrated?.admitted, pair.calibratedAdmitted);
    assert.equal(fallback?.score, pair.eligibility);
    assert.equal(fallback?.admitted, pair.fallbackAdmitted);
  }

  const calibratedAdmitted = pairs.filter((pair) => pair.calibratedAdmitted);
  calibratedAdmitted.forEach((pair) => {
    const replayed = results.get(
      replayKey(pair.caseId, "H1_CALIBRATED", pair.threadId)
    );
    assert.equal(replayed?.band ?? null, pair.calibratedBand);
  });

  const fallbackAdmitted = pairs.filter((pair) => pair.fallbackAdmitted);
  fallbackAdmitted.forEach((pair) => {
    const replayed = results.get(
      replayKey(pair.caseId, "H1_FALLBACK", pair.threadId)
    );
    assert.equal(replayed?.band ?? null, pair.fallbackBand);
  });
});
