import assert from "node:assert/strict";
import { test } from "node:test";
import type { ProcessTableRead } from "../src/core/process-table.js";
import type { AgentsSource } from "../src/core/session-slots.js";
import {
  waiterIdentityCheck,
  type IdentityCheck,
  type WaiterFacts
} from "../src/core/waiter-identity.js";
import {
  bindingOf,
  CHAIN_TABLE,
  CLIENT,
  HOLDER,
  LISTED_CLIENT,
  WAITER
} from "./core-waiter-identity-fixtures.js";

/** The process that resumed the bound session. It is not the recorded owner, and it starts at its own instant. */
const RESUMED = 200;
const RESUMED_STARTED = 2000;

/** The waiter runs under the resumed process, which is a child of the init process. */
const RESUMED_TABLE: ProcessTableRead = {
  status: "available",
  rows: [
    { pid: WAITER, ppid: RESUMED },
    { pid: RESUMED, ppid: 1 }
  ]
};

/** The waiter runs under the recorded owner only, so the resumed process is outside its chain. */
const OWNER_TABLE: ProcessTableRead = {
  status: "available",
  rows: [
    { pid: WAITER, ppid: CLIENT },
    { pid: CLIENT, ppid: 1 }
  ]
};

/** The listing carries the resumed process with the instant the resume recorded. */
const RESUMED_LISTED: AgentsSource = {
  status: "available",
  processes: [
    {
      pid: RESUMED,
      startedAt: RESUMED_STARTED,
      sessionId: HOLDER,
      status: "idle"
    }
  ]
};

/** The listing after the resumed process restarted: the same pid with a later start. */
const RESUMED_RESTARTED: AgentsSource = {
  status: "available",
  processes: [
    {
      pid: RESUMED,
      startedAt: RESUMED_STARTED + 500,
      sessionId: HOLDER,
      status: "idle"
    }
  ]
};

const RESUMED_BY = { pid: RESUMED, startedAt: RESUMED_STARTED };

/** The binding still names the old owner, as a resume leaves it until the first post. */
const OLD_OWNER = bindingOf({ clientPid: CLIENT, clientStartedAt: 1000 });

const CASES: ReadonlyArray<{
  name: string;
  facts: WaiterFacts;
  expected: IdentityCheck;
}> = [
  {
    name: "a waiter under the resumed process is verified, though the recorded owner is gone",
    facts: {
      pid: WAITER,
      holder: HOLDER,
      binding: OLD_OWNER,
      table: RESUMED_TABLE,
      agents: RESUMED_LISTED,
      resumedBy: RESUMED_BY
    },
    expected: "verified"
  },
  {
    name: "a waiter outside the resumed process's chain names not_descendant, even under the recorded owner",
    facts: {
      pid: WAITER,
      holder: HOLDER,
      binding: OLD_OWNER,
      table: OWNER_TABLE,
      agents: RESUMED_LISTED,
      resumedBy: RESUMED_BY
    },
    expected: "not_descendant"
  },
  {
    name: "a resumed process whose listed start differs names start_mismatch",
    facts: {
      pid: WAITER,
      holder: HOLDER,
      binding: OLD_OWNER,
      table: RESUMED_TABLE,
      agents: RESUMED_RESTARTED,
      resumedBy: RESUMED_BY
    },
    expected: "start_mismatch"
  },
  {
    name: "a resumed process is enough when the binding records no client pid",
    facts: {
      pid: WAITER,
      holder: HOLDER,
      binding: bindingOf({}),
      table: RESUMED_TABLE,
      agents: RESUMED_LISTED,
      resumedBy: RESUMED_BY
    },
    expected: "verified"
  },
  {
    name: "without a resumed process the recorded owner is judged as before",
    facts: {
      pid: WAITER,
      holder: HOLDER,
      binding: OLD_OWNER,
      table: CHAIN_TABLE,
      agents: LISTED_CLIENT
    },
    expected: "verified"
  }
];

for (const row of CASES) {
  test(`resumed client identity: ${row.name}`, () => {
    assert.equal(waiterIdentityCheck(row.facts), row.expected);
  });
}
