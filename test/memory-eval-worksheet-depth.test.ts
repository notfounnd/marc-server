import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { buildWorksheet } from "../scripts/memory-eval/judgments.js";
import { replayCapture } from "../scripts/memory-eval/replay.js";
import { dataset, FIXTURE_THREAD_IDS } from "./memory-eval-capture-fixtures.js";
import { e3WorksheetCapture } from "./memory-eval-worksheet-fixtures.js";

test("a depth-one variant asks the layer-one cells of the groups it reaches, and a depth-zero variant asks no layer", async (t: TestContext) => {
  const { capture, vectors, threadsRoot } = await e3WorksheetCapture(t);
  const replay = await replayCapture({
    capture,
    dataset,
    variantIds: ["M0", "D0", "DEPTH0", "DEPTH1"],
    vectors
  });
  const source = { threadsRoot, threadIds: FIXTURE_THREAD_IDS };

  const depthOne = await buildWorksheet({
    capture,
    dataset,
    replay,
    source,
    variants: ["DEPTH1"],
    vectors
  });
  const depthZero = await buildWorksheet({
    capture,
    dataset,
    replay,
    source,
    variants: ["DEPTH0"],
    vectors
  });

  assert.ok(depthOne.pendingByLayer[1] > 0);
  assert.equal(depthZero.pendingByLayer[1], 0);
  assert.equal(depthZero.pendingByLayer[2], 0);
});

test("a base replay without the capture vectors refuses the worksheet, instead of dropping the depth reach", async (t: TestContext) => {
  const { capture, vectors, threadsRoot } = await e3WorksheetCapture(t);
  const replay = await replayCapture({
    capture,
    dataset,
    variantIds: ["M0", "D0", "DEPTH1"]
  });

  await assert.rejects(
    buildWorksheet({
      capture,
      dataset,
      replay,
      source: { threadsRoot, threadIds: FIXTURE_THREAD_IDS },
      variants: ["DEPTH1"],
      vectors
    }),
    /incomplete for case/
  );
});
