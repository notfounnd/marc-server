import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";
import type { CaptureOptions } from "../scripts/memory-eval/capture.js";
import { captureMemoryEval } from "../scripts/memory-eval/capture.js";
import { countCapture } from "../scripts/memory-eval/capture-count.js";
import {
  complementCapture,
  pendingOf
} from "../scripts/memory-eval/capture-complement.js";
import {
  writeCaptureFile,
  writeCapturedCase
} from "../scripts/memory-eval/capture-storage.js";
import {
  asSearchRecord,
  type CaptureFile,
  type CapturedCase
} from "../scripts/memory-eval/capture-types.js";
import type { EvalDataset } from "../scripts/memory-eval/dataset.js";
import { rerankPairKey } from "../scripts/memory-eval/recording-providers.js";
import { semanticRerankingDocument } from "../src/core/memory/semantic-ranking.js";
import type { RerankingProvider } from "../src/core/memory/types.js";
import {
  createFakes,
  dataset,
  FIXTURE_THREAD_IDS,
  fixtureThreadsRoot,
  readCaptureFile,
  REPOSITORY_ROOT,
  runCapture,
  tempDirectory,
  THREAD_SETTINGS,
  type FakeSet
} from "./memory-eval-capture-fixtures.js";

const JUDGED: EvalDataset = {
  ...dataset,
  cases: dataset.cases.map((evalCase) => ({
    ...evalCase,
    layerJudgments: { 1: { "@rules": 2 }, 2: { [THREAD_SETTINGS]: 3 } }
  }))
};

function optionsOf(input: {
  threadsRoot: string;
  outputRoot: string;
  fakes: FakeSet;
  countLimitHours?: number;
}): CaptureOptions {
  return {
    dataset,
    source: { threadsRoot: input.threadsRoot, threadIds: FIXTURE_THREAD_IDS },
    outputRoot: input.outputRoot,
    repositoryRoot: REPOSITORY_ROOT,
    createProviders: () => input.fakes.providers,
    resume: false,
    log: () => undefined,
    syntheticQueries: false,
    countLimitHours: input.countLimitHours
  };
}

/** A reranker that counts the documents it is asked to score, and scores them as the fake does. */
function countingReranker(fakes: FakeSet): {
  provider: RerankingProvider;
  documents: () => number;
} {
  let scored = 0;
  const provider = Object.assign(
    Object.create(fakes.reranker) as RerankingProvider,
    {
      rerank: async (query: string, documents: string[], batchSize: number) => {
        scored += documents.length;
        return fakes.reranker.rerank(query, documents, batchSize);
      }
    }
  );
  return { provider, documents: () => scored };
}

function withoutKey(
  values: Readonly<Record<string, number>>,
  key: string
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(values).filter(([name]) => name !== key)
  );
}

function caseNamed(capture: CaptureFile, id: string): CapturedCase {
  const found = capture.cases.find((item) => item.id === id);
  assert.ok(found !== undefined, `the capture has no case ${id}`);
  return found;
}

/**
 * Makes the capture hold one unscored pair, as a capture made before that judgment would: the passage of
 * THREAD_SETTINGS in case A2 loses its record score and its text score. The complement must add it back.
 * The files are written with the production writers. Returns the record id and the pair text key.
 */
async function withUnscoredPair(
  captureDir: string
): Promise<{ recordId: string; key: string }> {
  const capture = await readCaptureFile(captureDir);
  const target = caseNamed(capture, "A2");
  const record = capture.records.find(
    (item) => item.threadId === THREAD_SETTINGS && item.kind === "passage"
  );
  assert.ok(
    record !== undefined,
    "the capture has a passage of THREAD_SETTINGS"
  );
  const key = rerankPairKey(
    target.interpretation.effectiveQuery,
    semanticRerankingDocument(asSearchRecord(record))
  );
  target.recordScores = withoutKey(target.recordScores ?? {}, record.recordId);
  target.rerankScores = withoutKey(target.rerankScores, key);
  await writeCapturedCase(captureDir, target);
  await writeCaptureFile(captureDir, capture);
  return { recordId: record.recordId, key };
}

test("a repeated pair text is scored once, and a key that exists keeps its score", () => {
  const pending = pendingOf(
    ["q|a", "q|a", "q|b", "q|c"],
    ["a", "a", "b", "c"],
    { "q|c": 0.5 }
  );
  assert.deepEqual(pending, [
    { key: "q|a", document: "a" },
    { key: "q|b", document: "b" }
  ]);
});

test("a complement scores the absent cell; a resume keeps it by record id and by text; a second round scores nothing", async (t: TestContext) => {
  const fakes = createFakes();
  const outputRoot = await tempDirectory(t);
  const threadsRoot = await fixtureThreadsRoot(t);
  const { result } = await runCapture({
    threadsRoot,
    outputRoot,
    fakes,
    syntheticQueries: false
  });
  const pair = await withUnscoredPair(result.captureDir);
  const absent = await readCaptureFile(result.captureDir);
  assert.equal(
    caseNamed(absent, "A2").recordScores?.[pair.recordId],
    undefined
  );

  const first = countingReranker(fakes);
  const summary = await complementCapture({
    captureDir: result.captureDir,
    judged: JUDGED,
    reranker: first.provider
  });
  assert.equal(summary.round, 1);
  assert.ok(summary.perCase.reduce((sum, item) => sum + item.pairs, 0) > 0);
  assert.ok(first.documents() > 0);

  const after = await readCaptureFile(result.captureDir);
  assert.equal(after.complementRounds?.length, absent.cases.length);
  const complemented = caseNamed(after, "A2");
  const value = complemented.recordScores?.[pair.recordId];
  assert.equal(typeof value, "number");
  assert.equal(complemented.rerankScores[pair.key], value);
  const caseFile = JSON.parse(
    await fs.readFile(
      path.join(result.captureDir, "cases", `${after.cases[0].id}.json`),
      "utf8"
    )
  );
  assert.deepEqual(caseFile, after.cases[0]);

  const resumed = await runCapture({
    threadsRoot,
    outputRoot,
    fakes: createFakes(),
    resume: true,
    syntheticQueries: false
  });
  assert.equal(resumed.result.executedCases, 0);
  const restored = await readCaptureFile(resumed.result.captureDir);
  assert.deepEqual(restored.cases, after.cases);
  assert.deepEqual(restored.complementRounds, after.complementRounds);
  assert.equal(caseNamed(restored, "A2").recordScores?.[pair.recordId], value);
  assert.equal(caseNamed(restored, "A2").rerankScores[pair.key], value);

  const second = countingReranker(fakes);
  const again = await complementCapture({
    captureDir: result.captureDir,
    judged: JUDGED,
    reranker: second.provider
  });
  assert.equal(again.round, 2);
  assert.equal(again.addedPairs, 0);
  assert.equal(second.documents(), 0);
  const log = await readCaptureFile(result.captureDir);
  assert.equal(log.complementRounds?.length, 2 * dataset.cases.length);
});

test("a second complement with the same judgments scores nothing and keeps the log append-only", async (t: TestContext) => {
  const fakes = createFakes();
  const { result } = await runCapture({
    threadsRoot: await fixtureThreadsRoot(t),
    outputRoot: await tempDirectory(t),
    fakes,
    syntheticQueries: false
  });
  await withUnscoredPair(result.captureDir);
  const first = countingReranker(fakes);
  await complementCapture({
    captureDir: result.captureDir,
    judged: JUDGED,
    reranker: first.provider
  });
  const afterFirst = first.documents();
  assert.ok(afterFirst > 0);
  const second = countingReranker(fakes);
  const again = await complementCapture({
    captureDir: result.captureDir,
    judged: JUDGED,
    reranker: second.provider
  });
  assert.equal(again.addedPairs, 0);
  assert.equal(second.documents(), 0);
  assert.equal(afterFirst, first.documents());
  const capture = await readCaptureFile(result.captureDir);
  assert.equal(capture.complementRounds?.length, 2 * dataset.cases.length);
});

test("the gate counts the production recall with the matrix: a limit between the two refuses before any pair is scored", async (t: TestContext) => {
  const outputRoot = await tempDirectory(t);
  const threadsRoot = await fixtureThreadsRoot(t);
  const fakes = createFakes();
  const options = optionsOf({ threadsRoot, outputRoot, fakes });
  const counted = await countCapture(options);
  const matrixHours = counted.totalPairs / counted.pairsPerSecond / 3600;
  const totalHours = counted.hoursWithProductionRecall;
  assert.ok(counted.totalProductionRecallPairs > 0);
  const limit = (matrixHours + totalHours) / 2;
  assert.ok(matrixHours < limit && limit < totalHours);

  await assert.rejects(
    captureMemoryEval({ ...options, countLimitHours: limit }),
    /above the .* h limit\. Nothing was scored\./
  );
  assert.equal(fakes.reranker.rerankCalls, 0);
  const refused = await countCapture({ ...options, countLimitHours: limit });
  assert.equal(refused.refused, true);
  const allowed = await countCapture({
    ...options,
    countLimitHours: totalHours + 1
  });
  assert.equal(allowed.refused, false);
});
