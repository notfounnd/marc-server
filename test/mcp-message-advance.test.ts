import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { postMessageWithActivation } from "../src/mcp/message-post-stamp.js";
import { workspaceWithThread } from "./daemon-session-http-fixtures.js";
import {
  ADVANCE,
  BODY,
  IDENTITY,
  RESERVATION,
  STAMP,
  chatOf,
  fakeDaemon,
  governedWorkspace,
  optionsOf
} from "./mcp-message-advance-fixtures.js";

test("a granted advance stamps the message with the destination and no cycle, and confirms the old grant and the advance", async (t) => {
  const fx = await governedWorkspace(t);
  const fake = fakeDaemon({
    stamp: STAMP,
    "agent-advance": {
      status: 200,
      body: {
        decision: "done",
        stage: "review",
        operationId: "op-1",
        droppedHolds: 0
      }
    },
    "agent-advance/confirm": { status: 200, body: { decision: "answered" } },
    "stamp/confirm": { status: 200, body: { decision: "answered" } }
  });

  const posted = await postMessageWithActivation(
    optionsOf(fake),
    fx.root,
    fx.threadId,
    BODY,
    ADVANCE
  );

  assert.deepEqual(posted.advance, {
    decision: "advanced",
    stage: "review",
    reference: posted.id
  });
  assert.deepEqual(
    [posted.stage, posted.cycle, posted.warnings],
    ["review", undefined, []]
  );
  assert.deepEqual(
    fake.calls.map((call) => call.path),
    ["stamp", "agent-advance", "stamp/confirm", "agent-advance/confirm"]
  );
  assert.deepEqual(fake.calls[1].body, {
    agentId: BODY.agentId,
    expectedStage: "execution",
    advanceTo: "review",
    identity: IDENTITY
  });
  assert.deepEqual(fake.calls[2].body, {
    agentId: BODY.agentId,
    messageId: posted.id,
    reservation: RESERVATION
  });
  assert.deepEqual(fake.calls[3].body, {
    agentId: BODY.agentId,
    operationId: "op-1",
    messageId: posted.id
  });
  assert.match(
    await chatOf(fx.root, fx.threadId),
    new RegExp(`id: ${posted.id}\\n[\\s\\S]*?stage: review`)
  );
});

test("a refused advance writes the message with its own stamp and reports the reason, without any advance confirmation", async (t) => {
  const fx = await governedWorkspace(t);
  const fake = fakeDaemon({
    stamp: {
      status: 200,
      body: {
        decision: "stamp",
        stage: "planning",
        cycle: 1,
        expectedStage: "planning"
      }
    },
    "agent-advance": {
      status: 409,
      body: { decision: "refused", reason: "not_lead" }
    }
  });

  const posted = await postMessageWithActivation(
    optionsOf(fake),
    fx.root,
    fx.threadId,
    BODY,
    ADVANCE
  );

  assert.deepEqual(
    [posted.advance, posted.warnings, posted.stage, posted.cycle],
    [
      { decision: "refused", reason: "not_lead" },
      ["stage_advance_refused"],
      "planning",
      1
    ]
  );
  assert.deepEqual(
    fake.calls.map((call) => call.path),
    ["stamp", "agent-advance"]
  );
});

test("an advance that never answers is unknown: the message is written with the stamp of the stage the thread stood on, and nothing is repeated", async (t) => {
  const fx = await governedWorkspace(t);
  const fake = fakeDaemon({
    stamp: {
      status: 200,
      body: { decision: "stamp", stage: "planning", expectedStage: "planning" }
    }
  });

  const posted = await postMessageWithActivation(
    optionsOf(fake, 20),
    fx.root,
    fx.threadId,
    BODY,
    ADVANCE
  );

  assert.deepEqual(
    [posted.advance, posted.warnings, posted.stage],
    [{ decision: "unknown" }, ["stage_advance_unknown"], "planning"]
  );
  assert.deepEqual(
    fake.calls.map((call) => call.path),
    ["stamp", "agent-advance"]
  );
});

test("a failed advance confirmation keeps the message and reports the reference as null", async (t) => {
  const fx = await governedWorkspace(t);
  const fake = fakeDaemon({
    stamp: {
      status: 200,
      body: { decision: "stamp", stage: "planning", expectedStage: "planning" }
    },
    "agent-advance": {
      status: 200,
      body: {
        decision: "done",
        stage: "review",
        operationId: "op-2",
        droppedHolds: 0
      }
    },
    "agent-advance/confirm": {
      status: 409,
      body: { decision: "refused", reason: "message_not_written" }
    }
  });

  const posted = await postMessageWithActivation(
    optionsOf(fake),
    fx.root,
    fx.threadId,
    BODY,
    ADVANCE
  );

  assert.deepEqual(posted.advance, {
    decision: "advanced",
    stage: "review",
    reference: null
  });
  assert.deepEqual(posted.warnings, ["activation_confirm_failed"]);
  assert.match(
    await chatOf(fx.root, fx.threadId),
    new RegExp(`id: ${posted.id}`)
  );
});

test("a stamp that cannot be prepared writes the message plainly, refuses the advance by reason, and calls no advance", async (t) => {
  const fx = await governedWorkspace(t);
  const fake = fakeDaemon({
    stamp: { status: 500, body: { decision: "unavailable" } }
  });

  const posted = await postMessageWithActivation(
    optionsOf(fake),
    fx.root,
    fx.threadId,
    BODY,
    ADVANCE
  );

  assert.deepEqual(
    [posted.warnings, posted.advance],
    [
      ["activation_stamp_unavailable"],
      { decision: "refused", reason: "stamp_unavailable" }
    ]
  );
  assert.deepEqual(
    fake.calls.map((call) => call.path),
    ["stamp"]
  );
});

test("a thread without an enabled policy never calls the daemon, and an advance there is refused by policy", async (t) => {
  const fx = await workspaceWithThread();
  t.after(() => fs.rm(fx.root, { recursive: true, force: true }));
  const fake = fakeDaemon({});

  const posted = await postMessageWithActivation(
    optionsOf(fake),
    fx.root,
    fx.threadId,
    BODY,
    ADVANCE
  );

  assert.deepEqual(
    [posted.warnings, posted.advance],
    [
      ["stage_advance_refused"],
      { decision: "refused", reason: "policy_disabled" }
    ]
  );
  assert.deepEqual(fake.calls, []);
});

test("a refused advance and a failed stamp confirmation are both reported, the advance first", async (t) => {
  const fx = await governedWorkspace(t);
  const fake = fakeDaemon({
    stamp: STAMP,
    "agent-advance": {
      status: 409,
      body: { decision: "refused", reason: "not_lead" }
    },
    "stamp/confirm": {
      status: 409,
      body: { decision: "refused", reason: "message_not_written" }
    }
  });

  const posted = await postMessageWithActivation(
    optionsOf(fake),
    fx.root,
    fx.threadId,
    BODY,
    ADVANCE
  );

  assert.deepEqual(posted.advance, { decision: "refused", reason: "not_lead" });
  assert.deepEqual(posted.warnings, [
    "stage_advance_refused",
    "activation_confirm_failed"
  ]);
});

test("two failed confirmations of the same kind are reported once", async (t) => {
  const fx = await governedWorkspace(t);
  const fake = fakeDaemon({
    stamp: STAMP,
    "agent-advance": {
      status: 200,
      body: {
        decision: "done",
        stage: "review",
        operationId: "op-3",
        droppedHolds: 0
      }
    },
    "stamp/confirm": {
      status: 409,
      body: { decision: "refused", reason: "message_not_written" }
    },
    "agent-advance/confirm": {
      status: 409,
      body: { decision: "refused", reason: "message_not_written" }
    }
  });

  const posted = await postMessageWithActivation(
    optionsOf(fake),
    fx.root,
    fx.threadId,
    BODY,
    ADVANCE
  );

  assert.deepEqual(posted.advance, {
    decision: "advanced",
    stage: "review",
    reference: null
  });
  assert.deepEqual(posted.warnings, ["activation_confirm_failed"]);
});
