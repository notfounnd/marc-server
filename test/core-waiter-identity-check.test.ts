import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bindingOf,
  CHAIN_TABLE,
  CLIENT,
  HOLDER,
  LISTED_CLIENT,
  STALE_CLIENT,
  WAITER
} from "./core-waiter-identity-fixtures.js";
import {
  IDENTITY_CHECKS,
  waiterIdentityCheck,
  type IdentityCheck,
  type WaiterFacts
} from "../src/core/waiter-identity.js";

/** One row per code: the first failing check names it, and a waiter that passes every check is verified. */
const CHECK_CASES: ReadonlyArray<{
  name: string;
  facts: WaiterFacts;
  expected: IdentityCheck;
}> = [
  {
    name: "a waiter without a pid names no_pid",
    facts: {
      pid: undefined,
      holder: HOLDER,
      binding: bindingOf({ clientPid: CLIENT, clientStartedAt: 1000 }),
      table: CHAIN_TABLE,
      agents: LISTED_CLIENT
    },
    expected: "no_pid"
  },
  {
    name: "a slot without a binding names no_binding",
    facts: {
      pid: WAITER,
      holder: HOLDER,
      binding: undefined,
      table: CHAIN_TABLE,
      agents: LISTED_CLIENT
    },
    expected: "no_binding"
  },
  {
    name: "a holder other than the bound session names session_mismatch",
    facts: {
      pid: WAITER,
      holder: "session-other",
      binding: bindingOf({ clientPid: CLIENT, clientStartedAt: 1000 }),
      table: CHAIN_TABLE,
      agents: LISTED_CLIENT
    },
    expected: "session_mismatch"
  },
  {
    name: "a binding without the client pid names no_client_pid",
    facts: {
      pid: WAITER,
      holder: HOLDER,
      binding: bindingOf({}),
      table: CHAIN_TABLE,
      agents: LISTED_CLIENT
    },
    expected: "no_client_pid"
  },
  {
    name: "an unreadable process table names process_table_unavailable",
    facts: {
      pid: WAITER,
      holder: HOLDER,
      binding: bindingOf({ clientPid: CLIENT, clientStartedAt: 1000 }),
      table: { status: "unavailable", reason: "command_failed" },
      agents: LISTED_CLIENT
    },
    expected: "process_table_unavailable"
  },
  {
    name: "a waiter outside the client's tree names not_descendant",
    facts: {
      pid: 9999,
      holder: HOLDER,
      binding: bindingOf({ clientPid: CLIENT, clientStartedAt: 1000 }),
      table: CHAIN_TABLE,
      agents: LISTED_CLIENT
    },
    expected: "not_descendant"
  },
  {
    name: "an unreadable agents source with a recorded start names agents_unavailable",
    facts: {
      pid: WAITER,
      holder: HOLDER,
      binding: bindingOf({ clientPid: CLIENT, clientStartedAt: 1000 }),
      table: CHAIN_TABLE,
      agents: { status: "unavailable", reason: "runner_failed" }
    },
    expected: "agents_unavailable"
  },
  {
    name: "a client start that differs from the listed one names start_mismatch",
    facts: {
      pid: WAITER,
      holder: HOLDER,
      binding: bindingOf({ clientPid: CLIENT, clientStartedAt: 1000 }),
      table: CHAIN_TABLE,
      agents: STALE_CLIENT
    },
    expected: "start_mismatch"
  },
  {
    name: "a recorded start that the agents do not list names start_mismatch",
    facts: {
      pid: WAITER,
      holder: HOLDER,
      binding: bindingOf({ clientPid: CLIENT, clientStartedAt: 1000 }),
      table: CHAIN_TABLE,
      agents: { status: "available", processes: [] }
    },
    expected: "start_mismatch"
  },
  {
    name: "a binding without a recorded start is verified when the client descends",
    facts: {
      pid: WAITER,
      holder: HOLDER,
      binding: bindingOf({ clientPid: CLIENT }),
      table: CHAIN_TABLE,
      agents: { status: "unavailable", reason: "runner_failed" }
    },
    expected: "verified"
  },
  {
    name: "a recorded start that the agents list is verified",
    facts: {
      pid: WAITER,
      holder: HOLDER,
      binding: bindingOf({ clientPid: CLIENT, clientStartedAt: 1000 }),
      table: CHAIN_TABLE,
      agents: LISTED_CLIENT
    },
    expected: "verified"
  }
];

for (const row of CHECK_CASES) {
  test(`waiter identity check: ${row.name}`, () => {
    assert.equal(waiterIdentityCheck(row.facts), row.expected);
  });
}

test("the identity table covers every code", () => {
  const covered = new Set(CHECK_CASES.map((row) => row.expected));
  assert.deepEqual([...covered].sort(), [...IDENTITY_CHECKS].sort());
});
