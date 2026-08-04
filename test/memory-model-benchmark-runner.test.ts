import assert from "node:assert/strict";
import test from "node:test";
import {
  benchmarkQualityDeltas,
  encodeMemoryModelBenchmarkReport,
  parseMemoryModelBenchmarkReport
} from "../scripts/memory-model-benchmark-runner.js";

test("extracts the benchmark report from noisy child output", () => {
  const report = { aggregate: { meanNdcgAt10: 0.75 }, failures: [] };
  const output = [
    "Downloading model files...",
    encodeMemoryModelBenchmarkReport(report),
    "Worker stopped."
  ].join("\n");

  assert.deepEqual(parseMemoryModelBenchmarkReport(output), report);
});

test("rejects child output without a benchmark report", () => {
  assert.throws(
    () => parseMemoryModelBenchmarkReport("Model loading failed."),
    /did not emit a quality report/
  );
});

test("compares quality metrics against the baseline", () => {
  const deltas = benchmarkQualityDeltas({
    baseline: {
      meanNdcgAt10: 0.5,
      meanReciprocalRank: 0.4,
      meanRecallAt10: 0.6
    },
    "retriever-base": {
      meanNdcgAt10: 0.7,
      meanReciprocalRank: 0.45,
      meanRecallAt10: 0.55
    }
  });

  assert.deepEqual(deltas["retriever-base"], {
    meanNdcgAt10: 0.2,
    meanReciprocalRank: 0.05,
    meanRecallAt10: -0.05
  });
});
