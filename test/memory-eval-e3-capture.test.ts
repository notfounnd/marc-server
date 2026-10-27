import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";
import type { CaptureOptions } from "../scripts/memory-eval/capture.js";
import { captureMemoryEval } from "../scripts/memory-eval/capture.js";
import {
  countCapture,
  countFileName
} from "../scripts/memory-eval/capture-count.js";
import { complementCapture } from "../scripts/memory-eval/capture-complement.js";
import {
  pairScoresOf,
  recordScoresOf
} from "../scripts/memory-eval/capture-score.js";
import { readVectors } from "../scripts/memory-eval/capture-vectors.js";
import type { EvalDataset } from "../scripts/memory-eval/dataset.js";
import {
  createFakes,
  dataset,
  FIXTURE_THREAD_IDS,
  fixtureThreadsRoot,
  readCaptureFile,
  REPOSITORY_ROOT,
  runCapture,
  tempDirectory,
  THREAD_RULES,
  THREAD_SETTINGS,
  THREAD_TOKEN,
  type FakeSet
} from "./memory-eval-capture-fixtures.js";
import { chatMessage, chatText } from "./memory-layers-fixtures.js";

/** The settings thread also has a chat: its message is the only layer-2 passage of the fixture. */
const CHAT_SENTENCE =
  "Decidimos guardar a chave de rotacao no cofre local, fora do JSON das settings.";

/** The fixture corpus with the three layers: summaries (0), the default RULES.md (1) and a chat (2). */
async function threadsWithChat(t: TestContext): Promise<string> {
  const threadsRoot = await fixtureThreadsRoot(t);
  const message = chatMessage("msg_settings_chat", "").replace(
    "body",
    CHAT_SENTENCE
  );
  await fs.writeFile(
    path.join(threadsRoot, THREAD_SETTINGS, "CHAT.md"),
    chatText([message])
  );
  return threadsRoot;
}

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

test("each depth searches only the layers up to it: depth 0 holds layer 0 alone, depth 2 reaches the chat", async (t) => {
  const { result } = await runCapture({
    threadsRoot: await threadsWithChat(t),
    outputRoot: await tempDirectory(t),
    fakes: createFakes(),
    syntheticQueries: false
  });
  const capture = await readCaptureFile(result.captureDir);
  const layerOf = new Map(
    capture.records.map((record) => [record.recordId, record.layer])
  );
  const layersOfDepth = (depth: 0 | 2) =>
    capture.cases.flatMap((captured) =>
      (captured.channelsByDepth?.[depth]?.passages ?? []).map((hit) =>
        layerOf.get(hit.recordId)
      )
    );

  assert.ok(layersOfDepth(0).length > 0);
  assert.deepEqual([...new Set(layersOfDepth(0))], [0]);
  assert.ok(layersOfDepth(2).includes(2));
});

test("count writes the pairs of every case, and a capture above the limit is refused before any pair is scored", async (t) => {
  const outputRoot = await tempDirectory(t);
  const threadsRoot = await threadsWithChat(t);
  const fakes = createFakes();

  const count = await countCapture(
    optionsOf({ threadsRoot, outputRoot, fakes, countLimitHours: 1e-7 })
  );
  assert.equal(count.perCase.length, dataset.cases.length);
  assert.equal(
    count.totalPairs,
    count.perCase.reduce((total, item) => total + item.pairs, 0)
  );
  assert.equal(count.hours, count.totalPairs / count.pairsPerSecond / 3600);
  assert.equal(count.refused, true);
  assert.equal(fakes.reranker.rerankCalls, 0);
  const written = JSON.parse(
    await fs.readFile(
      path.join(outputRoot, dataset.corpus, countFileName(count.captureId)),
      "utf8"
    )
  ) as { totalPairs: number };
  assert.equal(written.totalPairs, count.totalPairs);

  await assert.rejects(
    captureMemoryEval(
      optionsOf({ threadsRoot, outputRoot, fakes, countLimitHours: 1e-7 })
    ),
    /above the 1e-7 h limit\. Nothing was scored\./
  );
  assert.equal(fakes.reranker.rerankCalls, 0);

  const allowed = await countCapture(
    optionsOf({ threadsRoot, outputRoot, fakes })
  );
  assert.equal(allowed.refused, false);
});

test("the evidence of a case is located in a passage, or reported missing with the reason that keeps the case incomplete", async (t) => {
  const quote = "Rotacionar o token do daemon periodicamente com seguranca";
  const withEvidence: EvalDataset = {
    ...dataset,
    cases: dataset.cases.map((evalCase) =>
      evalCase.id === "A1"
        ? {
            ...evalCase,
            evidence: [
              { sourcePath: `threads/${THREAD_TOKEN}/SUMMARY.md`, quote }
            ]
          }
        : evalCase
    )
  };
  const indexed = await runCapture({
    threadsRoot: await threadsWithChat(t),
    outputRoot: await tempDirectory(t),
    fakes: createFakes(),
    dataset: withEvidence,
    syntheticQueries: false
  });
  const indexedCapture = await readCaptureFile(indexed.result.captureDir);
  const located = indexedCapture.cases.find((item) => item.id === "A1");
  assert.equal(located?.evidence?.[0]?.status, "indexed");
  assert.ok((located?.evidence?.[0]?.passageIds.length ?? 0) > 0);
  assert.equal(located?.incomplete, undefined);

  const missingEvidence: EvalDataset = {
    ...dataset,
    cases: dataset.cases.map((evalCase) =>
      evalCase.id === "A1"
        ? {
            ...evalCase,
            evidence: [
              {
                sourcePath: `threads/${THREAD_RULES}/SUMMARY.md`,
                quote: "Esta frase nao existe em nenhum resumo"
              }
            ]
          }
        : evalCase
    )
  };
  const missing = await runCapture({
    threadsRoot: await threadsWithChat(t),
    outputRoot: await tempDirectory(t),
    fakes: createFakes(),
    dataset: missingEvidence,
    syntheticQueries: false
  });
  const missingCapture = await readCaptureFile(missing.result.captureDir);
  const absent = missingCapture.cases.find((item) => item.id === "A1");
  assert.equal(absent?.evidence?.[0]?.status, "missing");
  assert.deepEqual(absent?.incomplete, { reason: "evidence_missing" });
});

test("the complement adds the records of the groups that reach degree two, and rewrites nothing that the capture holds", async (t) => {
  const fakes = createFakes();
  const { result } = await runCapture({
    threadsRoot: await threadsWithChat(t),
    outputRoot: await tempDirectory(t),
    fakes,
    syntheticQueries: false
  });
  const before = await readCaptureFile(result.captureDir);
  const judged: EvalDataset = {
    ...dataset,
    cases: dataset.cases.map((evalCase) => ({
      ...evalCase,
      layerJudgments: { 1: { "@rules": 2 }, 2: { [THREAD_SETTINGS]: 3 } }
    }))
  };

  const summary = await complementCapture({
    captureDir: result.captureDir,
    judged,
    reranker: fakes.reranker
  });
  const after = await readCaptureFile(result.captureDir);

  assert.equal(summary.round, 1);
  assert.deepEqual(after.records, before.records);
  assert.deepEqual(after.vectors, before.vectors);
  for (const [index, captured] of before.cases.entries()) {
    const next = after.cases[index];
    assert.deepEqual(next.channelsByDepth, captured.channelsByDepth);
    for (const [recordId, score] of Object.entries(
      captured.recordScores ?? {}
    )) {
      assert.equal(next.recordScores?.[recordId], score);
    }
    for (const [key, score] of Object.entries(captured.rerankScores)) {
      assert.equal(next.rerankScores[key], score);
    }
  }
  const addedScores = after.cases.reduce(
    (total, captured, index) =>
      total +
      Object.keys(captured.recordScores ?? {}).length -
      Object.keys(before.cases[index]?.recordScores ?? {}).length,
    0
  );
  assert.equal(addedScores, summary.addedPairs);
  assert.equal(after.complementRounds?.length, before.cases.length);

  const again = await complementCapture({
    captureDir: result.captureDir,
    judged,
    reranker: fakes.reranker
  });
  assert.equal(again.addedPairs, 0);
  const twice = await readCaptureFile(result.captureDir);
  assert.equal(twice.complementRounds?.length, 2 * before.cases.length);
  assert.deepEqual(
    twice.complementRounds?.slice(0, before.cases.length),
    after.complementRounds
  );
});

test("the vectors of a capture are float32 for every record of the index, one row per record", async (t) => {
  const { result } = await runCapture({
    threadsRoot: await threadsWithChat(t),
    outputRoot: await tempDirectory(t),
    fakes: createFakes(),
    syntheticQueries: false
  });
  const capture = await readCaptureFile(result.captureDir);
  assert.ok(capture.vectors !== undefined);
  const vectors = await readVectors(result.captureDir, capture.vectors);
  assert.equal(vectors.size, capture.records.length);
  const [first] = capture.records;
  assert.equal(vectors.get(first.recordId)?.length, capture.vectors.dimension);
  const stored = await fs.stat(
    path.join(result.captureDir, capture.vectors.file)
  );
  assert.equal(
    stored.size,
    capture.records.length * capture.vectors.dimension * 4
  );
});

test("two records with the same document get the same score, and each keeps its own entry", () => {
  const records = [{ recordId: "t1:passage:0" }, { recordId: "t1:passage:1" }];
  const documents = ["Settings em JSON", "Settings em JSON"];
  const scores = [0.75, 0.75];
  assert.deepEqual(recordScoresOf(records, scores), {
    "t1:passage:0": 0.75,
    "t1:passage:1": 0.75
  });
  const pairs = pairScoresOf("settings", documents, scores);
  assert.equal(Object.keys(pairs).length, 1);
  assert.deepEqual(Object.values(pairs), [0.75]);
});
