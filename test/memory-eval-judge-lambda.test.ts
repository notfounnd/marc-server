import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { CaptureFile } from "../scripts/memory-eval/capture-types.js";
import type { EvalDataset } from "../scripts/memory-eval/dataset.js";
import {
  attachJudges,
  fitProcedure,
  h1PartitionsOf,
  innerPairPredictions,
  judgeKeyOf,
  labelledPairsOf,
  modelParams,
  nestedChainFitsOf,
  nestedFallbackFitsOf,
  pairsByFold,
  type JudgeTable,
  type LabelledPair
} from "../scripts/memory-eval/fit.js";
import {
  LAMBDA_GRID,
  admits,
  bandCutsOf,
  fitLogistic,
  logLoss
} from "../scripts/memory-eval/fit-model.js";
import {
  chainTrainingRows,
  fallbackTrainingRows
} from "../scripts/memory-eval/judge-stage.js";
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
/** The chain rows that the final refit of judgeParamsOf reads, in fold order. */
function finalChainRowsOf(
  trainFolds: readonly (readonly LabelledPair[])[],
  name: "qwen"
) {
  const procedure = fitProcedure(trainFolds);
  const inner = innerPairPredictions(trainFolds, procedure.lambda);
  return chainTrainingRows(
    trainFolds.flat().map((pair) => ({
      fold: pair.fold,
      label: pair.label,
      p: inner.get(pair)?.p ?? Number.NaN,
      semanticOnly: inner.get(pair)?.semanticOnly ?? Number.NaN,
      judge: pair.judges[name] ?? Number.NaN
    })),
    procedure.cuts.low
  ).sort((left, right) => left.fold - right.fold);
}

/** The final fallback rows of judgeParamsOf, in fold order. */
function finalFallbackRowsOf(
  trainFolds: readonly (readonly LabelledPair[])[],
  name: "qwen"
) {
  return fallbackTrainingRows(
    trainFolds.flat().map((pair) => ({
      fold: pair.fold,
      label: pair.label,
      eligibility: pair.eligibility,
      m0Admitted: pair.m0Admitted,
      judge: pair.judges[name] ?? Number.NaN
    }))
  ).sort((left, right) => left.fold - right.fold);
}

test("the chain and fallback lambdas are the ones with the lowest nested log-loss, and v is refit with them", async (t: TestContext) => {
  const capture = await captureOf(t, JUDGED_DATASET);
  const table = await separatingTable(capture);
  const pairs = attachJudges(await labelledPairsOf(capture, JUDGED_DATASET), {
    qwen: table
  });
  const trainFolds = pairsByFold(pairs).filter((_, fold) => fold !== 0);
  const partitions = h1PartitionsOf(trainFolds);
  const stage = modelParams(trainFolds, fitProcedure, ["qwen"]).judge?.qwen;
  assert.ok(stage !== undefined, "the qwen stage is fitted");

  const chainGrid = LAMBDA_GRID.map((lambda) => {
    const scores = nestedChainFitsOf(partitions, "qwen", lambda).flatMap(
      (fit) => fit.scores
    );
    return { lambda, scores, loss: logLoss(scores) };
  });
  const [chainBest] = [...chainGrid].sort(
    (left, right) => left.loss - right.loss
  );
  assert.ok(chainBest !== undefined);
  assert.equal(stage.chain.lambda, chainBest.lambda);
  assert.deepEqual(
    stage.chain.innerLogLoss,
    Object.fromEntries(
      chainGrid.map((item) => [String(item.lambda), item.loss])
    )
  );
  assert.deepEqual(stage.chain.cuts, bandCutsOf(chainBest.scores));
  // v is refit on the chain rows with the chosen lambda, and no other lambda is tried.
  const chainRefit = fitLogistic(
    finalChainRowsOf(trainFolds, "qwen"),
    chainBest.lambda
  );
  assert.deepEqual(stage.chain.weights, chainRefit.weights);
  assert.equal(stage.chain.intercept, chainRefit.intercept);

  const fallbackGrid = LAMBDA_GRID.map((lambda) => {
    const scores = nestedFallbackFitsOf(trainFolds, "qwen", lambda).flatMap(
      (fit) => fit.scores
    );
    return { lambda, scores, loss: logLoss(scores) };
  });
  const [fallbackBest] = [...fallbackGrid].sort(
    (left, right) => left.loss - right.loss
  );
  assert.ok(fallbackBest !== undefined);
  assert.equal(stage.fallback.lambda, fallbackBest.lambda);
  assert.deepEqual(stage.fallback.cuts, bandCutsOf(fallbackBest.scores));
  const fallbackRefit = fitLogistic(
    finalFallbackRowsOf(trainFolds, "qwen"),
    fallbackBest.lambda
  );
  assert.deepEqual(stage.fallback.weights, fallbackRefit.weights);
});

test("a judge stage without a pre-admitted training pair stays unfitted, with null cuts, and admits nothing", async (t: TestContext) => {
  const capture = await captureOf(t, JUDGED_DATASET);
  const table = await separatingTable(capture);
  const pairs = attachJudges(await labelledPairsOf(capture, JUDGED_DATASET), {
    qwen: table
  });
  // With no positive, no band cut of H1 is reachable, so no training pair is pre-admitted.
  const negatives = pairsByFold(pairs).map((group) =>
    group.map((pair) => ({ ...pair, label: 0 as const }))
  );
  const stage = modelParams(negatives, fitProcedure, ["qwen"]).judge?.qwen;
  assert.ok(stage !== undefined, "the qwen stage is fitted");
  assert.equal(stage.diagnostics.unfittedChain, stage.diagnostics.partitions);
  assert.deepEqual(stage.chain.weights, [0, 0]);
  assert.deepEqual(stage.chain.cuts, { high: null, medium: null, low: null });
  assert.equal(admits(1, stage.chain.cuts.low), false);
  assert.equal(admits(1, stage.chain.cuts.high), false);
});
