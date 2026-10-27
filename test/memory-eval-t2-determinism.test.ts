import assert from "node:assert/strict";
import test from "node:test";
import { runFunnel, type FunnelConfig } from "../src/core/memory/funnel-run.js";
import { caseInput } from "./memory-funnel-fixtures.js";

/** The adaptive config without the stop rule: every step runs and leaves its trace. */
const ADAPTIVE_NO_STOP: FunnelConfig = {
  depths: [0, 1, 2],
  stopOn: "none",
  budgeted: true,
  passages: "budget",
  finalists: "funnel"
};

test("the funnel is deterministic: two runs of the same input give the same finalists, admitted groups and trace", () => {
  const first = runFunnel(caseInput({ budget: 12, k: 2 }), ADAPTIVE_NO_STOP);
  const second = runFunnel(caseInput({ budget: 12, k: 2 }), ADAPTIVE_NO_STOP);
  assert.deepEqual(second.admitted, first.admitted);
  assert.deepEqual(second.layersSearched, first.layersSearched);
  assert.equal(second.stopReason, first.stopReason);
  assert.deepEqual(
    second.steps.map((step) => step.finalists),
    first.steps.map((step) => step.finalists)
  );
  assert.deepEqual(
    second.steps.map((step) => [step.scored, step.cached]),
    first.steps.map((step) => [step.scored, step.cached])
  );
});
