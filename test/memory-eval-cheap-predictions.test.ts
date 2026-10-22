import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { candidateFeaturesOf } from "../scripts/memory-eval/candidate-pairs.js";
import type { EvalDataset } from "../scripts/memory-eval/dataset.js";
import { cheapScoresOf } from "../scripts/memory-eval/cheap.js";
import { admits } from "../scripts/memory-eval/fit-model.js";
import { buildFit } from "../scripts/memory-eval/fit.js";
import {
  cachedReplayProviders,
  channelsOfCaptured,
  recordsById
} from "../scripts/memory-eval/replay.js";
import { cheapGateOpens } from "../scripts/memory-eval/suggestion.js";
import {
  cheapSemanticOnlyVectorOf,
  cheapVectorOf,
  type ThreadFeatures
} from "../src/core/memory/scoring/features.js";
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

test("the cheap predictions equal the values the H3_C gate computes for the same pairs", async (t: TestContext) => {
  const capture = await captureFixture(t);
  const { fit, predictions } = await buildFit({
    capture,
    dataset: JUDGED_DATASET
  });
  const records = recordsById(capture.records);
  const featuresByCase = new Map<string, Map<string, ThreadFeatures>>();
  for (const captured of capture.cases) {
    const text = captured.interpretation.effectiveQuery;
    const channels = captured.channels[text];
    assert.ok(channels !== undefined, `no channels for ${captured.id}`);
    const features = await candidateFeaturesOf(
      text,
      channelsOfCaptured(channels, records),
      cachedReplayProviders(captured, capture).reranker
    );
    featuresByCase.set(
      captured.id,
      new Map(features.map((item) => [item.threadId, item]))
    );
  }

  assert.ok(predictions.pairs.length > 0);
  for (const pair of predictions.pairs) {
    const item = featuresByCase.get(pair.caseId)?.get(pair.threadId);
    assert.ok(
      item !== undefined,
      `no features for ${pair.caseId}/${pair.threadId}`
    );
    const cheap = fit.folds[pair.fold].cheap;
    const gate = cheapScoresOf(
      cheapVectorOf(item),
      cheapSemanticOnlyVectorOf(item),
      cheap
    );
    assert.equal(gate.p, pair.cheapP);
    assert.equal(gate.semanticOnly, pair.cheapSemanticOnly);
    assert.equal(gate.admitted, pair.cheapAdmitted);
    assert.equal(gate.band, pair.cheapBand);
    assert.equal(
      cheapGateOpens([item], cheap),
      pair.cheapAdmitted && admits(pair.cheapP, cheap.cuts.high)
    );
  }
});
