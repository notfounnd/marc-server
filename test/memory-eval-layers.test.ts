import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { computeCaptureFingerprint } from "../scripts/memory-eval/capture.js";
import {
  countRowsByLayer,
  layersFileName,
  measureAllLayers,
  type LayersFile
} from "../scripts/memory-eval/layers.js";
import {
  createFakes,
  dataset,
  FIXTURE_THREAD_IDS,
  fixtureThreadsRoot,
  REPOSITORY_ROOT,
  tempDirectory
} from "./memory-eval-capture-fixtures.js";

test("indexed layers join the fingerprint only when they differ from the default", async () => {
  const base = await computeCaptureFingerprint(
    dataset,
    REPOSITORY_ROOT,
    "digest"
  );
  const explicitDefault = await computeCaptureFingerprint(
    dataset,
    REPOSITORY_ROOT,
    "digest",
    [0]
  );
  const everyLayer = await computeCaptureFingerprint(
    dataset,
    REPOSITORY_ROOT,
    "digest",
    [0, 1, 2]
  );

  assert.equal(explicitDefault.captureId, base.captureId);
  assert.equal("indexedLayers" in base, false);
  assert.equal("indexedLayers" in explicitDefault, false);
  assert.notEqual(everyLayer.captureId, base.captureId);
  assert.deepEqual(everyLayer.indexedLayers, [0, 1, 2]);
});

test("row counts are kept per layer and per source type", () => {
  assert.deepEqual(
    countRowsByLayer([
      { layer: 0, sourceType: "summary" },
      { layer: 1, sourceType: "artifact" },
      { layer: 1, sourceType: "rules" },
      { layer: 2, sourceType: "chat" },
      { layer: 2, sourceType: "chat" }
    ]),
    {
      records: 5,
      byLayer: { "0": 1, "1": 2, "2": 2 },
      bySourceType: { summary: 1, artifact: 1, rules: 1, chat: 2 }
    }
  );
});

test("measure-all-layers runs the default and every layer and writes one file", async (t: TestContext) => {
  const threadsRoot = await fixtureThreadsRoot(t);
  await addLayerSources(threadsRoot);
  const rulesPath = await writeRules(t);
  const outputRoot = await tempDirectory(t);

  const result = await measureAllLayers({
    dataset,
    source: { threadsRoot, threadIds: FIXTURE_THREAD_IDS, rulesPath },
    outputRoot,
    repositoryRoot: REPOSITORY_ROOT,
    createProviders: () => createFakes().providers,
    log: () => undefined
  });

  const [defaults, all] = result.runs;
  assert.deepEqual(defaults?.indexedLayers, [0]);
  assert.deepEqual(all?.indexedLayers, [0, 1, 2]);
  assert.deepEqual(Object.keys(defaults?.byLayer ?? {}), ["0"]);
  assert.equal(all?.byLayer["0"], defaults?.byLayer["0"]);
  assert.equal(all?.byLayer["1"], 2);
  assert.equal(all?.byLayer["2"], 1);
  assert.equal(all?.bySourceType.artifact, 1);
  assert.equal(all?.bySourceType.rules, 1);
  assert.equal(all?.bySourceType.chat, 1);
  assert.equal(all?.records, (defaults?.records ?? 0) + 3);
  assert.ok((all?.rebuildMs ?? 0) > 0);
});

test("the layers file is named by the all-layers captureId and no capture folder is created", async (t: TestContext) => {
  const threadsRoot = await fixtureThreadsRoot(t);
  const outputRoot = await tempDirectory(t);

  const result = await measureAllLayers({
    dataset,
    source: { threadsRoot, threadIds: FIXTURE_THREAD_IDS },
    outputRoot,
    repositoryRoot: REPOSITORY_ROOT,
    createProviders: () => createFakes().providers,
    log: () => undefined
  });

  const corpusDirectory = path.join(outputRoot, dataset.corpus);
  const file = JSON.parse(
    await fs.readFile(result.layersPath, "utf8")
  ) as LayersFile;
  assert.equal(
    path.basename(result.layersPath),
    layersFileName(result.captureId)
  );
  assert.equal(file.captureId, result.captureId);
  assert.deepEqual(file.fingerprint.indexedLayers, [0, 1, 2]);
  assert.deepEqual(await fs.readdir(corpusDirectory), [
    layersFileName(result.captureId)
  ]);
});

// One artifact and one chat message in the first fixture thread: each yields one passage.
async function addLayerSources(threadsRoot: string): Promise<void> {
  const threadId = FIXTURE_THREAD_IDS[0];
  const threadPath = path.join(threadsRoot, threadId);
  await fs.mkdir(path.join(threadPath, "artifacts"), { recursive: true });
  await fs.writeFile(
    path.join(threadPath, "artifacts", "notes.md"),
    "# Notes\n\n## Decision\n\nKept the cache."
  );
  await fs.writeFile(
    path.join(threadPath, "CHAT.md"),
    [
      "# Chat title",
      "",
      `Thread: \`${threadId}\``,
      "",
      "<!-- marc-message",
      "id: msg-1",
      `threadId: ${threadId}`,
      "timestamp: 2026-10-01T00:00:01.000Z",
      "agentId: agent-a",
      "-->",
      "",
      "Discussed the cache.",
      "",
      "<!-- /marc-message -->"
    ].join("\n")
  );
}

async function writeRules(t: TestContext): Promise<string> {
  const file = path.join(await tempDirectory(t), "RULES.md");
  await fs.writeFile(file, "# Rules\n\n## Rule\n\nKeep it.");
  return file;
}
