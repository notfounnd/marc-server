import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import type { EvalDataset } from "../scripts/memory-eval/dataset.js";
import {
  cellKeyOf,
  commitMerge,
  mergeJudgments,
  serializeDataset
} from "../scripts/memory-eval/judgments.js";
import {
  passageIdOf,
  SCOPE_PASSAGES,
  SCOPE_SOURCE_TEXT,
  SCOPE_SUMMARY,
  SCOPE_THREAD,
  scopedCase
} from "./memory-eval-deep-fixtures.js";

/** The closed thread of the merge, and the pinned source of its evidence quote. */
const CORPUS = new Map([[SCOPE_THREAD, "closed summary"]]);
const SOURCES = new Map([[SCOPE_SUMMARY, SCOPE_SOURCE_TEXT]]);
const P1 = passageIdOf(SCOPE_PASSAGES[0]!);
const P2 = passageIdOf(SCOPE_PASSAGES[1]!);

/** A dataset file in a fresh directory, removed after the test. Returns its path and its current text. */
async function datasetFileOf(t: TestContext, dataset: EvalDataset) {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "marc-deep-merge-")
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const datasetPath = path.join(directory, "marc-deep.json");
  const text = serializeDataset(dataset);
  await fs.writeFile(datasetPath, text);
  return { datasetPath, text };
}

/** The raters of the two passages of the scope case: they agree on P1 and diverge on P2, which the consensus resolves. */
function passageRaters(id: string) {
  return {
    raterA: {
      [id]: {
        [cellKeyOf({ passageId: P1 })]: 2,
        [cellKeyOf({ passageId: P2 })]: 3
      }
    },
    raterB: {
      [id]: {
        [cellKeyOf({ passageId: P1 })]: 2,
        [cellKeyOf({ passageId: P2 })]: 1
      }
    },
    consensus: { [id]: { [cellKeyOf({ passageId: P2 })]: 3 } }
  };
}

test("a merge that holds only passage grades writes the dataset with the agreed grades", async (t) => {
  const dataset: EvalDataset = {
    schemaVersion: 1,
    corpus: "marc-deep",
    cases: [scopedCase()]
  };
  const { datasetPath } = await datasetFileOf(t, dataset);
  const outcome = mergeJudgments({
    dataset,
    corpus: CORPUS,
    sources: SOURCES,
    ...passageRaters(scopedCase().id),
    passageIds: new Set([P1, P2])
  });
  assert.equal(outcome.report.written.length, 0);
  assert.equal(outcome.report.passages?.written.length, 2);
  assert.equal(await commitMerge({ datasetPath, outcome }), true);
  const written = await fs.readFile(datasetPath, "utf8");
  assert.equal(written, serializeDataset(outcome.merged));
  assert.deepEqual(
    (JSON.parse(written) as EvalDataset).cases[0]?.passageJudgments,
    { [P1]: 2, [P2]: 3 }
  );
});

test("a merge with issues writes nothing, neither the thread grades nor the passage grades", async (t) => {
  const id = scopedCase().id;
  const dataset: EvalDataset = {
    schemaVersion: 1,
    corpus: "marc-deep",
    cases: [
      scopedCase(),
      scopedCase({ id: "D-broken", judgments: { "thread-not-closed-zzzz": 3 } })
    ]
  };
  const { datasetPath, text } = await datasetFileOf(t, dataset);
  const outcome = mergeJudgments({
    dataset,
    corpus: CORPUS,
    sources: SOURCES,
    ...passageRaters(id),
    passageIds: new Set([P1, P2])
  });
  assert.equal(outcome.report.issues.length > 0, true);
  assert.equal(outcome.report.passages?.written.length, 2);
  assert.equal(await commitMerge({ datasetPath, outcome }), false);
  assert.equal(await fs.readFile(datasetPath, "utf8"), text);
});

test("a merge that holds only thread grades is written as before, and reports no passage section", async (t) => {
  const id = scopedCase().id;
  const dataset: EvalDataset = {
    schemaVersion: 1,
    corpus: "marc-deep",
    cases: [scopedCase({ judgments: {} })]
  };
  const { datasetPath } = await datasetFileOf(t, dataset);
  const outcome = mergeJudgments({
    dataset,
    corpus: CORPUS,
    sources: SOURCES,
    raterA: { [id]: { [SCOPE_THREAD]: 3 } },
    raterB: { [id]: { [SCOPE_THREAD]: 3 } }
  });
  assert.equal(outcome.report.passages, undefined);
  assert.equal(outcome.report.written.length, 1);
  assert.equal(await commitMerge({ datasetPath, outcome }), true);
  const written = (
    JSON.parse(await fs.readFile(datasetPath, "utf8")) as EvalDataset
  ).cases[0];
  assert.deepEqual(written?.judgments, { [SCOPE_THREAD]: 3 });
});
