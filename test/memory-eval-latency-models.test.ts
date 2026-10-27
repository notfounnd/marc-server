import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { asSearchRecord } from "../scripts/memory-eval/capture-types.js";
import {
  type BandCuts,
  type ModelParams,
  type ProcedureFit
} from "../scripts/memory-eval/fit-model.js";
import { type JudgeTarget } from "../scripts/memory-eval/judge.js";
import {
  MEMORY_NOTE,
  MODEL_LATENCY_LABEL,
  MODEL_LATENCY_SAMPLES,
  estimatedOf,
  memoryOf,
  modelLatencyFileName,
  preAdmittedTargetsOf,
  timedPasses,
  type TimedWork
} from "../scripts/memory-eval/latency-models.js";
import { createRssSampler } from "../scripts/memory-eval/memory-sampling.js";
import type {
  FeatureVector,
  ThreadFeatures
} from "../scripts/memory-eval/features.js";
import { captureFixture } from "./memory-eval-capture-fixtures.js";

const NO_CUTS: BandCuts = { high: null, medium: null, low: null };

const CONVERGENCE = {
  iterations: 1,
  projectedGradientNorm: 0,
  lossChangeLastWindow: 0,
  lossRangeLastWindow: 0
};

/** A procedure fit with fixed weights and the given low cut. */
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

/** Production parameters: H1 with the identity cosine and the title match, and the given low cut. */
function productionWithLowCut(low: number | null): ModelParams {
  return {
    ...procedure(-2, [1, 0, 0, 0, 0, 10, 0], low),
    fallbackCuts: NO_CUTS,
    cheap: procedure(0, [0, 0, 0, 0], null),
    judge: {}
  };
}

const ZERO: FeatureVector = {
  identityCosine: 0,
  bestPassageCosine: 0,
  bestRerankerScore: 0,
  secondRerankerScore: 0,
  identityRerankerScore: 0,
  lexicalTitleMatch: 0,
  lexicalContentMatch: 0
};

function featuresOf(
  threadId: string,
  values: Partial<FeatureVector>
): ThreadFeatures {
  return { ...ZERO, ...values, threadId };
}

test("the judged threads are the ones H1 pre-admits, under the production low cut", async (t: TestContext) => {
  const capture = await captureFixture(t);
  const seed = asSearchRecord(capture.records[0]);
  const targets: JudgeTarget[] = [
    // A has only lexical evidence: its semanticOnly is 0.119, below the cut 0.5.
    {
      threadId: "A",
      features: featuresOf("A", { lexicalTitleMatch: 1 }),
      identity: seed,
      passages: []
    },
    // B has semantic evidence: its semanticOnly is 0.731, above the cut 0.5.
    {
      threadId: "B",
      features: featuresOf("B", { identityCosine: 3 }),
      identity: seed,
      passages: []
    }
  ];
  const admitted = preAdmittedTargetsOf(targets, productionWithLowCut(0.5));
  assert.deepEqual(
    admitted.map((item) => item.threadId),
    ["B"]
  );
  assert.deepEqual(
    preAdmittedTargetsOf(targets, productionWithLowCut(null)),
    []
  );
});

test("the estimate is labelled estimated and its total needs the M0 median of each case", () => {
  const components = [
    { id: "c1", componentMs: 10 },
    { id: "c2", componentMs: 30 },
    { id: "c3", componentMs: 50 }
  ];
  const estimate = estimatedOf({
    m0: new Map([
      ["c1", 100],
      ["c2", 200]
    ]),
    components
  });
  assert.equal(estimate.label, MODEL_LATENCY_LABEL);
  assert.equal(estimate.label, "estimated");
  assert.equal(estimate.m0MedianMs, 150);
  assert.equal(estimate.componentMedianMs, 30);
  assert.equal(estimate.totalMedianMs, 170);
  assert.equal(estimate.casesWithM0, 2);
  assert.equal(estimate.cases, 3);

  const withoutM0 = estimatedOf({ m0: new Map(), components });
  assert.equal(withoutM0.m0MedianMs, null);
  assert.equal(withoutM0.totalMedianMs, null);
  assert.equal(withoutM0.componentMedianMs, 30);
});

test("the memory total is the peak plus the workers, and the delta is peak minus base, with a fake sampler", () => {
  const readings = [100, 300, 250];
  let index = 0;
  const read = () => readings[Math.min(index, readings.length - 1)] ?? 0;
  const sampler = createRssSampler(() => {
    const value = read();
    index += 1;
    return value;
  });
  sampler.sample();
  sampler.sample();
  const peak = sampler.stop();
  assert.equal(peak, 300);
  const memory = memoryOf({
    totalMemBytes: 1000,
    freeMemStartBytes: 400,
    freeMemEndBytes: 380,
    harnessBaseBytes: 100,
    harnessLoadedBytes: 150,
    harnessPeakBytes: peak,
    workersBeforeBytes: {},
    workersPeakBytes: { embedding: 50, reranking: 70 },
    workersAfterBytes: {}
  });
  assert.equal(memory.harnessDeltaBytes, 200);
  assert.equal(memory.totalSampledBytes, 420);
  assert.equal(memory.note, MEMORY_NOTE);
  assert.match(memory.note, /harnessDeltaBytes is peak minus base/);
});

test("every case gets one warm-up pass and the timed samples, and each pass is logged", async () => {
  const calls: string[] = [];
  const cases: TimedWork[] = [
    {
      id: "a",
      units: 2,
      work: async () => {
        calls.push("a");
      }
    },
    {
      id: "b",
      units: 0,
      work: async () => {
        calls.push("b");
      }
    }
  ];
  const logs: string[] = [];
  const measured = await timedPasses(
    cases,
    createRssSampler(() => 100),
    (line) => logs.push(line)
  );
  assert.equal(calls.length, cases.length * (MODEL_LATENCY_SAMPLES + 1));
  assert.deepEqual(
    measured.map((item) => item.samples.length),
    [MODEL_LATENCY_SAMPLES, MODEL_LATENCY_SAMPLES]
  );
  assert.deepEqual(
    measured.map((item) => item.units),
    [2, 0]
  );
  assert.equal(logs.length, MODEL_LATENCY_SAMPLES + 1);
});

test("the file names carry the model: latency-judge-<model>.json and latency-choice-<model>.json", () => {
  assert.equal(
    modelLatencyFileName("judge", "qwen"),
    "latency-judge-qwen.json"
  );
  assert.equal(
    modelLatencyFileName("choice", "lfm"),
    "latency-choice-lfm.json"
  );
});
