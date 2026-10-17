import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type {
  CaptureFile,
  CapturedCase
} from "../scripts/memory-eval/capture-types.js";
import type { RelevanceGrade } from "../scripts/memory-eval/dataset.js";
import {
  cachedReplayProviders,
  replayCapture,
  replayCase,
  type CaseReplay
} from "../scripts/memory-eval/replay.js";
import type { VariantResult } from "../scripts/memory-eval/variants.js";
import {
  captureFixture,
  dataset,
  THREAD_SETTINGS,
  THREAD_TOKEN
} from "./memory-eval-capture-fixtures.js";

function caseInput(
  capture: CaptureFile,
  caseId: string,
  judgments: Record<string, RelevanceGrade>,
  variantIds: string[]
) {
  const captured =
    capture.cases.find((item) => item.id === caseId) ?? missingCase(caseId);
  return {
    captured,
    judgments,
    records: new Map(
      capture.records.map((record) => [record.recordId, record])
    ),
    variantIds,
    providers: cachedReplayProviders(captured, capture)
  };
}

function missingCase(caseId: string): CapturedCase {
  throw new Error(`The capture has no case ${caseId}.`);
}

function resultsOf(replayed: CaseReplay, variant: string): VariantResult[] {
  return (
    replayed.variants.find((item) => item.variant === variant)?.results ?? []
  );
}

/** Judgments that fail the test as soon as any property is read. */
function unreadableJudgments(): Record<string, RelevanceGrade> {
  const fail = (): never => {
    throw new Error(
      "The judgments were read by a variant that must not read them."
    );
  };
  return new Proxy({} as Record<string, RelevanceGrade>, {
    get: fail,
    has: fail,
    ownKeys: fail,
    getOwnPropertyDescriptor: fail
  });
}

test("M0 replay reproduces the production recall for every captured case", async (t: TestContext) => {
  const capture = await captureFixture(t);
  assert.ok(
    capture.cases.some((item) => item.productionRecall.results.length > 0)
  );

  const replay = await replayCapture({ capture, dataset, variantIds: ["M0"] });

  assert.equal(replay.equivalence, "passed");
  assert.deepEqual(replay.failedCaseIds, []);
  for (const item of replay.cases) {
    assert.deepEqual(
      item.equivalence.replayThreadIds,
      item.equivalence.productionThreadIds
    );
    assert.ok(Number.isFinite(item.equivalence.maxScoreDelta));
    assert.ok(item.equivalence.maxScoreDelta >= 0);
  }
  assert.equal(replay.scoreDelta.cases, replay.cases.length);
});

test("PRODUCTION_RECALL replays the captured production order for every case", async (t: TestContext) => {
  const capture = await captureFixture(t);
  const replay = await replayCapture({
    capture,
    dataset,
    variantIds: ["PRODUCTION_RECALL"]
  });

  for (const captured of capture.cases) {
    const replayed = replay.cases.find((item) => item.caseId === captured.id);
    const variant = replayed?.variants.find(
      (item) => item.variant === "PRODUCTION_RECALL"
    );
    assert.deepEqual(
      variant?.results.map((item) => item.threadId),
      captured.productionRecall.results
        .slice(0, captured.productionRecall.limit)
        .map((hit) => hit.threadId)
    );
  }
});

test("D0 admits every candidate, in the same order as M0", async (t: TestContext) => {
  const capture = await captureFixture(t);

  const replayed = await replayCase(
    caseInput(capture, "A1", dataset.cases[0].judgments, ["M0", "D0"])
  );

  const m0 = resultsOf(replayed, "M0");
  const d0 = resultsOf(replayed, "D0");
  assert.ok(d0.length > 0);
  assert.deepEqual(
    d0.map((item) => item.threadId),
    m0.map((item) => item.threadId)
  );
  assert.ok(d0.every((item) => item.admitted));
});

test("ORACLE_ADMISSION admits exactly the threads with grade 2 or higher", async (t: TestContext) => {
  const capture = await captureFixture(t);
  const judgments: Record<string, RelevanceGrade> = {
    [THREAD_TOKEN]: 2,
    [THREAD_SETTINGS]: 1
  };

  const replayed = await replayCase(
    caseInput(capture, "A1", judgments, ["D0", "ORACLE_ADMISSION"])
  );

  const d0 = resultsOf(replayed, "D0");
  const oracle = resultsOf(replayed, "ORACLE_ADMISSION");
  const expected = d0
    .filter((item) => (judgments[item.threadId] ?? 0) >= 2)
    .map((item) => item.threadId);
  assert.ok(expected.includes(THREAD_TOKEN));
  assert.deepEqual(
    oracle.filter((item) => item.admitted).map((item) => item.threadId),
    expected
  );
  assert.deepEqual(
    oracle.map((item) => item.threadId),
    d0.map((item) => item.threadId)
  );
});

test("M0 and D0 give the same output for different judgments and never read them", async (t: TestContext) => {
  const capture = await captureFixture(t);

  const withToken = await replayCase(
    caseInput(capture, "A1", { [THREAD_TOKEN]: 3 }, ["M0", "D0"])
  );
  const withSettings = await replayCase(
    caseInput(capture, "A1", { [THREAD_SETTINGS]: 2 }, ["M0", "D0"])
  );
  const unreadable = await replayCase(
    caseInput(capture, "A1", unreadableJudgments(), ["M0", "D0"])
  );

  assert.deepEqual(withSettings.variants, withToken.variants);
  assert.deepEqual(unreadable.variants, withToken.variants);
});

test("unknown ranking variants are refused before anything is replayed", async (t: TestContext) => {
  const capture = await captureFixture(t);

  await assert.rejects(
    replayCase(caseInput(capture, "A1", {}, ["M9"])),
    /Unknown ranking variant: M9/
  );
});
