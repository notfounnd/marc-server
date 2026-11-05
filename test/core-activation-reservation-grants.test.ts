import assert from "node:assert/strict";
import test from "node:test";
import { judgeReservation } from "../src/core/activation-reservation.js";
import type { ReservationRequest } from "../src/core/activation-reservation-types.js";
import { closeHolds } from "../src/core/activation-reservation-records.js";
import {
  budgets,
  input,
  OTHER,
  recordOf
} from "./core-activation-reservation-fixtures.js";

const HOLD = { kind: "open" as const, enabled: true, hold: "workspace_paused" };

function requestOf(runId: string): ReservationRequest {
  return {
    messageId: "msg_1",
    recipient: OTHER,
    holder: "session-codex",
    runId
  };
}

/** A grant that a pause retained: the grant stands, and the record reads as held under run-2. */
const retainedGrant = recordOf({
  status: "held",
  reason: "workspace_paused",
  runId: "run-2"
});

test("a retained grant is not a hold: a stage move ends nothing and counts nothing", () => {
  const ended = closeHolds([retainedGrant]);
  assert.deepEqual(
    [ended.dropped, ended.records[0]?.status, ended.records[0]?.granted],
    [0, "held", true]
  );
});

test("a retained run admitted on release spends one attempt and never debits", () => {
  const decision = judgeReservation(
    input({
      request: requestOf("run-2"),
      currentStage: "execution",
      records: [retainedGrant]
    })
  );
  const stored = decision.records[0];
  assert.deepEqual(
    [
      decision.status,
      decision.debit,
      stored?.status,
      stored?.granted,
      stored?.attempts
    ],
    ["granted", 0, "granted", true, 1]
  );
});

test("a new run released after a pause spends one attempt and never debits", () => {
  const decision = judgeReservation(
    input({ request: requestOf("run-3"), records: [retainedGrant] })
  );
  const stored = decision.records[0];
  assert.deepEqual(
    [decision.status, decision.debit, stored?.attempts],
    ["granted", 0, 1]
  );
});

test("a repeated pause on a retained grant writes nothing", () => {
  const decision = judgeReservation(
    input({ request: requestOf("run-2"), gate: HOLD, records: [retainedGrant] })
  );
  assert.deepEqual([decision.status, decision.write], ["held", false]);
});

test("a pause that first holds a fresh record writes once, and the same hold again writes nothing", () => {
  const first = judgeReservation(input({ gate: HOLD }));
  assert.deepEqual([first.status, first.write], ["held", true]);
  const again = judgeReservation(input({ gate: HOLD, records: first.records }));
  assert.deepEqual([again.status, again.write], ["held", false]);
});

test("a pause with a new run on a granted record writes the new run", () => {
  const decision = judgeReservation(
    input({ request: requestOf("run-2"), gate: HOLD, records: [recordOf()] })
  );
  assert.deepEqual(
    [decision.status, decision.write, decision.records[0]?.runId],
    ["held", true, "run-2"]
  );
});

test("an exhausted budget holds the first delivery, and the same hold does not write again", () => {
  const first = judgeReservation(input({ budgets: budgets(5, 5) }));
  const again = judgeReservation(
    input({ budgets: budgets(5, 5), records: first.records })
  );
  assert.deepEqual(
    [first.status, first.write, again.write],
    ["held", true, false]
  );
  assert.equal(again.debit, 0);
});

test("(a) a run held by a pause is counted when it is granted, and its replay spends nothing", () => {
  const granted = judgeReservation(input({ request: requestOf("run-1") }));
  const paused = judgeReservation(
    input({ request: requestOf("run-2"), gate: HOLD, records: granted.records })
  );
  assert.equal(paused.records[0]?.attempts, 0);
  const resumed = judgeReservation(
    input({ request: requestOf("run-2"), records: paused.records })
  );
  assert.deepEqual(
    [resumed.status, resumed.debit, resumed.records[0]?.attempts],
    ["granted", 0, 1]
  );
  const replay = judgeReservation(
    input({ request: requestOf("run-2"), records: resumed.records })
  );
  assert.deepEqual(
    [replay.status, replay.write, replay.records[0]?.attempts],
    ["granted", false, 1]
  );
});

test("(b) a run held at the attempt cap is refused with attempts_exhausted when released", () => {
  const atCap = recordOf({
    runId: "run-2",
    runIds: ["run-1", "run-2"],
    attempts: 2
  });
  const paused = judgeReservation(
    input({ request: requestOf("run-3"), gate: HOLD, records: [atCap] })
  );
  assert.equal(paused.status, "held");
  const released = judgeReservation(
    input({ request: requestOf("run-3"), records: paused.records })
  );
  assert.deepEqual(
    [released.status, released.reason],
    ["refused", "attempts_exhausted"]
  );
});

test("(c) a delayed retry of an admitted run is a replay, and spends nothing", () => {
  const granted = judgeReservation(input({ request: requestOf("run-1") }));
  const paused = judgeReservation(
    input({ request: requestOf("run-2"), gate: HOLD, records: granted.records })
  );
  const resumed = judgeReservation(
    input({ request: requestOf("run-2"), records: paused.records })
  );
  const delayed = judgeReservation(
    input({ request: requestOf("run-1"), records: resumed.records })
  );
  assert.deepEqual(
    [delayed.status, delayed.write, delayed.records[0]?.attempts],
    ["granted", false, 1]
  );
});
