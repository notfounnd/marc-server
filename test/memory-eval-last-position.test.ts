import assert from "node:assert/strict";
import test from "node:test";
import {
  lastPositionLogits,
  releaseAll,
  type LogitsModel
} from "../scripts/memory-eval/judge-runner.js";

/** A fake tensor that records its name in the release log when it is disposed. */
function tensorOf(name: string, releases: string[]) {
  return {
    name,
    dispose: () => {
      releases.push(name);
    }
  };
}

test("the last-position read copies only the requested ids of the last position", async () => {
  const missing = Number.NaN;
  const data = [
    missing,
    missing,
    missing,
    missing,
    missing,
    missing,
    missing,
    missing,
    10,
    11,
    12,
    13
  ];
  const model: LogitsModel = async () => ({
    logits: { dims: [1, 3, 4], data }
  });
  const result = await lastPositionLogits({
    model,
    feeds: {},
    keepLast: null,
    ids: [1, 3]
  });
  assert.deepEqual(result, { values: [11, 13], positions: 3 });
});

test("a graph that kept only the last position reads the same values", async () => {
  const model: LogitsModel = async () => ({
    logits: { dims: [1, 1, 4], data: [10, 11, 12, 13] }
  });
  const result = await lastPositionLogits({
    model,
    feeds: {},
    keepLast: null,
    ids: [1, 3]
  });
  assert.deepEqual(result, { values: [11, 13], positions: 1 });
});

test("the keep input reaches the graph, and every feed and output is released once", async () => {
  const releases: string[] = [];
  const received: Array<Record<string, unknown>> = [];
  const keep = tensorOf("keep", releases);
  const model: LogitsModel = async (feeds) => {
    received.push(feeds);
    return {
      logits: {
        ...tensorOf("logits", releases),
        dims: [1, 1, 2],
        data: [5, 6]
      },
      pastKeyValues: tensorOf("past", releases)
    };
  };
  const feeds = {
    input_ids: tensorOf("input_ids", releases),
    attention_mask: tensorOf("attention_mask", releases)
  };
  const result = await lastPositionLogits({
    model,
    feeds,
    keepLast: keep,
    ids: [0, 1]
  });
  assert.deepEqual(result, { values: [5, 6], positions: 1 });
  assert.equal(received[0].num_logits_to_keep, keep);
  assert.deepEqual(releases.sort(), [
    "attention_mask",
    "input_ids",
    "keep",
    "logits",
    "past"
  ]);
});

test("a failing call still releases the feeds and passes the error on", async () => {
  const releases: string[] = [];
  const model: LogitsModel = async () => {
    throw new Error("graph failed");
  };
  await assert.rejects(
    lastPositionLogits({
      model,
      feeds: { input_ids: tensorOf("input_ids", releases) },
      keepLast: tensorOf("keep", releases),
      ids: [0]
    }),
    /graph failed/
  );
  assert.deepEqual(releases.sort(), ["input_ids", "keep"]);
});

test("releaseAll skips the values that cannot be released", async () => {
  const releases: string[] = [];
  await releaseAll([
    1,
    "x",
    null,
    undefined,
    { dispose: () => releases.push("a") }
  ]);
  assert.deepEqual(releases, ["a"]);
});
