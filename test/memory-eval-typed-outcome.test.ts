import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import {
  suggestionTableLines,
  type SuggestionFile
} from "../scripts/memory-eval/h3.js";
import { typedOutcome } from "../scripts/memory-eval/suggestion.js";
import { captureFixture } from "./memory-eval-capture-fixtures.js";

test("the typed outcome applies, suggests or keeps the query by the decision", async (t: TestContext) => {
  const capture = structuredClone(await captureFixture(t));
  const captured = capture.cases[0];
  captured.candidates.variants[1] = `${captured.originalQuery} corrected`;
  const correction = captured.candidates.variants[1];
  assert.deepEqual(typedOutcome(captured, "apply"), {
    effective: correction,
    suggested: undefined
  });
  assert.deepEqual(typedOutcome(captured, "suggest"), {
    effective: captured.originalQuery,
    suggested: correction
  });
  assert.deepEqual(typedOutcome(captured, "none"), {
    effective: captured.originalQuery,
    suggested: undefined
  });
});

test("a distinct correction without a typed decision is an error", async (t: TestContext) => {
  const capture = structuredClone(await captureFixture(t));
  const captured = capture.cases[0];
  captured.candidates.variants[1] = `${captured.originalQuery} corrected`;
  assert.throws(
    () => typedOutcome(captured, undefined),
    new RegExp(`No typed choice decision for case ${captured.id}`)
  );
});

test("a case whose correction is the query itself needs no decision and keeps the query", async (t: TestContext) => {
  const capture = structuredClone(await captureFixture(t));
  const captured = capture.cases[0];
  captured.candidates.variants[1] = captured.originalQuery;
  assert.deepEqual(typedOutcome(captured, undefined), {
    effective: captured.originalQuery,
    suggested: undefined
  });
});

test("the table lists only the alternatives that were run", () => {
  const file: SuggestionFile = {
    schemaVersion: 1,
    corpus: "marc",
    captureId: "capture-a",
    modelCaptureId: "capture-a",
    cases: 2,
    alternatives: {
      model: { label: "A", totals: { precision: { num: 1, den: 2 } } }
    },
    perCase: [],
    unlabelledActions: {}
  };
  assert.deepEqual(suggestionTableLines(file), [
    "cases=2",
    "alternative precision",
    "A precision=1/2"
  ]);
});
