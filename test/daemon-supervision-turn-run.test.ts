import assert from "node:assert/strict";
import { test } from "node:test";
import { parseReply } from "./daemon-supervision-fixtures.js";
import {
  cardAction,
  cardFor,
  fakeClient,
  launchedArgv,
  mention,
  slotKeyOf,
  stateOf,
  turnThread,
  waitForCards,
  type TurnThread
} from "./daemon-supervision-turn-fixtures.js";
import { noticeOf } from "./daemon-supervision-turn-probes.js";
import type { SupervisionRecord } from "../src/core/activation-supervision-types.js";

/** Every row is one turn of a fresh thread, and the card it must end in. */
const OUTCOME_ROWS: readonly {
  name: string;
  scenario: string;
  status: "done" | "failed";
  reason?: string;
  /** Undefined when the output was not read: the card then has no cost. */
  costUsd: number | undefined;
  /** The session total the binding keeps: a turn with a valid result records it, any other turn keeps none. */
  lastCostUsd: number | undefined;
}[] = [
  {
    name: "a clean turn ends done with its cost",
    scenario: "success",
    status: "done",
    costUsd: 0.001,
    lastCostUsd: 0.001
  },
  {
    name: "an exit without a result is invalid output",
    scenario: "fail",
    status: "failed",
    reason: "invalid_output",
    costUsd: undefined,
    lastCostUsd: undefined
  },
  {
    name: "malformed JSON is invalid output",
    scenario: "badjson",
    status: "failed",
    reason: "invalid_output",
    costUsd: undefined,
    lastCostUsd: undefined
  },
  {
    name: "another session id is invalid output",
    scenario: "wrongsession",
    status: "failed",
    reason: "invalid_output",
    costUsd: undefined,
    lastCostUsd: undefined
  },
  {
    name: "an error result is an error and keeps its cost",
    scenario: "iserror",
    status: "failed",
    reason: "error",
    costUsd: 0.001,
    lastCostUsd: 0.001
  }
];

function terminal(record: SupervisionRecord | undefined): boolean {
  return record?.status === "done" || record?.status === "failed";
}

for (const row of OUTCOME_ROWS) {
  test(`approved turn: ${row.name}`, async (t) => {
    const thread = await turnThread(t, "production");
    fakeClient(thread, row.scenario, "0.001");
    const messageId = await mention(thread);
    const reply = parseReply(await cardAction(thread, "approve", messageId));
    assert.equal(reply.decision, "started");
    assert.equal(reply.mode, "new");

    const records = await waitForCards(thread, (cards) =>
      terminal(cards.find((card) => card.messageId === messageId))
    );
    const card = cardFor(records, messageId);
    assert.equal(card.status, row.status);
    assert.equal(card.reason, row.reason);
    assert.equal(card.outcome?.costUsd, row.costUsd);
    assert.equal(card.outcome?.failure, row.reason);
    await assertLaunchedAsNew(thread, card);
    await assertBindingReleased(thread, row.lastCostUsd);
  });
}

test("the second mention resumes the session, and its cost is the delta of the total", async (t) => {
  const thread = await turnThread(t, "production");
  fakeClient(thread, "success", "0.001");
  const first = await mention(thread);
  await cardAction(thread, "approve", first);
  await waitForCards(thread, (cards) =>
    terminal(cards.find((card) => card.messageId === first))
  );

  fakeClient(thread, "success", "0.005");
  const second = await mention(thread);
  const reply = parseReply(await cardAction(thread, "approve", second));
  assert.equal(reply.mode, "resume");
  const records = await waitForCards(thread, (cards) =>
    terminal(cards.find((card) => card.messageId === second))
  );
  const card = cardFor(records, second);

  assert.equal(card.status, "done");
  assert.ok(
    Math.abs((card.outcome?.costUsd ?? -1) - 0.004) < 1e-9,
    "the cost is the delta of the total"
  );
  const argv = await launchedArgv(thread);
  assert.equal(argv.mode, "resume");
  assert.ok(argv.argv.includes("--resume"));
  assert.ok(argv.argv.includes("supervision-session"));
  const binding = (await stateOf(thread)).slots[slotKeyOf(thread)];
  assert.equal(binding.lastCostUsd, 0.005);
});

test("a total below the last one counts as a restarted session, so the cost is the whole total", async (t) => {
  const thread = await turnThread(t, "production");
  fakeClient(thread, "success", "0.005");
  const first = await mention(thread);
  await cardAction(thread, "approve", first);
  await waitForCards(thread, (cards) =>
    terminal(cards.find((card) => card.messageId === first))
  );

  fakeClient(thread, "success", "0.002");
  const second = await mention(thread);
  await cardAction(thread, "approve", second);
  const records = await waitForCards(thread, (cards) =>
    terminal(cards.find((card) => card.messageId === second))
  );
  assert.equal(cardFor(records, second).outcome?.costUsd, 0.002);
});

test("a card that is already approved cannot be approved again", async (t) => {
  const thread = await turnThread(t, "production");
  fakeClient(thread, "success", "0.001");
  const messageId = await mention(thread);
  assert.equal(
    parseReply(await cardAction(thread, "approve", messageId)).decision,
    "started"
  );
  const again = await cardAction(thread, "approve", messageId);
  assert.equal(again.status, 409);
  await waitForCards(thread, (cards) =>
    terminal(cards.find((card) => card.messageId === messageId))
  );
});

test("the notice route answers 404 for a run that is not live", async (t) => {
  const thread = await turnThread(t, "production");
  const notice = await noticeOf(thread, "00000000-0000-4000-8000-000000000000");
  assert.equal(notice.status, 404);
});

/** The launch the fake client recorded is a new session, with the run id in its environment and no token. */
async function assertLaunchedAsNew(
  thread: TurnThread,
  card: SupervisionRecord
): Promise<void> {
  const argv = await launchedArgv(thread);
  assert.equal(argv.mode, "new");
  assert.equal(argv.sessionId, "supervision-session");
  assert.equal(argv.runId, card.runId);
  assert.ok(argv.prompt.startsWith("You are the mARC profile"));
  assert.ok(argv.argv.includes("--session-id"));
}

/** The binding is released with endedAt, so the slot is ended, and its last cost is the total the turn reported. */
async function assertBindingReleased(
  thread: TurnThread,
  lastCostUsd: number | undefined
): Promise<void> {
  const binding = (await stateOf(thread)).slots[slotKeyOf(thread)];
  assert.ok(binding.endedAt !== undefined, "the binding is released");
  assert.equal(binding.lastCostUsd, lastCostUsd);
}
