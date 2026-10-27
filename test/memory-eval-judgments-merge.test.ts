import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import {
  commitMerge,
  mergeJudgments,
  writeMergeReport
} from "../scripts/memory-eval/judgments.js";
import type { EvalDataset } from "../scripts/memory-eval/dataset.js";
import {
  dataset,
  FIXTURE_THREADS,
  THREAD_RULES,
  THREAD_SETTINGS,
  THREAD_TOKEN
} from "./memory-eval-capture-fixtures.js";

const corpus = new Map(
  FIXTURE_THREADS.map((thread) => [thread.threadId, thread.markdown])
);

function merge(
  raterA: unknown,
  raterB: unknown,
  consensus?: unknown,
  input: EvalDataset = dataset
) {
  return mergeJudgments({
    dataset: input,
    corpus,
    sources: new Map(),
    raterA,
    raterB,
    consensus
  });
}

async function temporaryFile(t: TestContext, name: string): Promise<string> {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "marc-memory-eval-merge-")
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return path.join(directory, name);
}

test("concordant pairs are merged and divergent pairs wait for a consensus", () => {
  const agree = { A1: { [THREAD_SETTINGS]: 0, [THREAD_RULES]: 1 } };
  // A2's token is not judged in the fixture, so the pair can be written.
  const divergent = { A2: { [THREAD_TOKEN]: 0 } };
  const other = { A2: { [THREAD_TOKEN]: 2 } };

  const concordant = merge(agree, agree);
  assert.equal(concordant.report.concordant, 2);
  assert.deepEqual(concordant.merged.cases[0]?.judgments, {
    [THREAD_RULES]: 1,
    [THREAD_SETTINGS]: 0,
    [THREAD_TOKEN]: 3
  });

  const open = merge(divergent, other);
  assert.equal(open.report.divergences.length, 1);
  assert.equal(open.report.unresolved.length, 1);
  assert.equal(open.report.written.length, 0);

  const resolved = merge(divergent, other, { A2: { [THREAD_TOKEN]: 1 } });
  assert.equal(resolved.report.unresolved.length, 0);
  assert.deepEqual(resolved.report.written, [
    { caseId: "A2", threadId: THREAD_TOKEN, layer: 0, grade: 1 }
  ]);
});

test("a consensus that touches a concordant or missing pair is refused", () => {
  const agree = { A1: { [THREAD_SETTINGS]: 0 } };
  assert.throws(
    () => merge(agree, agree, { A1: { [THREAD_SETTINGS]: 1 } }),
    /not a divergent pair/
  );
  assert.throws(
    () =>
      merge(
        { A1: { [THREAD_SETTINGS]: 0 } },
        { A1: { [THREAD_SETTINGS]: 2 } },
        { A1: { [THREAD_RULES]: 1 } }
      ),
    /not a divergent pair/
  );
});

test("an existing grade is never overwritten; a different one is listed as a conflict", () => {
  // The fixture judges A1's target (token) with grade 3.
  const outcome = merge(
    { A1: { [THREAD_TOKEN]: 2 } },
    { A1: { [THREAD_TOKEN]: 2 } }
  );
  assert.deepEqual(outcome.report.conflicts, [
    { caseId: "A1", threadId: THREAD_TOKEN, layer: 0, existing: 3, proposed: 2 }
  ]);
  assert.equal(outcome.report.written.length, 0);
  assert.equal(outcome.merged.cases[0]?.judgments[THREAD_TOKEN], 3);
});

test("invalid grades are refused before anything is merged", () => {
  for (const grade of [4, -1, 1.5, "3", null]) {
    assert.throws(
      () =>
        merge(
          { A1: { [THREAD_SETTINGS]: grade } },
          { A1: { [THREAD_SETTINGS]: 0 } }
        ),
      /invalid grade/
    );
  }
});

test("kappa of a known matrix is 1/3 and the flag marks it below the threshold", () => {
  const first = {
    A1: { [THREAD_TOKEN]: 0, [THREAD_SETTINGS]: 0, [THREAD_RULES]: 1 },
    A2: { [THREAD_TOKEN]: 1, [THREAD_SETTINGS]: 0, [THREAD_RULES]: 1 }
  };
  const second = {
    A1: { [THREAD_TOKEN]: 0, [THREAD_SETTINGS]: 0, [THREAD_RULES]: 1 },
    A2: { [THREAD_TOKEN]: 1, [THREAD_SETTINGS]: 1, [THREAD_RULES]: 0 }
  };
  const outcome = merge(first, second);
  assert.ok(
    outcome.report.kappa !== null &&
      Math.abs(outcome.report.kappa - 1 / 3) < 1e-12
  );
  assert.deepEqual(outcome.report.flags, ["kappa_below_threshold"]);
  assert.equal(outcome.report.divergences.length, 2);
});

test("a merge that would make the dataset invalid is reported and not committed", async (t: TestContext) => {
  const negative: EvalDataset = {
    ...dataset,
    cases: [
      ...dataset.cases,
      {
        id: "N1",
        family: "negative:N1",
        style: "negative",
        query: "receita de bolo de chocolate",
        queryMode: "literal",
        judgments: {},
        origin: "fixture-merge"
      }
    ]
  };
  const outcome = merge(
    { N1: { [THREAD_RULES]: 2 } },
    { N1: { [THREAD_RULES]: 2 } },
    undefined,
    negative
  );
  assert.equal(
    outcome.report.issues[0]?.rule,
    "negative-with-relevant-judgment"
  );

  const datasetPath = await temporaryFile(t, "marc.json");
  assert.equal(await commitMerge({ datasetPath, outcome }), false);
  await assert.rejects(fs.access(datasetPath));
});

test("a valid merge is committed with the case order kept and the judgments sorted", async (t: TestContext) => {
  const datasetPath = await temporaryFile(t, "marc.json");
  const outcome = merge(
    { A2: { [THREAD_TOKEN]: 0, [THREAD_RULES]: 2 } },
    { A2: { [THREAD_TOKEN]: 0, [THREAD_RULES]: 2 } }
  );

  assert.equal(await commitMerge({ datasetPath, outcome }), true);
  const written = JSON.parse(
    await fs.readFile(datasetPath, "utf8")
  ) as EvalDataset;
  assert.deepEqual(
    written.cases.map((item) => item.id),
    dataset.cases.map((item) => item.id)
  );
  const judgments = Object.keys(written.cases[1]?.judgments ?? {});
  assert.deepEqual(judgments, [...judgments].sort());
  assert.equal(written.cases[1]?.judgments[THREAD_RULES], 2);
  assert.ok((await fs.readFile(datasetPath, "utf8")).endsWith("\n"));
});

test("the merge report is written as merge-<timestamp>.json with kappa and counts", async (t: TestContext) => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "marc-memory-eval-report-")
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const outcome = merge(
    { A1: { [THREAD_SETTINGS]: 0 } },
    { A1: { [THREAD_SETTINGS]: 0 } }
  );

  const filePath = await writeMergeReport(
    directory,
    outcome.report,
    new Date("2026-10-15T12:00:00.000Z")
  );

  assert.equal(path.basename(filePath), "merge-2026-10-15T12-00-00-000Z.json");
  const saved = JSON.parse(await fs.readFile(filePath, "utf8")) as {
    pairs: number;
    kappa: number | null;
  };
  assert.equal(saved.pairs, 1);
  assert.equal(saved.kappa, outcome.report.kappa);
});
