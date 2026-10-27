import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import {
  asSearchRecord,
  type CaptureFile,
  type CapturedRecord
} from "../scripts/memory-eval/capture-types.js";
import {
  bestPassageOf,
  buildWorksheet
} from "../scripts/memory-eval/judgments.js";
import { rerankPairKey } from "../scripts/memory-eval/recording-providers.js";
import { replayCapture } from "../scripts/memory-eval/replay.js";
import { semanticRerankingDocument } from "../src/core/memory/semantic-ranking.js";
import { dataset, FIXTURE_THREAD_IDS } from "./memory-eval-capture-fixtures.js";
import { e3WorksheetCapture } from "./memory-eval-worksheet-fixtures.js";

/** A passage record of one group, with only the fields that the passage choice reads. */
function passageOf(recordId: string): CapturedRecord {
  return {
    recordId,
    kind: "passage",
    threadId: "T",
    layer: 0,
    title: "T",
    text: `text of ${recordId}`,
    sectionTitle: "Secao",
    sourcePath: "T/SUMMARY.md"
  } as unknown as CapturedRecord;
}

test("the highest score wins the group, whatever the order of the candidates", () => {
  const choice = bestPassageOf({
    candidates: [passageOf("p1"), passageOf("p2")],
    scores: new Map([
      ["p1", 0.2],
      ["p2", 0.9]
    ]),
    queryVector: [1, 0],
    vectors: new Map()
  });
  assert.equal(choice?.record.recordId, "p2");
  assert.equal(choice?.scored, true);
});

test("on a tie of scores the lower record id is chosen, whatever the order of the candidates", () => {
  const choice = bestPassageOf({
    candidates: [passageOf("p2"), passageOf("p1")],
    scores: new Map([
      ["p1", 0.5],
      ["p2", 0.5]
    ]),
    queryVector: [1, 0],
    vectors: new Map()
  });
  assert.equal(choice?.record.recordId, "p1");
  assert.equal(choice?.scored, true);
});

test("a candidate without a score never beats a scored one, and is not read as zero", () => {
  const choice = bestPassageOf({
    candidates: [passageOf("p1"), passageOf("p2")],
    scores: new Map([["p2", 0.1]]),
    queryVector: [1, 0],
    vectors: new Map([
      ["p1", [1, 0]],
      ["p2", [0, 1]]
    ])
  });
  assert.equal(choice?.record.recordId, "p2");
  assert.equal(choice?.scored, true);
});

test("without any score the candidate closest to the query is chosen, and marked unscored", () => {
  const choice = bestPassageOf({
    candidates: [passageOf("p1"), passageOf("p2")],
    scores: new Map(),
    queryVector: [0, 1],
    vectors: new Map([
      ["p1", [1, 0]],
      ["p2", [0.6, 0.8]]
    ])
  });
  assert.equal(choice?.record.recordId, "p2");
  assert.equal(choice?.scored, false);
});

test("a group without candidates has no passage", () => {
  const choice = bestPassageOf({
    candidates: [],
    scores: new Map(),
    queryVector: [1, 0],
    vectors: new Map()
  });
  assert.equal(choice, undefined);
});

test("the cosine choice refuses to run without the query vector", () => {
  assert.throws(
    () =>
      bestPassageOf({
        candidates: [passageOf("p1")],
        scores: new Map(),
        queryVector: undefined,
        vectors: new Map([["p1", [1, 0]]])
      }),
    /no query vector/
  );
});

test("a capture without any reranker score still builds the worksheet, with every row unscored", async (t: TestContext) => {
  const { capture, vectors, threadsRoot } = await e3WorksheetCapture(t);
  const replay = await replayCapture({
    capture,
    dataset,
    variantIds: ["M0", "D0"]
  });
  const unscored: CaptureFile = {
    ...capture,
    cases: capture.cases.map((item) => ({ ...item, rerankScores: {} }))
  };

  const worksheet = await buildWorksheet({
    capture: unscored,
    dataset,
    replay,
    source: { threadsRoot, threadIds: FIXTURE_THREAD_IDS },
    variants: [],
    vectors
  });

  assert.ok(worksheet.pending > 0);
  assert.equal(worksheet.unscored, worksheet.pending);
  assert.equal(
    worksheet.pendingByLayer[0] +
      worksheet.pendingByLayer[1] +
      worksheet.pendingByLayer[2],
    worksheet.pending
  );
  for (const item of worksheet.cases) {
    for (const thread of item.threads) {
      assert.ok(thread.snippet.length > 0, `${item.caseId} ${thread.threadId}`);
    }
  }
  assert.equal(
    worksheet.markdown.includes("cosseno"),
    false,
    "the worksheet does not show how a row was chosen"
  );
  assert.equal(
    worksheet.meta.filter((row) => row.choice === "cosine").length,
    worksheet.pending,
    "the internal metadata records every row as cosine-chosen"
  );
});

test("a passage without a reranker score in the capture does not stop the worksheet", async (t: TestContext) => {
  const { capture, vectors, threadsRoot } = await e3WorksheetCapture(t);
  const replay = await replayCapture({
    capture,
    dataset,
    variantIds: ["M0", "D0"]
  });
  const target = capture.records.find((record) => record.kind === "passage");
  assert.ok(target !== undefined);
  const query = capture.cases[0]?.interpretation.effectiveQuery ?? "";
  const key = rerankPairKey(
    query,
    semanticRerankingDocument(asSearchRecord(target))
  );
  const withoutTarget: CaptureFile = {
    ...capture,
    cases: capture.cases.map((item) => ({
      ...item,
      rerankScores: Object.fromEntries(
        Object.entries(item.rerankScores).filter(([pair]) => pair !== key)
      )
    }))
  };

  const worksheet = await buildWorksheet({
    capture: withoutTarget,
    dataset,
    replay,
    source: { threadsRoot, threadIds: FIXTURE_THREAD_IDS },
    variants: [],
    vectors
  });

  assert.ok(worksheet.pending > 0);
});
