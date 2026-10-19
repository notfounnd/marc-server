import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { MEMORY_SCHEMA_VERSION } from "../src/core/memory/types.js";
import type { CaptureFile } from "../scripts/memory-eval/capture-types.js";
import {
  createFakes,
  FIXTURE_THREAD_IDS,
  fixtureThreadsRoot,
  readCaptureFile,
  runCapture,
  tempDirectory
} from "./memory-eval-capture-fixtures.js";

// The production manifest on disk is still schema 6, so it selects thread-ids.
const PRODUCTION_LEGACY_SCHEMA_VERSION = 6;

test("a production manifest of the code schema is checked by record ids and recorded", async (t) => {
  const { threadsRoot, capture } = await firstCapture(t);
  const productionPath = await productionFile(
    t,
    MEMORY_SCHEMA_VERSION,
    recordIdsByThread(capture)
  );

  const accepted = await runCapture({
    threadsRoot,
    outputRoot: await tempDirectory(t),
    fakes: createFakes(),
    productionManifestPath: productionPath
  });

  const acceptedCapture = await readCaptureFile(accepted.result.captureDir);
  assert.deepEqual(acceptedCapture.productionCheck, {
    mode: "record-ids",
    productionSchemaVersion: MEMORY_SCHEMA_VERSION,
    codeSchemaVersion: MEMORY_SCHEMA_VERSION
  });
});

test("the record-ids check rejects a code-schema production manifest with no record ids", async (t) => {
  const { threadsRoot } = await firstCapture(t);
  const productionPath = await productionFile(
    t,
    MEMORY_SCHEMA_VERSION,
    FIXTURE_THREAD_IDS.map((threadId) => ({ threadId, recordIds: [] }))
  );

  await assert.rejects(
    runCapture({
      threadsRoot,
      outputRoot: await tempDirectory(t),
      fakes: createFakes(),
      productionManifestPath: productionPath
    }),
    /diverges from production \(record-ids\)/
  );
});

test("a legacy production manifest is checked by pinned thread ids and recorded", async (t) => {
  const { threadsRoot } = await firstCapture(t);
  const productionPath = await productionFile(
    t,
    PRODUCTION_LEGACY_SCHEMA_VERSION,
    FIXTURE_THREAD_IDS.map((threadId) => ({ threadId, recordIds: [] }))
  );

  const accepted = await runCapture({
    threadsRoot,
    outputRoot: await tempDirectory(t),
    fakes: createFakes(),
    productionManifestPath: productionPath
  });

  const acceptedCapture = await readCaptureFile(accepted.result.captureDir);
  assert.deepEqual(acceptedCapture.productionCheck, {
    mode: "thread-ids",
    productionSchemaVersion: PRODUCTION_LEGACY_SCHEMA_VERSION,
    codeSchemaVersion: MEMORY_SCHEMA_VERSION
  });
});

test("the thread-ids check names its mode when a pinned thread is absent from production", async (t) => {
  const { threadsRoot } = await firstCapture(t);
  const productionPath = await productionFile(
    t,
    PRODUCTION_LEGACY_SCHEMA_VERSION,
    [{ threadId: "thread-x", recordIds: ["thread-x:identity"] }]
  );

  await assert.rejects(
    runCapture({
      threadsRoot,
      outputRoot: await tempDirectory(t),
      fakes: createFakes(),
      productionManifestPath: productionPath
    }),
    /diverges from production \(thread-ids\)/
  );
});

test("a capture without a production manifest records no production check", async (t) => {
  const { capture } = await firstCapture(t);

  assert.equal(capture.productionCheck, undefined);
});

async function firstCapture(
  t: TestContext
): Promise<{ threadsRoot: string; capture: CaptureFile }> {
  const threadsRoot = await fixtureThreadsRoot(t);
  const { result } = await runCapture({
    threadsRoot,
    outputRoot: await tempDirectory(t),
    fakes: createFakes()
  });
  return { threadsRoot, capture: await readCaptureFile(result.captureDir) };
}

function recordIdsByThread(
  capture: CaptureFile
): Array<{ threadId: string; recordIds: string[] }> {
  const byThread = new Map<string, string[]>();
  for (const record of capture.records) {
    byThread.set(record.threadId, [
      ...(byThread.get(record.threadId) ?? []),
      record.recordId
    ]);
  }
  return [...byThread].map(([threadId, recordIds]) => ({
    threadId,
    recordIds
  }));
}

async function productionFile(
  t: TestContext,
  schemaVersion: number,
  records: Array<{ threadId: string; recordIds: string[] }>
): Promise<string> {
  const file = path.join(await tempDirectory(t), "manifest.json");
  await fs.writeFile(file, JSON.stringify({ schemaVersion, records }));
  return file;
}
