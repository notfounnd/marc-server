import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { compareCaptures } from "../scripts/memory-eval/compare.js";
import {
  createFakes,
  dataset,
  fixtureThreadsRoot,
  readCaptureFile,
  runCapture,
  tempDirectory,
  THREAD_TOKEN
} from "./memory-eval-capture-fixtures.js";
import { judgedDataset } from "./memory-eval-judged-fixtures.js";

test("compare pairs the cases by id and gives a zero difference for the same variant", async (t) => {
  const threadsRoot = await fixtureThreadsRoot(t);
  const captured = await runCapture({
    threadsRoot,
    outputRoot: await tempDirectory(t),
    fakes: createFakes()
  });
  const capture = await readCaptureFile(captured.result.captureDir);

  const result = await compareCaptures({
    dataset: judgedDataset,
    baseline: { capture, variant: "M0", inputs: {} },
    candidate: { capture, variant: "M0", inputs: {} }
  });

  assert.equal(result.verdict, "compared");
  assert.ok(result.rows.length > 0);
  for (const row of result.rows) {
    assert.ok(row.difference === 0 || row.difference === null);
  }
  assert.ok(
    result.rows.some(
      (row) => row.scope === "total" && row.metric === "top1Target"
    )
  );
});

test("compare refuses captures built over different corpus content", async (t) => {
  const threadsRoot = await fixtureThreadsRoot(t);
  const before = await runCapture({
    threadsRoot,
    outputRoot: await tempDirectory(t),
    fakes: createFakes()
  });
  await fs.appendFile(
    path.join(threadsRoot, THREAD_TOKEN, "SUMMARY.md"),
    "\nAlterado depois da primeira captura.\n"
  );
  const after = await runCapture({
    threadsRoot,
    outputRoot: await tempDirectory(t),
    fakes: createFakes()
  });
  const baseline = await readCaptureFile(before.result.captureDir);
  const candidate = await readCaptureFile(after.result.captureDir);

  assert.notEqual(baseline.corpusDigest, candidate.corpusDigest);
  await assert.rejects(
    compareCaptures({
      dataset: judgedDataset,
      baseline: { capture: baseline, variant: "M0", inputs: {} },
      candidate: { capture: candidate, variant: "M0", inputs: {} }
    }),
    /corpusDigest/
  );
});

test("compare gives no verdict while a side has unjudged pairs in reach", async (t) => {
  const threadsRoot = await fixtureThreadsRoot(t);
  const captured = await runCapture({
    threadsRoot,
    outputRoot: await tempDirectory(t),
    fakes: createFakes()
  });
  const capture = await readCaptureFile(captured.result.captureDir);

  const result = await compareCaptures({
    dataset,
    baseline: { capture, variant: "M0", inputs: {} },
    candidate: { capture, variant: "M0", inputs: {} }
  });

  assert.equal(result.verdict, "incomplete");
  assert.deepEqual(result.rows, []);
  assert.ok(result.baseline.pendingPairs > 0);
});
