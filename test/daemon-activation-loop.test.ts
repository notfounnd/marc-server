import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { appendMessageInWorkspace } from "../src/core/threads.js";
import { registerAgent } from "../src/core/workspace.js";
import type { ThreadFile } from "../src/daemon/thread-store.js";
import {
  ARCHITECT,
  get,
  registered,
  send,
  startDaemon,
  workspaceWithThread,
  type Reply
} from "./daemon-session-http-fixtures.js";
import {
  BOUND_CLIENT,
  bindWaiter,
  CLI_SESSION
} from "./activation-daemon-fixtures.js";

const CODEX = "codex-software-architect";
const POLICY_BODY = { enabled: true, attemptCap: 2, pendingTtlMinutes: 1440 };

function parse(reply: Reply): Record<string, unknown> {
  return JSON.parse(reply.text) as Record<string, unknown>;
}

function mention(): string {
  return `marc://@${CODEX} please review the plan.`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function started(t: { after(fn: () => unknown): void }) {
  const daemon = await startDaemon([BOUND_CLIENT]);
  t.after(() => daemon.close());
  const ws = await workspaceWithThread();
  t.after(() => fs.rm(ws.root, { recursive: true, force: true }));
  await registered(daemon, ws.info);
  await registerAgent(ws.root, {
    id: CODEX,
    role: "architect",
    model: "gpt-6.1-sol",
    description: "Codex architect profile for loop tests."
  });
  const base = `/api/workspaces/${ws.info.id}/threads/${ws.threadId}/activation`;
  const workspaceBase = `/api/workspaces/${ws.info.id}/activation`;
  await send(daemon.baseUrl, "PUT", `${base}/policy`, POLICY_BODY);
  await bindWaiter(daemon.baseUrl, ws.info, ws.threadId);
  return { daemon, ws, base, workspaceBase };
}

type Ctx = Awaited<ReturnType<typeof started>>;

function poll(s: Ctx, messageId: string, runId: string): Promise<Reply> {
  return send(s.daemon.baseUrl, "POST", `${s.base}/reservations`, {
    messageId,
    recipient: CODEX,
    holder: CLI_SESSION,
    runId,
    pid: process.pid
  });
}

function stateFile(s: Ctx): string {
  return path.join(
    s.daemon.dataDir,
    "threads",
    s.ws.info.id,
    `${s.ws.threadId}.json`
  );
}

async function stateOf(s: Ctx): Promise<ThreadFile> {
  return JSON.parse(await fs.readFile(stateFile(s), "utf8")) as ThreadFile;
}

async function architectMention(s: Ctx): Promise<string> {
  const message = await appendMessageInWorkspace(s.ws.info, s.ws.threadId, {
    agentId: ARCHITECT,
    body: mention(),
    role: "architect"
  });
  return message.id;
}

test("a grant retained by a pause is counted when it is granted, and its replay spends nothing", async (t) => {
  const s = await started(t);
  const messageId = await architectMention(s);

  const first = parse(await poll(s, messageId, "run-1"));
  assert.deepEqual([first.decision, first.cycle], ["granted", 1]);

  await send(s.daemon.baseUrl, "POST", `${s.workspaceBase}/pause`);
  const held = parse(await poll(s, messageId, "run-2"));
  assert.deepEqual([held.decision, held.reason], ["held", "workspace_paused"]);

  const advanced = await send(s.daemon.baseUrl, "POST", `${s.base}/advance`, {
    expectedStage: "planning",
    to: "execution"
  });
  assert.equal(advanced.status, 200);
  const afterAdvance = await stateOf(s);
  const record = afterAdvance.reservations?.find(
    (item) => item.messageId === messageId
  );
  assert.deepEqual(
    [
      record?.granted,
      record?.status,
      afterAdvance.stageHistory?.[0]?.droppedHolds
    ],
    [true, "held", 0]
  );

  await send(s.daemon.baseUrl, "POST", `${s.workspaceBase}/resume`);
  const released = parse(await poll(s, messageId, "run-2"));
  assert.deepEqual([released.decision, released.cycle], ["granted", 1]);
  const admitted = await stateOf(s);
  assert.equal(
    admitted.reservations?.find((item) => item.messageId === messageId)
      ?.attempts,
    1
  );
  const planning = admitted.activation?.stages.planning as
    | { cyclesUsed: number }
    | undefined;
  assert.equal(planning?.cyclesUsed, 1);

  const replay = parse(await poll(s, messageId, "run-2"));
  assert.equal(replay.decision, "granted");
  assert.equal(
    (await stateOf(s)).reservations?.find(
      (item) => item.messageId === messageId
    )?.attempts,
    1
  );

  const newRun = parse(await poll(s, messageId, "run-3"));
  assert.equal(newRun.decision, "granted");
  const spent = await stateOf(s);
  assert.equal(
    spent.reservations?.find((item) => item.messageId === messageId)?.attempts,
    2
  );
});

test("a repeated poll under a pause does not rewrite the state file", async (t) => {
  const s = await started(t);
  const messageId = await architectMention(s);
  await send(s.daemon.baseUrl, "POST", `${s.workspaceBase}/pause`);

  assert.equal(parse(await poll(s, messageId, "run-1")).decision, "held");
  const before = (await fs.stat(stateFile(s))).mtimeMs;
  await delay(30);
  assert.equal(parse(await poll(s, messageId, "run-1")).decision, "held");
  assert.equal((await fs.stat(stateFile(s))).mtimeMs, before);
});

const EXHAUST = [1, 2, 3, 4, 5];

test("an exhausted budget holds the next mention, and an extension grants it on its next poll", async (t) => {
  const s = await started(t);
  for (const index of EXHAUST) {
    const messageId = await architectMention(s);
    const granted = parse(await poll(s, messageId, `run-${index}`));
    assert.deepEqual([granted.decision, granted.cycle], ["granted", index]);
  }
  const heldId = await architectMention(s);
  const held = parse(await poll(s, heldId, "run-6"));
  assert.deepEqual([held.decision, held.reason], ["held", "budget_exhausted"]);

  const extended = await send(s.daemon.baseUrl, "POST", `${s.base}/extend`, {
    expectedStage: "planning"
  });
  assert.equal(extended.status, 200);
  const released = parse(await poll(s, heldId, "run-6"));
  assert.deepEqual([released.decision, released.cycle], ["granted", 6]);
  // The first grant of a held record is not a redelivery: it spends no attempt.
  const record = (await stateOf(s)).reservations?.find(
    (item) => item.messageId === heldId
  );
  assert.equal(record?.attempts, 0);
});

test("a human advance works with the budget exhausted, and the held mention is then ended with stage_advanced", async (t) => {
  const s = await started(t);
  for (const index of EXHAUST) {
    const messageId = await architectMention(s);
    await poll(s, messageId, `run-${index}`);
  }
  const heldId = await architectMention(s);
  await poll(s, heldId, "run-6");

  const advanced = await send(s.daemon.baseUrl, "POST", `${s.base}/advance`, {
    expectedStage: "planning",
    to: "execution"
  });
  assert.equal(advanced.status, 200);
  assert.equal(
    (parse(advanced).budget as { currentStage: string }).currentStage,
    "execution"
  );
  const retry = parse(await poll(s, heldId, "run-6"));
  assert.deepEqual(
    [retry.decision, retry.reason],
    ["refused", "stage_advanced"]
  );
});

test("two concurrent human advances with the same expected stage: one moves, the other is refused stage_changed", async (t) => {
  const s = await started(t);
  const replies = await Promise.all([
    send(s.daemon.baseUrl, "POST", `${s.base}/advance`, {
      expectedStage: "planning",
      to: "execution"
    }),
    send(s.daemon.baseUrl, "POST", `${s.base}/advance`, {
      expectedStage: "planning",
      to: "execution"
    })
  ]);
  const statuses = replies.map((reply) => reply.status).sort();
  assert.deepEqual(statuses, [200, 409]);
  const refused = replies.find((reply) => reply.status === 409);
  assert.equal(refused && parse(refused).reason, "stage_changed");
});

test("the thread view still reports the lead and the stage history after a move", async (t) => {
  const s = await started(t);
  await architectMention(s);
  await send(s.daemon.baseUrl, "POST", `${s.base}/advance`, {
    expectedStage: "planning",
    to: "execution"
  });
  const view = parse(await get(s.daemon.baseUrl, s.base));
  assert.deepEqual(
    [view.lead, (view.stageHistory as unknown[]).length],
    [ARCHITECT, 1]
  );
});
