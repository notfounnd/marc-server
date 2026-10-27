import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type {
  EvalDataset,
  RelevanceGrade
} from "../scripts/memory-eval/dataset.js";
import {
  buildWorksheet,
  pendingCellsOf
} from "../scripts/memory-eval/judgments.js";
import { replayCapture } from "../scripts/memory-eval/replay.js";
import {
  presentLayersOf,
  requiredLayersOf
} from "../scripts/memory-eval/required-cells.js";
import {
  dataset,
  FIXTURE_THREAD_IDS,
  THREAD_RULES
} from "./memory-eval-capture-fixtures.js";
import { e3WorksheetCapture } from "./memory-eval-worksheet-fixtures.js";

const REFERENCE = ["DEPTH0", "DEPTH1", "DEPTH2"];
type Built = Awaited<ReturnType<typeof buildWorksheet>>;

test("a sampled group asks its cells at depth 2, in the layers the capture holds for it", async (t: TestContext) => {
  const { capture } = await e3WorksheetCapture(t);
  const evalCase = dataset.cases.find((item) => item.id === "A1");
  assert.ok(evalCase !== undefined);
  const layers = presentLayersOf(capture.records)[THREAD_RULES] ?? [0];

  const notSampled = pendingCellsOf({
    evalCase,
    pool: [THREAD_RULES],
    runs: [],
    exhaustive: new Map(),
    audited: [],
    captureRecords: capture.records
  });
  const sampled = pendingCellsOf({
    evalCase,
    pool: [THREAD_RULES],
    runs: [],
    exhaustive: new Map(),
    audited: [THREAD_RULES],
    captureRecords: capture.records
  });

  assert.deepEqual(
    notSampled.cells.map((cell) => cell.layer),
    [0],
    "without the sample, a group with no reach asks its summary only"
  );
  assert.deepEqual(
    sampled.cells.map((cell) => cell.layer),
    requiredLayersOf(THREAD_RULES, 2, new Set(layers)),
    "a sampled group asks every layer of depth 2 that the capture holds"
  );
});

test("the worksheet holds no audit mark, and it counts the sampled pairs", async (t: TestContext) => {
  const { capture, vectors, threadsRoot } = await e3WorksheetCapture(t);
  const replay = await replayCapture({
    capture,
    dataset,
    variantIds: ["M0", "D0", ...REFERENCE],
    vectors
  });
  const source = { threadsRoot, threadIds: FIXTURE_THREAD_IDS };

  const audited = await buildWorksheet({
    capture,
    dataset,
    replay,
    source,
    variants: REFERENCE,
    vectors,
    audited: new Map([["A1", [THREAD_RULES]]])
  });

  assert.equal(audited.markdown.includes("audit"), false);
  assert.equal(audited.markdown.includes("auditoria"), false);
  assert.equal(audited.audit.pairs, 1);
});

test("a summary of grade 3 removes the layer rows of its group in the worksheet; a summary of grade 2 keeps them", async (t: TestContext) => {
  const { capture, vectors, threadsRoot } = await e3WorksheetCapture(t);
  const replay = await replayCapture({
    capture,
    dataset,
    variantIds: ["M0", "D0", ...REFERENCE],
    vectors
  });
  const source = { threadsRoot, threadIds: FIXTURE_THREAD_IDS };
  const before = await buildWorksheet({
    capture,
    dataset,
    replay,
    source,
    variants: REFERENCE,
    vectors
  });
  const layered = before.cases.flatMap((item) =>
    item.threads
      .filter((thread) => thread.layer > 0)
      .map((thread) => ({ caseId: item.caseId, threadId: thread.threadId }))
  )[0];
  assert.ok(layered !== undefined, "the fixture has a layered row");

  const withGrade = (grade: RelevanceGrade): EvalDataset => ({
    ...dataset,
    cases: dataset.cases.map((evalCase) =>
      evalCase.id === layered.caseId
        ? {
            ...evalCase,
            judgments: { ...evalCase.judgments, [layered.threadId]: grade }
          }
        : evalCase
    )
  });
  const saturated = await buildWorksheet({
    capture,
    dataset: withGrade(3),
    replay,
    source,
    variants: REFERENCE,
    vectors
  });
  const kept = await buildWorksheet({
    capture,
    dataset: withGrade(2),
    replay,
    source,
    variants: REFERENCE,
    vectors
  });

  assert.ok(rowsOf(before, layered.caseId, layered.threadId, 1).length > 0);
  assert.equal(
    rowsOf(saturated, layered.caseId, layered.threadId, 1).length,
    0
  );
  assert.equal(
    rowsOf(saturated, layered.caseId, layered.threadId, 2).length,
    0
  );
  assert.ok(rowsOf(kept, layered.caseId, layered.threadId, 1).length > 0);
  assert.ok(saturated.saturationRemoved > 0);
});

/** The rows of one group in one case, at a layer (any layer when none is given). */
function rowsOf(
  worksheet: Built,
  caseId: string,
  threadId: string,
  layer?: number
) {
  const threads =
    worksheet.cases.find((item) => item.caseId === caseId)?.threads ?? [];
  return threads.filter(
    (thread) =>
      thread.threadId === threadId &&
      (layer === undefined || thread.layer === layer)
  );
}
