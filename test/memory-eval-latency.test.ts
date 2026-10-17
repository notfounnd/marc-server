import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";
import {
  measureCaptureLatency,
  readLatencyFile
} from "../scripts/memory-eval/latency.js";
import { buildReport, REPORT_VARIANTS } from "../scripts/memory-eval/report.js";
import { replayCapture } from "../scripts/memory-eval/replay.js";
import {
  createFakes,
  dataset,
  FIXTURE_THREAD_IDS,
  fixtureThreadsRoot,
  measureFixtureLatency,
  readCaptureFile,
  REPOSITORY_ROOT,
  runCapture,
  tempDirectory
} from "./memory-eval-capture-fixtures.js";
import { judgedDataset } from "./memory-eval-judged-fixtures.js";

test("capture.json carries no latency, and a resumed legacy case loses its latencyMs", async (t: TestContext) => {
  const threadsRoot = await fixtureThreadsRoot(t);
  const outputRoot = await tempDirectory(t);
  const first = await runCapture({
    threadsRoot,
    outputRoot,
    fakes: createFakes()
  });
  const firstCapture = await readCaptureFile(first.result.captureDir);
  assert.equal(JSON.stringify(firstCapture).includes("latencyMs"), false);

  const casesDirectory = path.join(first.result.captureDir, "cases");
  for (const name of await fs.readdir(casesDirectory)) {
    const file = path.join(casesDirectory, name);
    const legacy = JSON.parse(await fs.readFile(file, "utf8")) as Record<
      string,
      unknown
    >;
    await fs.writeFile(
      file,
      JSON.stringify({
        ...legacy,
        latencyMs: { warmup: 1, samples: [1, 2, 3] }
      })
    );
  }
  const resumed = await runCapture({
    threadsRoot,
    outputRoot,
    fakes: createFakes(),
    resume: true
  });
  assert.equal(resumed.result.skippedCases, dataset.cases.length);
  const capture = await readCaptureFile(resumed.result.captureDir);
  assert.equal(JSON.stringify(capture).includes("latencyMs"), false);
  assert.equal(capture.cases.length, dataset.cases.length);
});

test("latency writes one warm-up and three samples per case, with the memory fields", async (t: TestContext) => {
  const threadsRoot = await fixtureThreadsRoot(t);
  const outputRoot = await tempDirectory(t);
  const fakes = createFakes();
  const { result } = await runCapture({ threadsRoot, outputRoot, fakes });
  const latency = await measureFixtureLatency({
    threadsRoot,
    outputRoot,
    fakes
  });

  assert.equal(latency.schemaVersion, 1);
  assert.equal(latency.captureId, result.captureId);
  assert.equal(latency.cases.length, dataset.cases.length);
  for (const item of latency.cases) {
    assert.equal(item.samples.length, 3);
    assert.equal(typeof item.warmup, "number");
    assert.ok(item.freeMemAfterBytes > 0);
  }
  assert.ok(latency.freeMemStartBytes > 0);
  assert.ok(latency.totalMemBytes >= latency.freeMemStartBytes);
  assert.deepEqual(
    await readLatencyFile(result.captureDir, result.captureId),
    latency
  );
  const capture = await readCaptureFile(result.captureDir);
  assert.equal(JSON.stringify(capture).includes("latencyMs"), false);
});

test("latency fails clearly when there is no complete capture.json", async (t: TestContext) => {
  await assert.rejects(
    measureCaptureLatency({
      dataset,
      source: {
        threadsRoot: await fixtureThreadsRoot(t),
        threadIds: FIXTURE_THREAD_IDS
      },
      outputRoot: await tempDirectory(t),
      repositoryRoot: REPOSITORY_ROOT,
      createProviders: () => createFakes().providers,
      log: () => undefined
    }),
    /capture\.json is missing/
  );
});

test("report refuses a missing or foreign latency.json and reads median and p95 from it", async (t: TestContext) => {
  const threadsRoot = await fixtureThreadsRoot(t);
  const outputRoot = await tempDirectory(t);
  const fakes = createFakes();
  const { result } = await runCapture({ threadsRoot, outputRoot, fakes });
  const latency = await measureFixtureLatency({
    threadsRoot,
    outputRoot,
    fakes
  });

  await assert.rejects(
    readLatencyFile(await tempDirectory(t), result.captureId),
    /No latency\.json/
  );
  await assert.rejects(
    readLatencyFile(result.captureDir, "000000000000"),
    /belongs to captureId/
  );

  const capture = await readCaptureFile(result.captureDir);
  const replay = await replayCapture({
    capture,
    dataset: judgedDataset,
    variantIds: [...REPORT_VARIANTS]
  });
  const report = await buildReport({
    capture,
    dataset: judgedDataset,
    replay,
    latency
  });
  const sorted = latency.cases
    .flatMap((item) => item.samples)
    .sort((left, right) => left - right);
  assert.equal(report.latency.samples, 9);
  assert.equal(report.latency.medianMs, sorted[4]);
  assert.equal(report.latency.p95Ms, sorted[8]);
  assert.equal(
    report.latency.minFreeMemoryBytes,
    Math.min(
      latency.freeMemStartBytes,
      ...latency.cases.map((item) => item.freeMemAfterBytes)
    )
  );
});
