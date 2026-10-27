import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { computeCaptureFingerprint } from "../scripts/memory-eval/capture.js";
import {
  E3_CAPTURE_CHANNELS,
  E3_INDEXED_LAYERS,
  E3_RERANK_ORDER
} from "../scripts/memory-eval/capture-layers.js";
import { corpusContentDigest } from "../scripts/memory-eval/corpus.js";
import {
  createFakes,
  dataset,
  FIXTURE_THREAD_IDS,
  fixtureThreadsRoot,
  readCaptureFile,
  REPOSITORY_ROOT,
  runCapture,
  tempDirectory
} from "./memory-eval-capture-fixtures.js";

test("captures the three layers of every case: channels per depth, the scored matrix and the vectors", async (t) => {
  const fakes = createFakes();
  const { result } = await runCapture({
    threadsRoot: await fixtureThreadsRoot(t),
    outputRoot: await tempDirectory(t),
    fakes,
    syntheticQueries: false
  });

  assert.equal(result.cases, 3);
  assert.equal(result.executedCases, 3);
  assert.equal(result.skippedCases, 0);
  assert.equal(path.basename(result.captureDir), result.captureId);

  const capture = await readCaptureFile(result.captureDir);
  assert.equal(capture.captureId, result.captureId);
  assert.deepEqual(capture.fingerprint.indexedLayers, E3_INDEXED_LAYERS);
  assert.equal(capture.fingerprint.captureChannels, E3_CAPTURE_CHANNELS);
  assert.equal(capture.fingerprint.rerankOrder, E3_RERANK_ORDER);
  assert.equal(capture.cases.length, 3);
  assert.equal(capture.syntheticQueries, undefined);
  assert.equal(capture.vectors?.recordIds.length, capture.records.length);
  assert.equal(capture.vectors?.dimension, 3);

  for (const captured of capture.cases) {
    assert.deepEqual(Object.keys(captured.channelsByDepth ?? {}).sort(), [
      "0",
      "1",
      "2"
    ]);
    assert.deepEqual(Object.keys(captured.channels), [
      captured.interpretation.effectiveQuery
    ]);
    assert.equal("latencyMs" in captured, false);
    assert.ok(Object.keys(captured.recordScores ?? {}).length > 0);
    assert.deepEqual(captured.evidence, []);
    assert.equal(captured.incomplete, undefined);
  }

  const direct = capture.cases[0];
  assert.ok(
    direct.channels[direct.interpretation.effectiveQuery].lexical.length > 0
  );

  const corrected = capture.cases[1];
  assert.deepEqual(Object.keys(corrected.channels), ["settings em JSON"]);
  assert.equal(corrected.interpretation.effectiveQuery, "settings em JSON");
  assert.equal(corrected.interpretation.correctionApplied, true);
  assert.deepEqual([...new Set(fakes.interpreter.calls)], ["settngs em JSON"]);
});

test("resume skips concluded cases and runs only the ones missing from the checkpoint", async (t) => {
  const threadsRoot = await fixtureThreadsRoot(t);
  const outputRoot = await tempDirectory(t);
  const first = await runCapture({
    threadsRoot,
    outputRoot,
    fakes: createFakes(),
    syntheticQueries: false
  });
  const checkpointPath = path.join(first.result.captureDir, "checkpoint.json");
  const checkpoint = JSON.parse(await fs.readFile(checkpointPath, "utf8")) as {
    completedCaseIds: string[];
  };
  const withoutLast = {
    ...checkpoint,
    completedCaseIds: checkpoint.completedCaseIds.slice(0, -1)
  };
  await fs.writeFile(checkpointPath, JSON.stringify(withoutLast));

  const resumed = await runCapture({
    threadsRoot,
    outputRoot,
    fakes: createFakes(),
    resume: true,
    syntheticQueries: false
  });

  assert.equal(resumed.result.captureId, first.result.captureId);
  assert.equal(resumed.result.executedCases, 1);
  assert.equal(resumed.result.skippedCases, 2);
  assert.equal(
    resumed.logs.filter((line) => line.endsWith("resumed")).length,
    2
  );

  // The plan of every case runs again, because the count gate needs the whole matrix before any pair
  // is scored. Only the case missing from the checkpoint is scored; the concluded cases are read back.
  const before = await readCaptureFile(first.result.captureDir);
  const after = await readCaptureFile(resumed.result.captureDir);
  assert.deepEqual(after.cases[0], before.cases[0]);
  assert.deepEqual(after.cases[1], before.cases[1]);
  assert.deepEqual(after.vectors, before.vectors);
});

test("refuses to reuse an existing capture directory without resume", async (t) => {
  const outputRoot = await tempDirectory(t);
  const digest = await corpusContentDigest({
    threadsRoot: await fixtureThreadsRoot(t),
    threadIds: FIXTURE_THREAD_IDS
  });
  const fingerprint = await computeCaptureFingerprint(
    dataset,
    REPOSITORY_ROOT,
    digest,
    E3_INDEXED_LAYERS,
    E3_CAPTURE_CHANNELS,
    E3_RERANK_ORDER
  );
  await fs.mkdir(path.join(outputRoot, dataset.corpus, fingerprint.captureId), {
    recursive: true
  });

  await assert.rejects(
    runCapture({
      threadsRoot: await fixtureThreadsRoot(t),
      outputRoot,
      fakes: createFakes(),
      syntheticQueries: false
    }),
    /already exists/
  );
});

test("compares temporary record ids with the production manifest, read-only", async (t) => {
  const threadsRoot = await fixtureThreadsRoot(t);
  const first = await runCapture({
    threadsRoot,
    outputRoot: await tempDirectory(t),
    fakes: createFakes(),
    syntheticQueries: false
  });
  const capture = await readCaptureFile(first.result.captureDir);
  const recordIdsByThread = new Map<string, string[]>();
  for (const record of capture.records) {
    if (record.layer !== 0) continue;
    const current = recordIdsByThread.get(record.threadId) ?? [];
    recordIdsByThread.set(record.threadId, [...current, record.recordId]);
  }
  const records = [...recordIdsByThread].map(([threadId, recordIds]) => ({
    threadId,
    recordIds
  }));
  const manifestDirectory = await tempDirectory(t);
  const matchingPath = path.join(manifestDirectory, "matching.json");
  await fs.writeFile(
    matchingPath,
    JSON.stringify({ schemaVersion: 6, records })
  );
  const divergingPath = path.join(manifestDirectory, "diverging.json");
  await fs.writeFile(
    divergingPath,
    JSON.stringify({
      schemaVersion: 6,
      records: [{ threadId: "thread-x", recordIds: ["thread-x:identity"] }]
    })
  );

  const accepted = await runCapture({
    threadsRoot,
    outputRoot: await tempDirectory(t),
    fakes: createFakes(),
    productionManifestPath: matchingPath,
    syntheticQueries: false
  });
  assert.equal(accepted.result.executedCases, 3);
  const acceptedCapture = await readCaptureFile(accepted.result.captureDir);
  assert.equal(acceptedCapture.productionCheck?.mode, "thread-ids");
  await assert.rejects(
    runCapture({
      threadsRoot,
      outputRoot: await tempDirectory(t),
      fakes: createFakes(),
      productionManifestPath: divergingPath,
      syntheticQueries: false
    }),
    /diverges from production/
  );
});

test("resume refuses a checkpoint written over different corpus content", async (t) => {
  const threadsRoot = await fixtureThreadsRoot(t);
  const outputRoot = await tempDirectory(t);
  const first = await runCapture({
    threadsRoot,
    outputRoot,
    fakes: createFakes(),
    syntheticQueries: false
  });
  const checkpointPath = path.join(first.result.captureDir, "checkpoint.json");
  const checkpoint = JSON.parse(await fs.readFile(checkpointPath, "utf8")) as {
    corpusDigest: string;
  };
  await fs.writeFile(
    checkpointPath,
    JSON.stringify({ ...checkpoint, corpusDigest: "stale-digest" })
  );

  await assert.rejects(
    runCapture({
      threadsRoot,
      outputRoot,
      fakes: createFakes(),
      resume: true,
      syntheticQueries: false
    }),
    /corpus changed since the checkpoint/
  );
});
