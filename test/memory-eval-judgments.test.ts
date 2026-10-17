import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { replayCapture } from "../scripts/memory-eval/replay.js";
import {
  buildWorksheet,
  poolOf,
  variantReachThreads
} from "../scripts/memory-eval/judgments.js";
import type { VariantResult } from "../scripts/memory-eval/variants.js";
import {
  createFakes,
  dataset,
  FIXTURE_THREAD_IDS,
  fixtureThreadsRoot,
  readCaptureFile,
  runCapture,
  tempDirectory,
  THREAD_RULES,
  THREAD_SETTINGS,
  THREAD_TOKEN
} from "./memory-eval-capture-fixtures.js";

function admittedResult(threadId: string): VariantResult {
  return { threadId, score: 0.9, admitted: true };
}

test("the pool is the union of the five sources in alphabetical order", () => {
  const pool = poolOf({
    m0Admitted: ["c", "a"],
    d0Top: ["b", "a"],
    identity: ["d"],
    reranker: ["e"],
    judged: ["f"],
    variantReach: ["g"]
  });
  assert.deepEqual(pool, ["a", "b", "c", "d", "e", "f", "g"]);
});

test("--variants adds exactly the METRIC_REACH of the listed variant, including an admitted thread at 11th place", () => {
  const admitted = Array.from({ length: 11 }, (_, index) =>
    admittedResult(`T${String(index + 1).padStart(2, "0")}`)
  );
  const all = admitted.map((item) => item.threadId);
  assert.deepEqual(variantReachThreads(admitted, "M0"), all);
  assert.ok(variantReachThreads(admitted, "M0").includes("T11"));
  assert.deepEqual(variantReachThreads(admitted, "D0"), all.slice(0, 10));
  assert.deepEqual(
    variantReachThreads(admitted, "ORACLE_ADMISSION"),
    all.slice(0, 10)
  );
});

test("the worksheet lists only the pending pairs of the pool, in alphabetical order", async (t: TestContext) => {
  const { capture, replay, threadsRoot } = await worksheetFixture(t);

  const worksheet = await buildWorksheet({
    capture,
    dataset,
    replay,
    source: { threadsRoot, threadIds: FIXTURE_THREAD_IDS },
    variants: []
  });

  const first = worksheet.cases.find((item) => item.caseId === "A1");
  assert.deepEqual(
    first?.threads.map((thread) => thread.threadId),
    [THREAD_RULES, THREAD_SETTINGS]
  );
  assert.equal(
    worksheet.pending,
    worksheet.cases.reduce((total, item) => total + item.threads.length, 0)
  );
});

test("the template holds only the pending pairs, as nulls", async (t: TestContext) => {
  const { capture, replay, threadsRoot } = await worksheetFixture(t);

  const worksheet = await buildWorksheet({
    capture,
    dataset,
    replay,
    source: { threadsRoot, threadIds: FIXTURE_THREAD_IDS },
    variants: []
  });

  assert.deepEqual(worksheet.template.A1, {
    [THREAD_RULES]: null,
    [THREAD_SETTINGS]: null
  });
  assert.ok(!Object.hasOwn(worksheet.template.A1 ?? {}, THREAD_TOKEN));
});

test("the worksheet names neither variants, origins nor positions", async (t: TestContext) => {
  const { capture, replay, threadsRoot } = await worksheetFixture(t);

  const worksheet = await buildWorksheet({
    capture,
    dataset,
    replay,
    source: { threadsRoot, threadIds: FIXTURE_THREAD_IDS },
    variants: []
  });

  for (const word of [
    "M0",
    "D0",
    "ORACLE",
    "variante",
    "origem",
    "posição",
    "position"
  ]) {
    assert.ok(!worksheet.markdown.includes(word), `worksheet names ${word}`);
  }
});

test("the worksheet snippet is the passage with the best reranker score for the query", async (t: TestContext) => {
  const { capture, replay, threadsRoot } = await worksheetFixture(t);

  const worksheet = await buildWorksheet({
    capture,
    dataset,
    replay,
    source: { threadsRoot, threadIds: FIXTURE_THREAD_IDS },
    variants: []
  });

  const second = worksheet.cases.find((item) => item.caseId === "A2");
  const token = second?.threads.find(
    (thread) => thread.threadId === THREAD_TOKEN
  );
  assert.ok(token?.snippet.includes("Rotacionar"));
  assert.equal(token?.section, "Decisao");
});

test("the worksheet refuses to run when the corpus content changed since the capture", async (t: TestContext) => {
  const threadsRoot = await fixtureThreadsRoot(t);
  const captured = await runCapture({
    threadsRoot,
    outputRoot: await tempDirectory(t),
    fakes: createFakes()
  });
  const capture = await readCaptureFile(captured.result.captureDir);
  const replay = await replayCapture({
    capture,
    dataset,
    variantIds: ["M0", "D0"]
  });
  await fs.appendFile(
    path.join(threadsRoot, THREAD_TOKEN, "SUMMARY.md"),
    "\nAlterado.\n"
  );

  await assert.rejects(
    buildWorksheet({
      capture,
      dataset,
      replay,
      source: { threadsRoot, threadIds: FIXTURE_THREAD_IDS },
      variants: []
    }),
    /corpus changed since the capture/
  );
});

/** Capture of the fixture and its M0/D0 replay. The fixture dataset judges only the target of A1. */
async function worksheetFixture(t: TestContext) {
  const threadsRoot = await fixtureThreadsRoot(t);
  const captured = await runCapture({
    threadsRoot,
    outputRoot: await tempDirectory(t),
    fakes: createFakes()
  });
  const capture = await readCaptureFile(captured.result.captureDir);
  const replay = await replayCapture({
    capture,
    dataset,
    variantIds: ["M0", "D0"]
  });
  return { capture, replay, threadsRoot };
}
