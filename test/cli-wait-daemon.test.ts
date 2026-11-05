import assert from "node:assert/strict";
import test from "node:test";
import {
  CODEX,
  cursorOf,
  exhaustBudget,
  finished,
  governedThread,
  lineOf,
  mentionOf,
  recordOf,
  startWait,
  stateOf,
  waitUntil
} from "./activation-daemon-fixtures.js";
import { send } from "./daemon-session-http-fixtures.js";

const WAIT_LIMITS = { timeoutMs: 20_000, intervalMs: 100 };

test("a governed wait against the real daemon exits 0 with its granted reservation", async (t) => {
  const g = await governedThread(t);
  const since = await cursorOf(g);
  const mention = await mentionOf(g);

  const run = await finished(startWait(t, g, since));
  const line = lineOf(run);

  assert.equal(run.code, 0);
  assert.equal(line.status, "mention");
  assert.deepEqual(line.granted, [
    {
      messageId: mention,
      stage: "planning",
      cycle: 1,
      reservation: `${mention}:${CODEX}`
    }
  ]);
});

test("a re-armed wait with a new run id is granted again, and the state counts one attempt", async (t) => {
  const g = await governedThread(t);
  const since = await cursorOf(g);
  const mention = await mentionOf(g);

  const first = await finished(startWait(t, g, since));
  const second = await finished(startWait(t, g, since));

  assert.deepEqual([first.code, lineOf(first).status], [0, "mention"]);
  assert.deepEqual([second.code, lineOf(second).status], [0, "mention"]);
  assert.equal(recordOf(await stateOf(g), mention)?.attempts, 1);
});

test("a wait held by an exhausted budget exits 0 by itself once the human extends the stage", async (t) => {
  const g = await governedThread(t);
  await exhaustBudget(g);
  const since = await cursorOf(g);
  const mention = await mentionOf(g);

  const wait = startWait(t, g, since);
  const held = await waitUntil(
    async () => recordOf(await stateOf(g), mention),
    (record) => record?.status === "held",
    WAIT_LIMITS
  );
  assert.deepEqual([held?.status, held?.reason], ["held", "budget_exhausted"]);

  const extended = await send(g.daemon.baseUrl, "POST", `${g.base}/extend`, {
    expectedStage: "planning"
  });
  assert.equal(extended.status, 200);

  const run = await finished(wait);
  assert.equal(run.code, 0);
  assert.deepEqual(lineOf(run).granted, [
    {
      messageId: mention,
      stage: "planning",
      cycle: 6,
      reservation: `${mention}:${CODEX}`
    }
  ]);
});
