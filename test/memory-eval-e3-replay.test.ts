import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { judgedDepthOfCase } from "../scripts/memory-eval/evaluation.js";
import type {
  CaptureFile,
  CapturedVectors
} from "../scripts/memory-eval/capture-types.js";
import { readVectors } from "../scripts/memory-eval/capture-vectors.js";
import type { EvalDataset } from "../scripts/memory-eval/dataset.js";
import {
  replayCapture,
  type ReplayResult
} from "../scripts/memory-eval/replay.js";
import {
  createFakes,
  dataset,
  fixtureThreadsRoot,
  readCaptureFile,
  runCapture,
  tempDirectory,
  THREAD_SETTINGS
} from "./memory-eval-capture-fixtures.js";
import { chatMessage, chatText } from "./memory-layers-fixtures.js";

/** T0 of the E3 study: B = 232 pairs per query, and K = 12 for the replay tests (3K <= B/2). */
const PARAMS = { budget: 232, k: 12, mode: "cosine" as const };
const CUTS_BELOW_EVERY_ELIGIBILITY = { high: -1, medium: -1 };

async function threadsWithChat(t: TestContext): Promise<string> {
  const threadsRoot = await fixtureThreadsRoot(t);
  const message = chatMessage("msg_settings_chat", "").replace(
    "body",
    "Decidimos guardar a chave de rotacao no cofre local, fora do JSON das settings."
  );
  await fs.writeFile(
    path.join(threadsRoot, THREAD_SETTINGS, "CHAT.md"),
    chatText([message])
  );
  return threadsRoot;
}

/** An E3 capture of the three-layer fixture, read back with its vectors. */
async function e3Capture(
  t: TestContext,
  judged: EvalDataset = dataset
): Promise<{
  capture: CaptureFile;
  vectors: Map<string, number[]>;
}> {
  const { result } = await runCapture({
    threadsRoot: await threadsWithChat(t),
    outputRoot: await tempDirectory(t),
    fakes: createFakes(),
    dataset: judged,
    syntheticQueries: false
  });
  const capture = await readCaptureFile(result.captureDir);
  assert.notEqual(capture.vectors, undefined);
  return {
    capture,
    vectors: await readVectors(
      result.captureDir,
      capture.vectors as CapturedVectors
    )
  };
}

function admittedOf(replay: ReplayResult, caseIndex: number, variant: string) {
  const output = replay.cases[caseIndex]?.variants.find(
    (item) => item.variant === variant
  );
  return output?.results.map((result) => [
    result.threadId,
    result.score,
    result.admitted
  ]);
}

test("DEPTH0 admits the same groups, in the same order and with the same scores, as M0 on every case", async (t) => {
  const { capture, vectors } = await e3Capture(t);
  const replay = await replayCapture({
    capture,
    dataset,
    variantIds: ["M0", "DEPTH0"],
    vectors
  });

  assert.equal(replay.cases.length, dataset.cases.length);
  for (const [index] of replay.cases.entries()) {
    assert.deepEqual(
      admittedOf(replay, index, "DEPTH0"),
      admittedOf(replay, index, "M0")
    );
  }
});

test("FUNNEL_D2 and ALL_CANDIDATES_D2 are complete with the budget, K and mode; without them they are missing-funnel-params", async (t) => {
  const { capture, vectors } = await e3Capture(t);
  const variantIds = ["FUNNEL_D2", "ALL_CANDIDATES_D2"];

  const withParams = await replayCapture({
    capture,
    dataset,
    variantIds,
    vectors,
    funnelParams: PARAMS
  });
  for (const caseReplay of withParams.cases) {
    for (const output of caseReplay.variants) {
      assert.equal(
        output.incomplete,
        undefined,
        `${caseReplay.caseId} ${output.variant}`
      );
    }
  }
  assert.ok(
    withParams.cases.some(
      (caseReplay) => (caseReplay.variants[1]?.results.length ?? 0) > 0
    )
  );

  const without = await replayCapture({
    capture,
    dataset,
    variantIds,
    vectors
  });
  for (const caseReplay of without.cases) {
    for (const output of caseReplay.variants) {
      assert.deepEqual(output.incomplete, { reason: "missing-funnel-params" });
    }
  }
});

test("a funnel run reports the deepest layer it searched, from its own run", async (t) => {
  const { capture, vectors } = await e3Capture(t);
  const replay = await replayCapture({
    capture,
    dataset,
    variantIds: ["FUNNEL_D1"],
    vectors,
    funnelParams: PARAMS
  });
  for (const caseReplay of replay.cases) {
    assert.equal(caseReplay.variants[0]?.judgedDepth, 1);
  }
});

test("ADAPTIVE needs the band cuts; with cuts that every top result reaches it stops at layer 0 and is judged there", async (t) => {
  const { capture, vectors } = await e3Capture(t);

  const withoutCuts = await replayCapture({
    capture,
    dataset,
    variantIds: ["ADAPTIVE"],
    vectors,
    funnelParams: PARAMS
  });
  for (const caseReplay of withoutCuts.cases) {
    assert.deepEqual(caseReplay.variants[0]?.incomplete, {
      reason: "missing-funnel-params"
    });
  }

  const withCuts = await replayCapture({
    capture,
    dataset,
    variantIds: ["ADAPTIVE"],
    vectors,
    funnelParams: { ...PARAMS, cuts: CUTS_BELOW_EVERY_ELIGIBILITY }
  });
  const answered = withCuts.cases.filter(
    (caseReplay) => (caseReplay.variants[0]?.results.length ?? 0) > 0
  );
  assert.ok(answered.length > 0);
  for (const caseReplay of answered) {
    assert.equal(caseReplay.variants[0]?.judgedDepth, 0);
  }
});

test("a group of degree three only in layer 2 does not grade an ADAPTIVE run that stopped at layer 0", async (t) => {
  const judged: EvalDataset = {
    ...dataset,
    cases: dataset.cases.map((evalCase) =>
      evalCase.id === "A2"
        ? {
            ...evalCase,
            judgments: { [THREAD_SETTINGS]: 0 },
            layerJudgments: { 2: { [THREAD_SETTINGS]: 3 } }
          }
        : evalCase
    )
  };
  const { capture, vectors } = await e3Capture(t, judged);
  const replay = await replayCapture({
    capture,
    dataset: judged,
    variantIds: ["ADAPTIVE"],
    vectors,
    funnelParams: { ...PARAMS, cuts: CUTS_BELOW_EVERY_ELIGIBILITY }
  });
  const caseA2 = replay.cases.find((item) => item.caseId === "A2");
  assert.equal(caseA2?.variants[0]?.judgedDepth, 0);
  assert.equal(judgedDepthOfCase(replay, "A2", "ADAPTIVE"), 0);
});

test("a case without the score of a pair the funnel needs is incomplete with missing-score, never zero", async (t) => {
  const { capture, vectors } = await e3Capture(t);
  const withoutScores: CaptureFile = {
    ...capture,
    cases: capture.cases.map((captured, index) =>
      index === 0 ? { ...captured, recordScores: {} } : captured
    )
  };
  const replay = await replayCapture({
    capture: withoutScores,
    dataset,
    variantIds: ["FUNNEL_D2"],
    vectors,
    funnelParams: PARAMS
  });
  assert.equal(
    replay.cases[0]?.variants[0]?.incomplete?.reason,
    "missing-score"
  );
  assert.equal(replay.cases[1]?.variants[0]?.incomplete, undefined);
});

test("a capture without the E3 channels is incomplete for the funnel with missing-funnel-inputs, and M0 still runs", async (t) => {
  const { capture, vectors } = await e3Capture(t);
  const e2Shaped: CaptureFile = {
    ...capture,
    cases: capture.cases.map((captured, index) =>
      index === 0 ? { ...captured, channelsByDepth: undefined } : captured
    )
  };
  const replay = await replayCapture({
    capture: e2Shaped,
    dataset,
    variantIds: ["M0", "FUNNEL_D2"],
    vectors,
    funnelParams: PARAMS
  });
  assert.equal(
    replay.cases[0]?.variants[1]?.incomplete?.reason,
    "missing-funnel-inputs"
  );
  assert.equal(replay.cases[0]?.variants[0]?.incomplete, undefined);
  assert.ok((replay.cases[0]?.variants[0]?.results.length ?? 0) > 0);
});

test("a case that the capture marks incomplete cannot approve any variant, and reports the reason", async (t) => {
  const { capture, vectors } = await e3Capture(t);
  const marked: CaptureFile = {
    ...capture,
    cases: capture.cases.map((captured, index) =>
      index === 1
        ? { ...captured, incomplete: { reason: "evidence_missing" as const } }
        : captured
    )
  };
  const replay = await replayCapture({
    capture: marked,
    dataset,
    variantIds: ["M0", "DEPTH0"],
    vectors
  });
  for (const output of replay.cases[1]?.variants ?? []) {
    assert.deepEqual(output.incomplete, { reason: "evidence_missing" });
    assert.deepEqual(output.results, []);
  }
  assert.equal(replay.cases[0]?.variants[0]?.incomplete, undefined);
});
