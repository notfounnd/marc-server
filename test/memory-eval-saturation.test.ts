import assert from "node:assert/strict";
import test from "node:test";
import type { CaseInput } from "../scripts/memory-eval/metrics.js";
import { pendingPairs } from "../scripts/memory-eval/metrics.js";
import {
  requiredLayersOf,
  saturatedOf
} from "../scripts/memory-eval/required-cells.js";

const ALL_LAYERS = new Set([0, 1, 2]);

/** A case with one reached group, graded in layer 0 with `summary`, judged at depth 2 and present in all layers. */
function caseOf(summary: 0 | 1 | 2 | 3): CaseInput {
  return {
    caseId: "A1",
    family: "family",
    style: "implicit",
    judgments: { thread: summary },
    results: [{ threadId: "thread", score: 0.9, admitted: true }],
    judgedDepth: 2,
    gradesByLayer: { 0: { thread: summary }, 1: {}, 2: {} },
    presentLayers: new Map([["thread", ALL_LAYERS]])
  };
}

test("a summary grade of 3 saturates the group: only its summary layer is required", () => {
  assert.equal(saturatedOf({ thread: 3 }, "thread"), true);
  assert.equal(requiredLayersOf("thread", 2, ALL_LAYERS, true).join(","), "0");
});

test("a summary grade below 3, or no grade, does not saturate the group", () => {
  assert.equal(saturatedOf({ thread: 2 }, "thread"), false);
  assert.equal(saturatedOf({}, "thread"), false);
  assert.equal(
    requiredLayersOf("thread", 2, ALL_LAYERS, false).join(","),
    "0,1,2"
  );
});

test("a saturated group with summary 3 asks no layer and leaves its case complete", () => {
  assert.deepEqual(pendingPairs([caseOf(3)], true), []);
});

test("a group with summary 2 keeps asking its layers 1 and 2 at depth 2", () => {
  const pending = pendingPairs([caseOf(2)], true).map((item) => item.layer);
  assert.deepEqual(pending, [1, 2]);
});
