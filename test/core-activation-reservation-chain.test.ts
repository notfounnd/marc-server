import assert from "node:assert/strict";
import test from "node:test";
import { judgeReservation } from "../src/core/activation-reservation.js";
import {
  ARCHITECT,
  OTHER,
  T2,
  budgets,
  input,
  message,
  picked,
  recordOf
} from "./core-activation-reservation-fixtures.js";

test("a reverse mention closes the open cycle without a debit", () => {
  const first = judgeReservation(input());
  const reply = judgeReservation(
    input({
      request: {
        messageId: "msg_2",
        recipient: ARCHITECT,
        holder: "session-claude",
        runId: "run-2"
      },
      message: message({ author: OTHER, timestamp: T2 }),
      records: first.records,
      budgets: budgets(1, 5)
    })
  );
  assert.deepEqual(picked(reply, ["status", "cycle", "debit", "write"]), {
    status: "granted",
    cycle: 1,
    debit: 0,
    write: true
  });
  assert.equal(
    reply.records.find((record) => record.messageId === "msg_1")?.cycleState,
    "closed"
  );
});

test("a repeated mention in the same direction supersedes the open cycle and opens cycle 2", () => {
  const first = judgeReservation(input());
  const repeat = judgeReservation(
    input({
      request: {
        messageId: "msg_3",
        recipient: OTHER,
        holder: "session-codex",
        runId: "run-3"
      },
      message: message({ timestamp: T2 }),
      records: first.records,
      budgets: budgets(1, 5)
    })
  );
  assert.deepEqual(picked(repeat, ["status", "cycle", "debit"]), {
    status: "granted",
    cycle: 2,
    debit: 1
  });
  assert.equal(
    repeat.records.find((record) => record.messageId === "msg_1")?.cycleState,
    "superseded"
  );
});

test("a close is not refused by an exhausted budget", () => {
  const first = judgeReservation(input());
  const reply = judgeReservation(
    input({
      request: {
        messageId: "msg_2",
        recipient: ARCHITECT,
        holder: "session-claude",
        runId: "run-2"
      },
      message: message({ author: OTHER, timestamp: T2 }),
      records: first.records,
      budgets: budgets(5, 5)
    })
  );
  assert.deepEqual(picked(reply, ["status", "cycle", "debit"]), {
    status: "granted",
    cycle: 1,
    debit: 0
  });
});

test("a UI-origin mention neither opens nor closes a cycle", () => {
  const first = judgeReservation(input());
  const ui = judgeReservation(
    input({
      request: {
        messageId: "msg_2",
        recipient: ARCHITECT,
        holder: "session-claude",
        runId: "run-2"
      },
      message: message({ author: "ui-user", timestamp: T2 }),
      uiMessage: true,
      authorIsArchitect: false,
      records: first.records
    })
  );
  assert.equal(ui.status, "granted");
  assert.equal(ui.debit, 0);
  assert.equal(
    ui.records.find((record) => record.messageId === "msg_1")?.cycleState,
    "open"
  );
});

test("a replay of an admitted run is granted and writes nothing", () => {
  const decision = judgeReservation(input({ records: [recordOf()] }));
  assert.deepEqual(picked(decision, ["status", "cycle", "debit", "write"]), {
    status: "granted",
    cycle: 1,
    debit: 0,
    write: false
  });
});

test("a new run of a granted record spends one attempt and never debits", () => {
  const decision = judgeReservation(
    input({
      request: {
        messageId: "msg_1",
        recipient: OTHER,
        holder: "session-codex",
        runId: "run-2"
      },
      records: [recordOf()]
    })
  );
  const stored = decision.records[0];
  assert.deepEqual(
    [decision.status, decision.debit, stored?.attempts, stored?.runIds],
    ["granted", 0, 1, ["run-1", "run-2"]]
  );
});

test("a new run at the attempt cap is refused with attempts_exhausted", () => {
  const decision = judgeReservation(
    input({
      request: {
        messageId: "msg_1",
        recipient: OTHER,
        holder: "session-codex",
        runId: "run-4"
      },
      records: [recordOf({ attempts: 2, runIds: ["run-1", "run-2", "run-3"] })]
    })
  );
  assert.deepEqual(picked(decision, ["status", "reason", "debit"]), {
    status: "refused",
    reason: "attempts_exhausted",
    debit: 0
  });
});

test("an older admitted run after a newer one replays and spends nothing", () => {
  const decision = judgeReservation(
    input({
      request: {
        messageId: "msg_1",
        recipient: OTHER,
        holder: "session-codex",
        runId: "run-1"
      },
      records: [
        recordOf({ runId: "run-2", runIds: ["run-1", "run-2"], attempts: 1 })
      ]
    })
  );
  assert.deepEqual(picked(decision, ["status", "write"]), {
    status: "granted",
    write: false
  });
  assert.equal(decision.records[0]?.attempts, 1);
});

test("another holder is refused with already_reserved and writes nothing", () => {
  const decision = judgeReservation(
    input({ records: [recordOf({ holder: "session-other" })] })
  );
  assert.deepEqual(picked(decision, ["status", "reason", "write"]), {
    status: "refused",
    reason: "already_reserved",
    write: false
  });
});

test("a granted redelivery held by a pause keeps its grant and its cycle", () => {
  const decision = judgeReservation(
    input({
      request: {
        messageId: "msg_1",
        recipient: OTHER,
        holder: "session-codex",
        runId: "run-2"
      },
      gate: { kind: "open", enabled: true, hold: "workspace_paused" },
      records: [recordOf()]
    })
  );
  const stored = decision.records[0];
  assert.deepEqual(
    [decision.status, stored?.status, stored?.granted, stored?.cycle],
    ["held", "held", true, 1]
  );
});

test("a held poll is judged again and granted when the budget frees, without an attempt", () => {
  const held = recordOf({
    status: "held",
    granted: false,
    cycle: undefined,
    cycleRole: "none",
    cycleState: undefined,
    runIds: [],
    reason: "budget_exhausted"
  });
  const decision = judgeReservation(
    input({ records: [held], budgets: budgets(4, 5) })
  );
  assert.deepEqual(picked(decision, ["status", "cycle", "debit"]), {
    status: "granted",
    cycle: 5,
    debit: 1
  });
  assert.equal(decision.records[0]?.attempts, 0);
});

test("a hold from an earlier stage is ended with stage_advanced", () => {
  const held = recordOf({
    status: "held",
    granted: false,
    runIds: [],
    cycleRole: "none",
    cycle: undefined,
    cycleState: undefined
  });
  const decision = judgeReservation(
    input({ currentStage: "execution", records: [held] })
  );
  assert.deepEqual(picked(decision, ["status", "reason"]), {
    status: "refused",
    reason: "stage_advanced"
  });
  assert.equal(decision.records[0]?.status, "refused");
});

test("the pruning floor only moves forward when records are pruned", () => {
  const records = Array.from({ length: 201 }, (_, index) =>
    recordOf({
      messageId: `msg_${index}`,
      cycleRole: "none",
      cycleState: undefined,
      cycle: undefined,
      messageAt: `2026-11-05T09:${String(index % 60).padStart(2, "0")}:00.000Z`
    })
  );
  const decision = judgeReservation(
    input({
      request: {
        messageId: "msg_new",
        recipient: OTHER,
        holder: "session-codex",
        runId: "run-x"
      },
      records,
      prunedThrough: "2030-01-01T00:00:00.000Z"
    })
  );
  assert.equal(decision.prunedThrough, "2030-01-01T00:00:00.000Z");
  assert.ok(decision.records.length <= 200);
});
