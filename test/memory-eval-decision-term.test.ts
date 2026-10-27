import assert from "node:assert/strict";
import test from "node:test";
import { decisionTerm } from "../scripts/memory-eval/statistics.js";

const MARGIN = 0.05;

test("an interval below zero but within the margin is non-inferior, never worsening", () => {
  assert.deepEqual(decisionTerm({ lower: -0.01, upper: -0.005 }, MARGIN), {
    term: "não inferior",
    nonInferior: true
  });
});

test("an interval wholly below the negative margin is worsening and not non-inferior", () => {
  assert.deepEqual(decisionTerm({ lower: -0.2, upper: -0.1 }, MARGIN), {
    term: "piora",
    nonInferior: false
  });
});

test("an interval that crosses zero and the negative margin is inconclusive and never non-inferior", () => {
  assert.deepEqual(decisionTerm({ lower: -0.06, upper: 0.01 }, MARGIN), {
    term: "inconclusivo",
    nonInferior: false
  });
});

test("an interval above zero is an improvement and is non-inferior", () => {
  assert.deepEqual(decisionTerm({ lower: 0.01, upper: 0.2 }, MARGIN), {
    term: "melhora",
    nonInferior: true
  });
});
