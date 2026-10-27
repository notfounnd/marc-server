import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";
import {
  asSearchRecord,
  type CaptureFile,
  type CapturedCase,
  type CapturedRecord
} from "../scripts/memory-eval/capture-types.js";
import {
  complementCapture,
  complementCountOf,
  type ComplementTargets
} from "../scripts/memory-eval/capture-complement.js";
import { VECTORS_FILE } from "../scripts/memory-eval/capture-vectors.js";
import {
  complementedKeysOf,
  scoredRecordsOf
} from "../scripts/memory-eval/judgments.js";
import { rerankPairKey } from "../scripts/memory-eval/recording-providers.js";
import { semanticRerankingDocument } from "../src/core/memory/semantic-ranking.js";
import {
  createFakes,
  tempDirectory,
  THREAD_TOKEN
} from "./memory-eval-capture-fixtures.js";
import { e3WorksheetCapture } from "./memory-eval-worksheet-fixtures.js";

const CASE = "A1";

test("the complement adds the pairs of a group, and leaves the universe, the scores, the channels and the vectors as they were", async (t: TestContext) => {
  const { capture, captureDir } = await e3WorksheetCapture(t);
  const dir = await tempDirectory(t);
  await fs.cp(captureDir, dir, { recursive: true });
  const file = path.join(dir, "capture.json");
  // The token group is out of the matrix of the case: its records and their pairs have no score yet.
  const prepared = outOfScope(capture);
  await fs.writeFile(file, `${JSON.stringify(prepared)}\n`);
  const targets: ComplementTargets = new Map(
    prepared.cases.map(
      (item) =>
        [item.id, new Set(item.id === CASE ? [THREAD_TOKEN] : [])] as const
    )
  );

  const beforeCount = await fs.readFile(file, "utf8");
  const count = await complementCountOf({ captureDir: dir, targets });
  assert.ok(count.addedRecords > 0, "the count finds records to add");
  assert.ok(count.scoredPairs > 0, "the count finds pairs to score");
  assert.equal(
    await fs.readFile(file, "utf8"),
    beforeCount,
    "the count writes nothing"
  );

  const vectorsBefore = await fs.readFile(path.join(dir, VECTORS_FILE));
  const summary = await complementCapture({
    captureDir: dir,
    targets,
    reranker: createFakes().reranker
  });
  const after = JSON.parse(await fs.readFile(file, "utf8")) as CaptureFile;
  const preCase = caseOf(prepared, CASE);
  const postCase = caseOf(after, CASE);

  assert.ok(summary.addedPairs > 0);
  const rounds = (after.complementRounds ?? []).filter(
    (item) => item.caseId === CASE
  );
  assert.equal(
    rounds.length,
    1,
    "the round is recorded in the manifest of the capture"
  );
  assert.ok(
    (rounds[0]?.addedKeys?.length ?? 0) > 0,
    "the round records the keys it scored"
  );
  for (const [key, score] of Object.entries(preCase.rerankScores)) {
    assert.equal(
      postCase.rerankScores[key],
      score,
      `an existing score stays: ${key}`
    );
  }
  assert.deepEqual(
    after.cases.map((item) => item.channelsByDepth),
    prepared.cases.map((item) => item.channelsByDepth),
    "the channels stay"
  );
  assert.deepEqual(
    await fs.readFile(path.join(dir, VECTORS_FILE)),
    vectorsBefore,
    "the vectors stay"
  );
  assert.deepEqual(after.records, prepared.records, "the records stay");

  const pre = scoredRecordsOf(preCase, recordsOf(prepared));
  const post = scoredRecordsOf(
    postCase,
    recordsOf(after),
    complementedKeysOf(after, CASE)
  );
  assert.deepEqual(
    [...post].sort(),
    [...pre].sort(),
    "the universe reads the same scores as before the complement"
  );
  assert.ok(
    scoredRecordsOf(postCase, recordsOf(after)).size > pre.size,
    "the complement scores more records for the rows"
  );
});

/** The capture with the token group out of the matrix of the case: its records and their pairs lose the score. */
function outOfScope(capture: CaptureFile): CaptureFile {
  return {
    ...capture,
    cases: capture.cases.map((item) =>
      item.id === CASE ? withoutGroup(capture, item) : item
    )
  };
}

function withoutGroup(
  capture: CaptureFile,
  captured: CapturedCase
): CapturedCase {
  const records = capture.records.filter(
    (record) =>
      record.threadId === THREAD_TOKEN &&
      (record.kind === "identity" || record.kind === "passage")
  );
  const keys = new Set(
    records.map((record) =>
      rerankPairKey(
        captured.interpretation.effectiveQuery,
        semanticRerankingDocument(asSearchRecord(record))
      )
    )
  );
  const recordIds = new Set(records.map((record) => record.recordId));
  return {
    ...captured,
    rerankScores: Object.fromEntries(
      Object.entries(captured.rerankScores).filter(([key]) => !keys.has(key))
    ),
    recordScores: Object.fromEntries(
      Object.entries(captured.recordScores ?? {}).filter(
        ([recordId]) => !recordIds.has(recordId)
      )
    )
  };
}

function caseOf(capture: CaptureFile, caseId: string): CapturedCase {
  const found = capture.cases.find((item) => item.id === caseId);
  assert.ok(found !== undefined, `the capture has case ${caseId}`);
  return found;
}

function recordsOf(capture: CaptureFile): Map<string, CapturedRecord> {
  return new Map(
    capture.records.map((record) => [record.recordId, record] as const)
  );
}
