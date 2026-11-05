import assert from "node:assert/strict";
import test from "node:test";
import {
  exhaustBudget,
  governedThread,
  mentionOf,
  parse,
  stateOf
} from "./activation-daemon-fixtures.js";
import { ARCHITECT, send } from "./daemon-session-http-fixtures.js";

type StageRow = { name: string; to: string; status: number; reason?: string };

/** Human advances from planning, with the planning budget exhausted: only a stage strictly ahead moves. */
const HUMAN_ROWS: readonly StageRow[] = [
  {
    name: "the same stage is not ahead",
    to: "planning",
    status: 409,
    reason: "not_ahead"
  },
  {
    name: "an unknown stage is not ahead",
    to: "shipping",
    status: 409,
    reason: "not_ahead"
  }
];

for (const row of HUMAN_ROWS) {
  test(`human advance refused: ${row.name}`, async (t) => {
    const g = await governedThread(t);
    await exhaustBudget(g);
    const reply = await send(g.daemon.baseUrl, "POST", `${g.base}/advance`, {
      expectedStage: "planning",
      to: row.to
    });
    assert.deepEqual(
      [reply.status, parse(reply).reason],
      [row.status, row.reason]
    );
    assert.equal((await stateOf(g)).activation?.currentStage, "planning");
  });
}

test("the human advances from an exhausted stage straight to review, and the skipped budget is not transferred", async (t) => {
  const g = await governedThread(t);
  await exhaustBudget(g);
  const reply = await send(g.daemon.baseUrl, "POST", `${g.base}/advance`, {
    expectedStage: "planning",
    to: "review"
  });
  assert.equal(reply.status, 200, reply.text);

  const file = await stateOf(g);
  assert.equal(file.activation?.currentStage, "review");
  assert.deepEqual(
    (file.stageHistory ?? []).map((move) => [move.from, move.to, move.by]),
    [["planning", "review", "human"]]
  );
  const planning = file.activation?.stages.planning as { cyclesUsed: number };
  assert.equal(planning.cyclesUsed, 5);
  assert.deepEqual(file.activation?.stages.review, {
    cyclesUsed: 0,
    extensions: []
  });
});

test("review is the last stage: no human advance leaves it", async (t) => {
  const g = await governedThread(t);
  await send(g.daemon.baseUrl, "POST", `${g.base}/advance`, {
    expectedStage: "planning",
    to: "review"
  });
  const reply = await send(g.daemon.baseUrl, "POST", `${g.base}/advance`, {
    expectedStage: "review",
    to: "review"
  });
  assert.deepEqual([reply.status, parse(reply).reason], [409, "last_stage"]);
});

test("an agent advance without a verified identity is refused, and a confirmation of an unwritten message is refused", async (t) => {
  const g = await governedThread(t);
  await mentionOf(g);
  const identity = { pid: 99, ppid: 100, hostId: "host-a" };

  const advance = await send(
    g.daemon.baseUrl,
    "POST",
    `${g.base}/agent-advance`,
    {
      agentId: ARCHITECT,
      expectedStage: "planning",
      advanceTo: "execution",
      identity
    }
  );
  assert.deepEqual(
    [advance.status, parse(advance).reason],
    [409, "identity_unverified"]
  );

  const confirm = await send(
    g.daemon.baseUrl,
    "POST",
    `${g.base}/agent-advance/confirm`,
    {
      agentId: ARCHITECT,
      operationId: "op-missing",
      messageId: "msg_missing"
    }
  );
  assert.deepEqual(
    [confirm.status, parse(confirm).reason],
    [409, "message_not_written"]
  );
  assert.equal((await stateOf(g)).activation?.currentStage, "planning");
});
