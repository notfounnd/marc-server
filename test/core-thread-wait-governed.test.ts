import assert from "node:assert/strict";
import test from "node:test";
import type { ChatMessage } from "../src/core/types.js";
import {
  waitForMention,
  type PortCheck,
  type PortReplies,
  type ReservationPort,
  type ReservationReply,
  type WaitDeps,
  type WaitOptions,
  type WaitOutcome
} from "../src/core/thread-wait.js";

const OK: PortCheck = { ok: true };
const POLLS = Array.from({ length: 1000 }, () => OK);

const timers = {
  setTimer(callback: () => void, delayMs: number) {
    const handle = setTimeout(callback, delayMs);
    return { cancel: () => clearTimeout(handle) };
  }
};

function message(
  id: string,
  agentId: string,
  role: string,
  body: string
): ChatMessage {
  return {
    id,
    threadId: "thread-1",
    timestamp: "2026-11-05T10:00:00.000Z",
    agentId,
    role,
    body,
    artifacts: []
  } as ChatMessage;
}

const CURSOR = message("msg-cursor", "owner", "user", "Start.");
const MENTION = message(
  "msg-mention",
  "claude-software-architect",
  "architect",
  "Review marc://@claude-dev."
);
const MENTION_TWO = message(
  "msg-mention-2",
  "claude-software-architect",
  "architect",
  "Again marc://@claude-dev."
);

function reply(
  messageId: string,
  decision: ReservationReply["decision"],
  reason?: string
): ReservationReply {
  return {
    messageId,
    decision,
    stage: "planning",
    cycle: 1,
    reservation: `${messageId}:claude-dev`,
    reason
  };
}

/** Each call takes the next scripted answer; the scripts are long enough for any test here. */
function portWith(checks: PortCheck[], replies: PortReplies[]) {
  const asked: string[][] = [];
  let checkCalls = 0;
  let replyCalls = 0;
  const port: ReservationPort = {
    check: async () => {
      const value = checks[checkCalls];
      checkCalls += 1;
      return value;
    },
    reserve: async (messageIds) => {
      asked.push([...messageIds]);
      const value = replies[replyCalls];
      replyCalls += 1;
      return value;
    }
  };
  return { port, asked };
}

function depsOf(
  messages: ChatMessage[],
  policyActive: boolean,
  port?: ReservationPort
): WaitDeps {
  return {
    readSnapshot: async () => ({ messages, closed: false, policyActive }),
    watch: () => ({ close() {} }),
    timers,
    reservations: port
  };
}

function optionsOf(timeoutMs: number, maxChain = 3): WaitOptions {
  return {
    afterMessageId: CURSOR.id,
    mention: "claude-dev",
    architects: ["claude-software-architect", "codex-software-architect"],
    maxChain,
    timeoutMs,
    pollMs: 2,
    signal: new AbortController().signal
  };
}

const ok = (replies: ReservationReply[]): PortReplies => ({
  ok: true,
  replies
});

/** The reservations of an outcome; only the governed outcomes carry them. */
function reservationsOf(outcome: WaitOutcome): ReservationReply[] | undefined {
  return (outcome as { reservations?: ReservationReply[] }).reservations;
}

test("a granted reservation releases the mention with its stage, cycle and reservation key", async () => {
  const { port, asked } = portWith(POLLS, [ok([reply(MENTION.id, "granted")])]);
  const outcome = await waitForMention(
    optionsOf(3000),
    depsOf([CURSOR, MENTION], true, port)
  );

  assert.equal(outcome.status, "mention");
  assert.deepEqual(asked, [[MENTION.id]]);
  assert.deepEqual(reservationsOf(outcome), [reply(MENTION.id, "granted")]);
});

test("a held reservation keeps the wait running and asks again on the next poll", async () => {
  const { port, asked } = portWith(POLLS, [
    ok([reply(MENTION.id, "held", "budget_exhausted")]),
    ok([reply(MENTION.id, "granted")])
  ]);
  const outcome = await waitForMention(
    optionsOf(3000),
    depsOf([CURSOR, MENTION], true, port)
  );

  assert.equal(outcome.status, "mention");
  assert.deepEqual(asked, [[MENTION.id], [MENTION.id]]);
});

test("a wait that only sees held reservations times out with the held list and keeps the cursor", async () => {
  const held = Array.from({ length: 1000 }, () =>
    ok([reply(MENTION.id, "held", "budget_exhausted")])
  );
  const { port } = portWith(POLLS, held);
  const outcome = await waitForMention(
    optionsOf(80),
    depsOf([CURSOR, MENTION], true, port)
  );

  assert.equal(outcome.status, "timeout");
  assert.deepEqual(reservationsOf(outcome), [
    reply(MENTION.id, "held", "budget_exhausted")
  ]);
});

test("refused reservations end the wait as activation_refused with a reason per message", async () => {
  const { port } = portWith(POLLS, [
    ok([reply(MENTION.id, "refused", "already_reserved")])
  ]);
  const outcome: WaitOutcome = await waitForMention(
    optionsOf(3000),
    depsOf([CURSOR, MENTION], true, port)
  );

  assert.deepEqual(outcome, {
    status: "activation_refused",
    reservations: [reply(MENTION.id, "refused", "already_reserved")]
  });
});

test("a human-origin mention granted next to a held one still releases the wait", async () => {
  const { port } = portWith(POLLS, [
    ok([
      reply(MENTION.id, "held", "budget_exhausted"),
      reply(MENTION_TWO.id, "granted")
    ])
  ]);
  const outcome = await waitForMention(
    optionsOf(3000),
    depsOf([CURSOR, MENTION, MENTION_TWO], true, port)
  );

  assert.equal(outcome.status, "mention");
  assert.deepEqual(
    reservationsOf(outcome)?.map((item) => item.decision),
    ["held", "granted"]
  );
});

test("the chain brake does not apply in a governed thread: three architect messages still reach the port", async () => {
  const chain = [
    message("msg-a1", "claude-software-architect", "architect", "One."),
    message("msg-a2", "codex-software-architect", "architect", "Two."),
    message("msg-a3", "claude-software-architect", "architect", "Three."),
    MENTION
  ];
  const messages = [CURSOR, ...chain];
  const governed = portWith(POLLS, [ok([reply(MENTION.id, "granted")])]);
  const outcome = await waitForMention(
    optionsOf(3000),
    depsOf(messages, true, governed.port)
  );

  assert.equal(outcome.status, "mention");
  assert.deepEqual(governed.asked, [[MENTION.id]]);
});

test("three architect cycles in a manual thread still end with chain_limit", async () => {
  const chain = [
    message(
      "msg-a1",
      "claude-software-architect",
      "architect",
      "One for marc://@codex-software-architect."
    ),
    message(
      "msg-a2",
      "codex-software-architect",
      "architect",
      "Two for marc://@claude-software-architect."
    ),
    message(
      "msg-a3",
      "claude-software-architect",
      "architect",
      "Three for marc://@codex-software-architect."
    ),
    message(
      "msg-a4",
      "codex-software-architect",
      "architect",
      "Four for marc://@claude-software-architect."
    ),
    message(
      "msg-a5",
      "claude-software-architect",
      "architect",
      "Five for marc://@codex-software-architect."
    ),
    message("msg-a6", "codex-software-architect", "architect", MENTION.body)
  ];
  const outcome = await waitForMention(
    optionsOf(3000),
    depsOf([CURSOR, ...chain], false)
  );

  assert.equal(outcome.status, "chain_limit");
});

test("a daemon that fails the check at a governed tick ends the wait as daemon_unavailable", async () => {
  const { port } = portWith(
    [{ ok: false, status: "daemon_unavailable", reason: "daemon_unreachable" }],
    []
  );
  const outcome = await waitForMention(
    optionsOf(3000),
    depsOf([CURSOR], true, port)
  );

  assert.deepEqual(outcome, {
    status: "daemon_unavailable",
    error: "daemon_unreachable"
  });
});

test("a failed reservation request ends the wait as daemon_unavailable", async () => {
  const { port } = portWith(POLLS, [
    { ok: false, status: "daemon_unavailable", reason: "reservation_http_500" }
  ]);
  const outcome = await waitForMention(
    optionsOf(3000),
    depsOf([CURSOR, MENTION], true, port)
  );

  assert.deepEqual(outcome, {
    status: "daemon_unavailable",
    error: "reservation_http_500"
  });
});

test("a governed thread without a port cannot be served: daemon_unavailable, never a release", async () => {
  const outcome = await waitForMention(
    optionsOf(3000),
    depsOf([CURSOR, MENTION], true)
  );

  assert.deepEqual(outcome, {
    status: "daemon_unavailable",
    error: "port_missing"
  });
});

test("a missing session fails the check as error, not as a daemon outage", async () => {
  const { port } = portWith(
    [{ ok: false, status: "error", reason: "session_required" }],
    []
  );
  const outcome = await waitForMention(
    optionsOf(3000),
    depsOf([CURSOR], true, port)
  );

  assert.deepEqual(outcome, { status: "error", error: "session_required" });
});
