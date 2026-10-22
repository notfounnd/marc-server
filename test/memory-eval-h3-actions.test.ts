import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { EvalDataset } from "../scripts/memory-eval/dataset.js";
import { interpretationContribution } from "../scripts/memory-eval/metrics.js";
import {
  addActionOf,
  expectationOf,
  suggestionTableLines,
  type SuggestionFile
} from "../scripts/memory-eval/h3.js";
import { captureFixture, dataset } from "./memory-eval-capture-fixtures.js";

/** The fixture dataset with every case unlabelled, in the given style. */
function unlabelledDatasetIn(style: "negative" | "typo"): EvalDataset {
  return {
    ...dataset,
    cases: dataset.cases.map((item) => ({
      ...item,
      style,
      expectedInterpretation: undefined
    }))
  };
}

test("the unlabelled counts mark an applied correction when the effective query changes, and a suggestion when one is shown", () => {
  let counts = addActionOf(
    {},
    "negative",
    { effective: "billing", suggested: undefined },
    "billng"
  );
  counts = addActionOf(
    counts,
    "negative",
    { effective: "billng", suggested: "billing" },
    "billng"
  );
  counts = addActionOf(
    counts,
    "typo",
    { effective: "billng", suggested: undefined },
    "billng"
  );
  assert.deepEqual(counts, {
    negative: { cases: 2, applied: 1, suggested: 1 },
    typo: { cases: 1, applied: 0, suggested: 0 }
  });
});

test("the table lists the unlabelled counts after the alternatives, labelled as breakdown by style", () => {
  const file: SuggestionFile = {
    schemaVersion: 1,
    corpus: "ledgerline-en",
    captureId: "capture-a",
    modelCaptureId: "capture-a",
    cases: 1,
    alternatives: {
      model: { label: "A", totals: { precision: { num: 1, den: 2 } } }
    },
    perCase: [],
    unlabelledActions: {
      model: { typo: { cases: 2, applied: 1, suggested: 0 } }
    }
  };
  assert.deepEqual(suggestionTableLines(file), [
    "cases=1",
    "alternative precision",
    "A precision=1/2",
    "A unlabelled typo: applied=1/2 suggested=0/2"
  ]);
});

test("a correction applied to a case without an expected interpretation is correctionUndue, and a suggestion is suggestionUndue", async (t: TestContext) => {
  const capture = await captureFixture(t);
  const captured = capture.cases[0];
  const expected = expectationOf(unlabelledDatasetIn("negative"), captured);
  assert.deepEqual(expected, { effectiveQuery: captured.originalQuery });
  const applied = interpretationContribution(
    {
      originalQuery: captured.originalQuery,
      interpretation: { effectiveQuery: `${captured.originalQuery} corrected` }
    },
    expected
  );
  assert.deepEqual(applied.correctionUndue, { num: 1, den: 1 });
  const suggested = interpretationContribution(
    {
      originalQuery: captured.originalQuery,
      interpretation: {
        effectiveQuery: captured.originalQuery,
        suggestedQuery: `${captured.originalQuery} corrected`
      }
    },
    expected
  );
  assert.deepEqual(suggested.suggestionUndue, { num: 1, den: 1 });
  assert.deepEqual(suggested.correctionUndue, { num: 0, den: 1 });
});

test("a typo case without an expected interpretation is an explicit error, not a silent keep", async (t: TestContext) => {
  const capture = await captureFixture(t);
  assert.throws(
    () => expectationOf(unlabelledDatasetIn("typo"), capture.cases[0]),
    /has style typo without expectedInterpretation/
  );
});
