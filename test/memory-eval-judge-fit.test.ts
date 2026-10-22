import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { CaptureFile } from "../scripts/memory-eval/capture-types.js";
import type { EvalDataset } from "../scripts/memory-eval/dataset.js";
import {
  attachJudges,
  buildFit,
  fitProcedure,
  h1PartitionsOf,
  judgeKeyOf,
  labelledPairsOf,
  nestedChainFitsOf,
  nestedFallbackFitsOf,
  nestedFolds,
  pairsByFold,
  type JudgeTable
} from "../scripts/memory-eval/fit.js";
import { LAMBDA_GRID } from "../scripts/memory-eval/fit-model.js";
import { judgesByCase, replayCapture } from "../scripts/memory-eval/replay.js";
import {
  captureOf,
  NESTED_JUDGED_DATASET
} from "./memory-eval-nested-fixture.js";

const JUDGED_DATASET: EvalDataset = NESTED_JUDGED_DATASET;

/**
 * A judge that separates the labels with a margin: 0.2 to 0.3 for the other pairs
 * and 0.8 to 0.9 for the relevant ones. It covers every labelled pair of the capture.
 */
async function separatingTable(capture: CaptureFile): Promise<JudgeTable> {
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

test("a fit with a judge adds its chain and fallback stages, with non-negative weights", async (t: TestContext) => {
  const capture = await captureOf(t, JUDGED_DATASET);
  const table = await separatingTable(capture);
  const { fit } = await buildFit({
    capture,
    dataset: JUDGED_DATASET,
    judges: { qwen: table }
  });
  assert.deepEqual(fit.judges, ["qwen"]);
  const stages = [...fit.folds, fit.production].map(
    (params) => params.judge?.qwen
  );
  assert.equal(stages.length, fit.folds.length + 1);
  for (const stage of stages) {
    assert.ok(stage !== undefined, "every fit carries the qwen stages");
    for (const model of [stage.chain, stage.fallback]) {
      assert.equal(model.weights.length, 2);
      assert.ok(model.weights.every((weight) => weight >= 0));
    }
  }
});

test("a judge never admits a thread that the H1 pre-admission does not admit", async (t: TestContext) => {
  const capture = await captureOf(t, JUDGED_DATASET);
  const table = await separatingTable(capture);
  const { predictions } = await buildFit({
    capture,
    dataset: JUDGED_DATASET,
    judges: { qwen: table }
  });
  assert.ok(predictions.pairs.length > 0);
  for (const pair of predictions.pairs) {
    const judged = pair.judges.qwen;
    assert.ok(judged !== undefined, "every pair carries the qwen predictions");
    assert.ok(!judged.chainAdmitted || pair.calibratedAdmitted);
  }
});

test("the stages of an outer fold do not change when that fold's labels and judge scores change", async (t: TestContext) => {
  const capture = await captureOf(t, JUDGED_DATASET);
  const table = await separatingTable(capture);
  const pairs = attachJudges(await labelledPairsOf(capture, JUDGED_DATASET), {
    qwen: table
  });
  const folds = nestedFolds(pairs, fitProcedure, ["qwen"]);
  const flipped = (pair: (typeof pairs)[number]) => ({
    ...pair,
    label: (1 - pair.label) as 0 | 1,
    judges: { qwen: 1 - (pair.judges.qwen ?? 0) }
  });
  const changed = [
    ...pairs.filter((pair) => pair.fold === 0).map(flipped),
    ...pairs.filter((pair) => pair.fold !== 0)
  ];
  const changedFolds = nestedFolds(changed, fitProcedure, ["qwen"]);
  assert.deepEqual(changedFolds[0], folds[0]);
  assert.notDeepEqual(changedFolds[1], folds[1]);
});

test("the H7 replay reproduces the external predictions of the judge stages", async (t: TestContext) => {
  const capture = await captureOf(t, JUDGED_DATASET);
  const table = await separatingTable(capture);
  const { fit, predictions } = await buildFit({
    capture,
    dataset: JUDGED_DATASET,
    judges: { qwen: table }
  });
  const replay = await replayCapture({
    capture,
    dataset: JUDGED_DATASET,
    variantIds: ["H7_JUDGE_QWEN", "H7_JUDGE_QWEN_FALLBACK"],
    fit,
    judgeTables: { qwen: table }
  });
  const results = new Map(
    replay.cases.flatMap((caseReplay) =>
      caseReplay.variants.flatMap((variant) =>
        variant.results.map(
          (result) =>
            [
              `${caseReplay.caseId}|${variant.variant}|${result.threadId}`,
              result
            ] as const
        )
      )
    )
  );
  for (const pair of predictions.pairs) {
    const judged = pair.judges.qwen;
    assert.ok(judged !== undefined);
    const chain = results.get(`${pair.caseId}|H7_JUDGE_QWEN|${pair.threadId}`);
    const fallback = results.get(
      `${pair.caseId}|H7_JUDGE_QWEN_FALLBACK|${pair.threadId}`
    );
    assert.equal(chain?.score, judged.chainP2);
    assert.equal(chain?.admitted, judged.chainAdmitted);
    assert.equal(fallback?.score, judged.fallbackP2);
    assert.equal(fallback?.admitted, judged.fallbackAdmitted);
  }
});

test("a missing judge score stops the attachment and names the judge", async (t: TestContext) => {
  const capture = await captureOf(t, JUDGED_DATASET);
  const pairs = await labelledPairsOf(capture, JUDGED_DATASET);
  assert.throws(
    () => attachJudges(pairs, { kev: new Map() }),
    /The kev judge has no score/
  );
});

test("an inner fold marked with other labels and judge scores changes neither the H1 nor the chain that predict it", async (t: TestContext) => {
  const capture = await captureOf(t, JUDGED_DATASET);
  const table = await separatingTable(capture);
  const pairs = attachJudges(await labelledPairsOf(capture, JUDGED_DATASET), {
    qwen: table
  });
  const folds = pairsByFold(pairs);
  const flipped = (pair: (typeof pairs)[number]) => ({
    ...pair,
    label: (1 - pair.label) as 0 | 1,
    judges: { qwen: 1 - (pair.judges.qwen ?? 0) }
  });
  const marked = [
    folds[0],
    folds[1].map(flipped),
    folds[2],
    folds[3],
    folds[4]
  ];
  const before = h1PartitionsOf(folds);
  const after = h1PartitionsOf(marked);
  // The H1 that predicts inner fold 1 is fitted on the other folds only, so it does not see the marked fold.
  assert.deepEqual(after[1].h1, before[1].h1);
  // The H1 that predicts fold 0 is fitted on folds 1 to 4, so it does see the marked fold 1.
  assert.notDeepEqual(after[0].h1, before[0].h1);
  for (const lambda of LAMBDA_GRID) {
    const chains = nestedChainFitsOf(before, "qwen", lambda);
    const markedChains = nestedChainFitsOf(after, "qwen", lambda);
    // The chain that predicts inner fold 1 is refit on the other folds, for every lambda of v.
    // Its scores are not compared: they hold the marked labels of fold 1 by design.
    assert.deepEqual(markedChains[1]?.chain, chains[1]?.chain);
    const fallbacks = nestedFallbackFitsOf(folds, "qwen", lambda);
    const markedFallbacks = nestedFallbackFitsOf(marked, "qwen", lambda);
    assert.deepEqual(markedFallbacks[1]?.fallback, fallbacks[1]?.fallback);
  }
});

test("the fit summary counts the nested partitions of each judge, and those that stayed unfitted", async (t: TestContext) => {
  const capture = await captureOf(t, JUDGED_DATASET);
  const table = await separatingTable(capture);
  const { fit } = await buildFit({
    capture,
    dataset: JUDGED_DATASET,
    judges: { qwen: table }
  });
  const summary = fit.judgeSummary?.qwen;
  assert.ok(summary !== undefined, "the summary has the qwen judge");
  // Five outer folds with four partitions each, and the production fit with five.
  assert.equal(summary.partitions, 25);
  assert.ok(summary.unfittedChain <= summary.partitions);
  assert.ok(summary.unfittedFallback <= summary.partitions);
});

test("an H7 replay on a fit without the judge stage names the command to run", async (t: TestContext) => {
  const capture = await captureOf(t, JUDGED_DATASET);
  const table = await separatingTable(capture);
  const { fit } = await buildFit({ capture, dataset: JUDGED_DATASET });
  await assert.rejects(
    replayCapture({
      capture,
      dataset: JUDGED_DATASET,
      variantIds: ["H7_JUDGE_QWEN"],
      fit,
      judgeTables: { qwen: table }
    }),
    /The fit has no qwen judge stage\. Run `judge --model qwen` on the fitted capture \(marc\) and fit it again/
  );
});

test("a case without judged candidates keeps an empty entry in the judge tables", () => {
  const table: JudgeTable = new Map([[judgeKeyOf("case-a", "thread-1"), 0.5]]);
  const byCase = judgesByCase({ qwen: table }, ["case-a", "case-empty"]);
  assert.equal(byCase.get("case-a")?.qwen?.get("thread-1"), 0.5);
  assert.deepEqual(byCase.get("case-empty"), { qwen: new Map() });
});
