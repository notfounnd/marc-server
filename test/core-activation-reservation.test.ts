import assert from "node:assert/strict";
import test from "node:test";
import { judgeReservation } from "../src/core/activation-reservation.js";
import {
  T1,
  budgets,
  input,
  message,
  picked
} from "./core-activation-reservation-fixtures.js";
import type { OriginMessage } from "../src/core/activation-reservation-types.js";
import type { ReservationInput } from "../src/core/activation-reservation.js";

type Row = {
  name: string;
  input: Partial<ReservationInput>;
  expect: Record<string, unknown>;
};

/** Steps 1 to 7 of decision 12, one row each. The first answering step decides. */
const DISPATCH_ROWS: readonly Row[] = [
  {
    name: "an architect mention opens cycle 1 and debits one",
    input: {},
    expect: {
      status: "granted",
      stage: "planning",
      cycle: 1,
      debit: 1,
      write: true
    }
  },
  {
    name: "a UI-origin mention is granted with no debit and no cycle",
    input: {
      uiMessage: true,
      authorIsArchitect: false,
      message: message({ author: "ui-user" })
    },
    expect: { status: "granted", cycle: undefined, debit: 0, write: true }
  },
  {
    name: "a developer author is ineligible and writes nothing",
    input: {
      authorIsArchitect: false,
      message: message({ author: "claude-dev" })
    },
    expect: { status: "refused", reason: "ineligible_origin", write: false }
  },
  {
    name: "a recipient the message does not mention is ineligible",
    input: { message: message({ mentionsRecipient: false }) },
    expect: { status: "refused", reason: "ineligible_origin", write: false }
  },
  {
    name: "a message missing from CHAT.md is ineligible",
    input: { message: undefined },
    expect: { status: "refused", reason: "ineligible_origin", write: false }
  },
  {
    name: "a closed thread refuses before any other check",
    input: { gate: { kind: "closed" }, message: undefined },
    expect: { status: "refused", reason: "thread_closed", write: false }
  },
  {
    name: "a lost state holds without writing",
    input: { gate: { kind: "unreadable", reason: "ledger_lost" } },
    expect: { status: "held", reason: "ledger_lost", debit: 0, write: false }
  },
  {
    name: "an invalid state holds without writing",
    input: { gate: { kind: "unreadable", reason: "ledger_invalid" } },
    expect: { status: "held", reason: "ledger_invalid", debit: 0, write: false }
  },
  {
    name: "a disabled policy refuses and writes nothing",
    input: { gate: { kind: "open", enabled: false } },
    expect: { status: "refused", reason: "policy_disabled", write: false }
  },
  {
    name: "a workspace pause holds and records the hold",
    input: { gate: { kind: "open", enabled: true, hold: "workspace_paused" } },
    expect: {
      status: "held",
      reason: "workspace_paused",
      debit: 0,
      write: true
    }
  },
  {
    name: "a state that resolves in the panel holds with its reason",
    input: { gate: { kind: "open", enabled: true, hold: "policy_tampered" } },
    expect: { status: "held", reason: "policy_tampered", write: true }
  },
  {
    name: "an exhausted budget holds with budget_exhausted and no cycle",
    input: { budgets: budgets(5, 5) },
    expect: {
      status: "held",
      reason: "budget_exhausted",
      cycle: undefined,
      debit: 0,
      write: true
    }
  },
  {
    name: "the budget of the stamped origin stage decides, not the current stage",
    input: {
      message: message({ stage: "execution" }),
      budgets: { ...budgets(5, 5), execution: { used: 0, max: 5 } }
    },
    expect: { status: "granted", stage: "execution", cycle: 1, debit: 1 }
  },
  {
    name: "closed beats a missing message: the thread check runs first",
    input: { gate: { kind: "closed" }, message: undefined },
    expect: { reason: "thread_closed" }
  }
];

for (const row of DISPATCH_ROWS) {
  test(`dispatch: ${row.name}`, () => {
    const decision = judgeReservation(input(row.input));
    assert.deepEqual(picked(decision, Object.keys(row.expect)), row.expect);
  });
}

test("a message at the pruning floor with no record has expired, the boundary is inclusive", () => {
  const decision = judgeReservation(input({ prunedThrough: T1 }));
  assert.deepEqual(picked(decision, ["status", "reason", "write"]), {
    status: "refused",
    reason: "reservation_expired",
    write: false
  });
});

test("a message after the pruning floor is judged normally", () => {
  const decision = judgeReservation(
    input({ prunedThrough: "2026-11-05T10:00:00.000Z" })
  );
  assert.deepEqual(picked(decision, ["status", "cycle"]), {
    status: "granted",
    cycle: 1
  });
});

test("a stamped origin stage is the stage the decision reports", () => {
  const stamped: OriginMessage = message({ stage: "review" });
  const decision = judgeReservation(
    input({ message: stamped, budgets: budgets(0, 5) })
  );
  assert.equal(decision.stage, "review");
});
