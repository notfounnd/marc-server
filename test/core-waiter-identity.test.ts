import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bindingOf,
  CHAIN_TABLE,
  CLIENT,
  deepChain,
  HOLDER,
  LISTED_CLIENT,
  STALE_CLIENT,
  WAITER
} from "./core-waiter-identity-fixtures.js";
import {
  waiterIdentityVerified,
  type WaiterFacts
} from "../src/core/waiter-identity.js";

const CASES: ReadonlyArray<{
  name: string;
  facts: WaiterFacts;
  expected: boolean;
}> = [
  {
    name: "a waiter under the bound client is verified",
    facts: {
      pid: WAITER,
      holder: HOLDER,
      binding: bindingOf({ clientPid: CLIENT }),
      table: CHAIN_TABLE,
      agents: LISTED_CLIENT
    },
    expected: true
  },
  {
    name: "a recorded client start that the agents still list is verified",
    facts: {
      pid: WAITER,
      holder: HOLDER,
      binding: bindingOf({ clientPid: CLIENT, clientStartedAt: 1000 }),
      table: CHAIN_TABLE,
      agents: LISTED_CLIENT
    },
    expected: true
  },
  {
    name: "a chain without the bound client is not verified",
    facts: {
      pid: WAITER,
      holder: HOLDER,
      binding: bindingOf({ clientPid: 999 }),
      table: CHAIN_TABLE,
      agents: LISTED_CLIENT
    },
    expected: false
  },
  {
    name: "a binding without a client pid is not verified",
    facts: {
      pid: WAITER,
      holder: HOLDER,
      binding: bindingOf({}),
      table: CHAIN_TABLE,
      agents: LISTED_CLIENT
    },
    expected: false
  },
  {
    name: "an unreadable process table is not verified",
    facts: {
      pid: WAITER,
      holder: HOLDER,
      binding: bindingOf({ clientPid: CLIENT }),
      table: { status: "unavailable", reason: "command_failed" },
      agents: LISTED_CLIENT
    },
    expected: false
  },
  {
    name: "a client start that differs from the recorded one is not verified",
    facts: {
      pid: WAITER,
      holder: HOLDER,
      binding: bindingOf({ clientPid: CLIENT, clientStartedAt: 1000 }),
      table: CHAIN_TABLE,
      agents: STALE_CLIENT
    },
    expected: false
  },
  {
    name: "a recorded client start with the agents down is not verified",
    facts: {
      pid: WAITER,
      holder: HOLDER,
      binding: bindingOf({ clientPid: CLIENT, clientStartedAt: 1000 }),
      table: CHAIN_TABLE,
      agents: { status: "unavailable", reason: "command_failed" }
    },
    expected: false
  },
  {
    name: "a holder that is not the slot's native session is not verified",
    facts: {
      pid: WAITER,
      holder: "another-session",
      binding: bindingOf({ clientPid: CLIENT }),
      table: CHAIN_TABLE,
      agents: LISTED_CLIENT
    },
    expected: false
  },
  {
    name: "a missing waiter pid is not verified",
    facts: {
      pid: undefined,
      holder: HOLDER,
      binding: bindingOf({ clientPid: CLIENT }),
      table: CHAIN_TABLE,
      agents: LISTED_CLIENT
    },
    expected: false
  },
  {
    name: "a missing binding is not verified",
    facts: {
      pid: WAITER,
      holder: HOLDER,
      binding: undefined,
      table: CHAIN_TABLE,
      agents: LISTED_CLIENT
    },
    expected: false
  },
  {
    name: "the client at the eighth level above the waiter is verified",
    facts: {
      pid: 1000,
      holder: HOLDER,
      binding: bindingOf({ clientPid: 992 }),
      table: { status: "available", rows: deepChain(8) },
      agents: LISTED_CLIENT
    },
    expected: true
  },
  {
    name: "the client at the ninth level above the waiter is not verified",
    facts: {
      pid: 1000,
      holder: HOLDER,
      binding: bindingOf({ clientPid: 991 }),
      table: { status: "available", rows: deepChain(9) },
      agents: LISTED_CLIENT
    },
    expected: false
  }
];

for (const row of CASES) {
  test(`waiter identity: ${row.name}`, () => {
    assert.equal(waiterIdentityVerified(row.facts), row.expected);
  });
}
