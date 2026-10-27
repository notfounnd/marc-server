import assert from "node:assert/strict";
import test from "node:test";
import { evaluateVariant } from "../scripts/memory-eval/evaluation.js";
import {
  pendingPairs,
  type CaseInput
} from "../scripts/memory-eval/metrics.js";
import {
  presentLayersOf,
  requiredLayersOf
} from "../scripts/memory-eval/required-cells.js";
import type { VariantResult } from "../scripts/memory-eval/variants.js";

/** The case of the Codex review: G is graded 1 at the summary, and its artifact passage lies in layer 1. */
function caseWith(
  input: Partial<CaseInput> & Pick<CaseInput, "judgedDepth" | "gradesByLayer">
): CaseInput {
  const base = {
    caseId: "C1",
    family: "family",
    style: "direct",
    judgments: { G: 1 },
    results: [
      { threadId: "G", score: 1, admitted: true }
    ] as unknown as VariantResult[],
    presentLayers: new Map([["G", new Set([0, 1])]])
  };
  return { ...base, ...input } as CaseInput;
}

test("DEPTH1 is incomplete when the layer-1 cell of a reached group has no judgment, even with a layer-0 grade", () => {
  const codex = caseWith({
    judgedDepth: 1,
    gradesByLayer: { 0: { G: 1 }, 1: {}, 2: {} }
  });
  assert.deepEqual(pendingPairs([codex], true), [
    { caseId: "C1", threadId: "G", reach: "admittedList", layer: 1 }
  ]);
  assert.equal(evaluateVariant("DEPTH1", [codex]).status, "incomplete");
});

test("the layer-1 cell judged, DEPTH1 has no pending cell and is complete", () => {
  const judged = caseWith({
    judgedDepth: 1,
    gradesByLayer: { 0: { G: 1 }, 1: { G: 2 }, 2: {} }
  });
  assert.deepEqual(pendingPairs([judged], true), []);
  assert.equal(evaluateVariant("DEPTH1", [judged]).status, "complete");
});

test("a layer deeper than the judged depth is not required", () => {
  const shallow = caseWith({
    judgedDepth: 0,
    gradesByLayer: { 0: { G: 1 }, 1: {}, 2: {} }
  });
  assert.deepEqual(pendingPairs([shallow], true), []);
});

test("a group judged in no layer is pending at its own layer 0", () => {
  const unjudged = caseWith({
    judgedDepth: 0,
    judgments: {},
    gradesByLayer: { 0: {}, 1: {}, 2: {} }
  });
  assert.deepEqual(pendingPairs([unjudged], true), [
    { caseId: "C1", threadId: "G", reach: "admittedList", layer: 0 }
  ]);
});

test("a capture with layer 0 only keeps the old rule: a judged thread is complete", () => {
  const old = caseWith({
    judgedDepth: 2,
    gradesByLayer: { 0: { G: 1 }, 1: {}, 2: {} },
    presentLayers: undefined
  });
  assert.deepEqual(pendingPairs([old], true), []);
});

test("the required layers are the layers up to the depth that hold the passages; a thread always owns layer 0", () => {
  assert.deepEqual(requiredLayersOf("G", 2, new Set([0, 1])), [0, 1]);
  assert.deepEqual(requiredLayersOf("G", 0, new Set([0, 1])), [0]);
  assert.deepEqual(requiredLayersOf("@rules", 1, new Set([1])), [1]);
  assert.deepEqual(requiredLayersOf("@rules", 2, new Set([1])), [1]);
});

test("the worksheet and the evaluation read the same layers of a capture", () => {
  const layers = presentLayersOf([
    { threadId: "G", layer: 0 },
    { threadId: "G", layer: 1 },
    { threadId: "@rules", layer: 1 }
  ]);
  assert.deepEqual(layers, { G: [0, 1], "@rules": [1] });
});
