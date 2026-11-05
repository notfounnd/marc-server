import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import {
  MINUTE_MS,
  STOP_GRACE_MS
} from "../src/core/activation-turn-timeout.js";
import type { SupervisionRecord } from "../src/core/activation-supervision-types.js";
import { send } from "./daemon-session-http-fixtures.js";
import { parseReply, SECOND } from "./daemon-supervision-fixtures.js";
import {
  advance,
  cardAction,
  cardFor,
  cardsOf,
  CONTINUE_PROMPT,
  fakeClient,
  launchedArgv,
  mention,
  stateOf,
  stopFileOf,
  TEST_HEARTBEAT_MS,
  turnThread,
  waitForCards,
  type TurnThread
} from "./daemon-supervision-turn-fixtures.js";
import {
  grandchildPidOf,
  isAlive,
  noticeOf,
  waitUntilGone
} from "./daemon-supervision-turn-probes.js";

const POLICY_CHANGED = {
  enabled: true,
  attemptCap: 3,
  pendingTtlMinutes: 1440
};

/** The instant the turn's time limit ends, as the running card recorded it. */
function deadlineOf(record: SupervisionRecord): number {
  return Date.parse(record.turn?.deadlineAt ?? "");
}

/** Approves a mention and waits until its turn runs, so the card carries the pid and the start instant. */
async function runningTurn(
  thread: TurnThread,
  messageId: string
): Promise<SupervisionRecord> {
  await cardAction(thread, "approve", messageId);
  const records = await waitForCards(thread, (cards) =>
    cards.some(
      (card) =>
        card.messageId === messageId &&
        card.status === "running" &&
        card.turn?.pid !== undefined
    )
  );
  return cardFor(records, messageId);
}

function terminalWith(messageId: string, status: string) {
  return (cards: SupervisionRecord[]) =>
    cards.some(
      (card) => card.messageId === messageId && card.status === status
    );
}

test("the notice shows the warning in the last ten minutes and the stop at the deadline, and an obedient turn ends without a kill", async (t) => {
  const thread = await turnThread(t, "production");
  fakeClient(thread, "obey", "0.001");
  const messageId = await mention(thread);
  const card = await runningTurn(thread, messageId);
  const runId = card.runId ?? "";

  advance(thread.clock, deadlineOf(card) - 10 * MINUTE_MS - thread.clock.ms);
  const warning = await noticeOf(thread, runId);
  assert.equal(warning.status, 200);
  assert.deepEqual(JSON.parse(warning.text), {
    kind: "warning",
    minutesLeft: 10,
    message:
      "10 minutes left: finish the current change, post your progress and stop"
  });

  advance(thread.clock, 10 * MINUTE_MS);
  assert.equal(JSON.parse((await noticeOf(thread, runId)).text).kind, "stop");
  // The test holds the token and has seen the stop notice; the obedient turn only waits for this file.
  await fs.writeFile(stopFileOf(thread), "", "utf8");

  const records = await waitForCards(thread, terminalWith(messageId, "done"));
  const ended = cardFor(records, messageId);
  assert.equal(ended.reason, undefined);
  assert.equal(ended.outcome?.failure, undefined);
  assert.equal(ended.outcome?.costUsd, 0.001);
});

test("an ignoring turn is killed with its whole tree at the end of the grace period, and Continue resumes the same session without a new debit", async (t) => {
  const thread = await turnThread(t, "production");
  fakeClient(thread, "ignore", "0.001");
  const messageId = await mention(thread);
  const card = await runningTurn(thread, messageId);
  const childPid = card.turn?.pid ?? -1;
  const grandchildPid = await grandchildPidOf(thread);

  advance(thread.clock, deadlineOf(card) - thread.clock.ms);
  assert.equal(isAlive(childPid), true, "the stop phase alone does not kill");

  advance(thread.clock, STOP_GRACE_MS);
  await waitUntilGone(childPid);
  await waitUntilGone(grandchildPid);
  const failed = cardFor(
    await waitForCards(thread, terminalWith(messageId, "failed")),
    messageId
  );
  assert.equal(failed.reason, "timeout");
  assert.equal(failed.outcome?.failure, "timeout");

  const reservationsBefore = (await stateOf(thread)).reservations?.length ?? -1;
  fakeClient(thread, "success", "0.001");
  const reply = parseReply(await cardAction(thread, "continue", messageId));
  assert.equal(reply.decision, "started");
  assert.equal(reply.mode, "resume");
  const done = cardFor(
    await waitForCards(thread, terminalWith(messageId, "done")),
    messageId
  );
  assert.equal(done.attempt, 2);

  const argv = await launchedArgv(thread);
  assert.equal(argv.prompt, CONTINUE_PROMPT);
  assert.ok(argv.argv.includes("--resume"));
  assert.equal(
    (await stateOf(thread)).reservations?.length,
    reservationsBefore
  );
});

test("a thread closed under a running turn stops the turn's tree and writes nothing", async (t) => {
  const thread = await turnThread(t, "production");
  fakeClient(thread, "ignore", "0.001");
  const messageId = await mention(thread);
  const card = await runningTurn(thread, messageId);
  const childPid = card.turn?.pid ?? -1;
  const grandchildPid = await grandchildPidOf(thread);

  await fs.writeFile(
    path.join(thread.info.marcPath, "threads", thread.threadId, "SUMMARY.md"),
    "# Closed\n",
    "utf8"
  );
  advance(thread.clock, TEST_HEARTBEAT_MS);

  await waitUntilGone(childPid);
  await waitUntilGone(grandchildPid);
  await thread.daemon.server.turnRunner.idle();
  const records = await cardsOf(thread).catch(() => [] as SupervisionRecord[]);
  assert.equal(
    records.some(
      (record) => record.status === "done" || record.status === "failed"
    ),
    false,
    "a closed thread receives no end of turn"
  );
});

/**
 * A card that is approved and then changed before its turn starts. The runner is held, so the change is
 * the only thing the second pass sees, and the second pass must revoke the card and launch nothing.
 */
const REVOCATIONS: readonly {
  name: string;
  change: (thread: TurnThread) => Promise<void>;
}[] = [
  {
    name: "a policy saved again",
    change: (thread) => putPolicy(thread, POLICY_CHANGED)
  },
  {
    name: "a time limit changed outside the UI",
    change: async (thread) => {
      await fs.writeFile(
        path.join(thread.info.marcPath, "marc.config.json"),
        JSON.stringify({ activation: { turnTimeoutMinutes: 45 } }),
        "utf8"
      );
    }
  }
];

for (const row of REVOCATIONS) {
  test(`a held turn is revoked by the second pass after ${row.name}, and no process starts`, async (t) => {
    const thread = await turnThread(t, "held");
    fakeClient(thread, "success", "0.001");
    const messageId = await mention(thread);
    assert.equal(
      parseReply(await cardAction(thread, "approve", messageId)).decision,
      "started"
    );
    const record = thread.held.find((held) => held.messageId === messageId);
    assert.ok(record, "the held start reached the runner");

    await row.change(thread);
    await thread.daemon.server.turnRunner.start(
      { workspace: thread.info, threadId: thread.threadId },
      record
    );
    await thread.daemon.server.turnRunner.idle();

    const revoked = cardFor(await cardsOf(thread), messageId);
    assert.equal(revoked.status, "failed");
    assert.equal(revoked.reason, "revoked");
    assert.equal(thread.clock.launches, 0, "no process was launched");
    const binding = (await stateOf(thread)).slots[
      `${thread.info.id}:${thread.threadId}:${SECOND}`
    ];
    assert.ok(binding.endedAt !== undefined, "the binding is released");
  });
}

async function putPolicy(thread: TurnThread, body: object): Promise<void> {
  const reply = await send(
    thread.daemon.baseUrl,
    "PUT",
    `${thread.base}/policy`,
    body
  );
  assert.equal(reply.status, 200);
}
