import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { getWorkspaceInfo } from "../src/core/workspace.js";
import {
  type BandCuts,
  type ModelParams,
  type ProcedureFit
} from "../scripts/memory-eval/fit-model.js";
import {
  choiceCasesOf,
  identityRecordsOf,
  judgeTargetsOf
} from "../scripts/memory-eval/judge.js";
import {
  QWEN_IDENTITY,
  type ChoiceRunner,
  type JudgeRunner
} from "../scripts/memory-eval/judge-runner.js";
import { recordsById } from "../scripts/memory-eval/replay.js";
import {
  MEMORY_NOTE,
  MODEL_LATENCY_SAMPLES,
  measureChoiceLatency,
  measureJudgeLatency
} from "../scripts/memory-eval/latency-models.js";
import { captureFixture } from "./memory-eval-capture-fixtures.js";

/**
 * The model latency end to end on the fixture capture, with fake runners: no model is
 * loaded. The unit tests of the same functions are in memory-eval-latency-models.test.ts.
 */

const NO_CUTS: BandCuts = { high: null, medium: null, low: null };

const CONVERGENCE = {
  iterations: 1,
  projectedGradientNorm: 0,
  lossChangeLastWindow: 0,
  lossRangeLastWindow: 0
};

function procedure(
  intercept: number,
  weights: number[],
  low: number | null
): ProcedureFit {
  return {
    intercept,
    weights,
    lambda: 0.1,
    lambdaAtLowerEdge: false,
    cuts: { high: 0.9, medium: 0.7, low },
    innerLogLoss: {},
    convergence: CONVERGENCE
  };
}

function productionWithLowCut(low: number | null): ModelParams {
  return {
    ...procedure(-2, [1, 0, 0, 0, 0, 10, 0], low),
    fallbackCuts: NO_CUTS,
    cheap: procedure(0, [0, 0, 0, 0], null),
    judge: {}
  };
}

test("the judge latency scores exactly the pre-admitted threads and writes the fields of the file", async (t: TestContext) => {
  const capture = await captureFixture(t);
  const records = recordsById(capture.records);
  const identities = identityRecordsOf(capture);
  const targets = await Promise.all(
    capture.cases.map((captured) =>
      judgeTargetsOf({ captured, capture, records, identities })
    )
  );
  const candidates = targets.reduce(
    (total, item) => total + item.targets.length,
    0
  );
  let scored = 0;
  const runner: JudgeRunner = {
    identity: QWEN_IDENTITY,
    truncate: (text) => text,
    scoreDocument: async () => {
      scored += 1;
      return 0.5;
    }
  };
  const file = await measureJudgeLatency({
    capture,
    records,
    identities,
    judge: "qwen",
    production: productionWithLowCut(0),
    productionFit: "marc/fixture",
    latency: undefined,
    workerInfo: await getWorkspaceInfo(process.cwd()),
    loadRunner: async () => runner,
    log: () => undefined
  });
  assert.equal(scored, candidates * (MODEL_LATENCY_SAMPLES + 1));
  assert.equal(file.kind, "judge");
  assert.deepEqual(file.model, QWEN_IDENTITY);
  assert.equal(file.captureId, capture.captureId);
  assert.equal(file.productionFit, "marc/fixture");
  assert.equal(file.cases.length, capture.cases.length);
  assert.ok(
    file.cases.every((item) => item.samples.length === MODEL_LATENCY_SAMPLES)
  );
  assert.equal(file.estimated.label, "estimated");
  assert.equal(file.estimated.totalMedianMs, null);
  assert.equal(
    file.memory.harnessDeltaBytes,
    file.memory.harnessPeakBytes - file.memory.harnessBaseBytes
  );
  assert.equal(file.memory.note, MEMORY_NOTE);
});

test("with no pre-admitted thread the judge latency scores nothing and every case has zero units", async (t: TestContext) => {
  const capture = await captureFixture(t);
  const records = recordsById(capture.records);
  const identities = identityRecordsOf(capture);
  let scored = 0;
  const runner: JudgeRunner = {
    identity: QWEN_IDENTITY,
    truncate: (text) => text,
    scoreDocument: async () => {
      scored += 1;
      return 0.5;
    }
  };
  const file = await measureJudgeLatency({
    capture,
    records,
    identities,
    judge: "qwen",
    production: productionWithLowCut(null),
    productionFit: "marc/fixture",
    latency: undefined,
    workerInfo: await getWorkspaceInfo(process.cwd()),
    loadRunner: async () => runner,
    log: () => undefined
  });
  assert.equal(scored, 0);
  assert.ok(file.cases.every((item) => item.units === 0));
});

test("the choice latency makes one forward per case with a distinct correction", async (t: TestContext) => {
  const capture = await captureFixture(t);
  let forwards = 0;
  const runner: ChoiceRunner = {
    identity: QWEN_IDENTITY,
    choose: async () => {
      forwards += 1;
      return { pCorrection: 0.5, pKeep: 0.5 };
    }
  };
  const file = await measureChoiceLatency({
    capture,
    latency: undefined,
    workerInfo: await getWorkspaceInfo(process.cwd()),
    loadRunner: async () => runner,
    log: () => undefined
  });
  const cases = choiceCasesOf(capture);
  assert.equal(forwards, cases.length * (MODEL_LATENCY_SAMPLES + 1));
  assert.equal(file.kind, "choice");
  assert.equal(file.productionFit, null);
  assert.ok(file.cases.every((item) => item.units === 1));
  assert.equal(file.cases.length, cases.length);
});
