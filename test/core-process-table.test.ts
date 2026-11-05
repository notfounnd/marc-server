import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ancestorsOf,
  parseProcessRows,
  type ProcessRow,
  type ProcessTableRead
} from "../src/core/process-table.js";
import {
  judgeProcessView,
  lookupBySession,
  PROCESS_GRACE_MS,
  type ProcessFacts
} from "../src/core/process-identity.js";
import type { AgentsSource } from "../src/core/session-slots.js";

/** A chain of ten processes: each one's parent is the next pid. */
const CHAIN: ProcessRow[] = Array.from({ length: 10 }, (_, index) => ({
  pid: 100 + index,
  ppid: 101 + index
}));

const PARSE_CASES = [
  {
    name: "two integers per line are rows",
    output: "10 1\n11 10\n",
    expected: {
      status: "available",
      rows: [
        { pid: 10, ppid: 1 },
        { pid: 11, ppid: 10 }
      ]
    }
  },
  {
    name: "blank lines and CRLF endings are ignored",
    output: "10 1\r\n\r\n11 10\r\n",
    expected: {
      status: "available",
      rows: [
        { pid: 10, ppid: 1 },
        { pid: 11, ppid: 10 }
      ]
    }
  },
  {
    name: "one malformed line makes the whole table unavailable",
    output: "10 1\nabc 2\n",
    expected: { status: "unavailable", reason: "invalid_output" }
  },
  {
    name: "a line with three fields makes the table unavailable",
    output: "10 1 99\n",
    expected: { status: "unavailable", reason: "invalid_output" }
  },
  {
    name: "an empty listing is unavailable",
    output: "\n  \n",
    expected: { status: "unavailable", reason: "empty_output" }
  }
] as const;

for (const row of PARSE_CASES) {
  test(`process table parsing: ${row.name}`, () => {
    assert.deepEqual(parseProcessRows(row.output), row.expected);
  });
}

const ANCESTOR_CASES: ReadonlyArray<{
  name: string;
  rows: ProcessRow[];
  pid: number;
  expected: number[];
}> = [
  {
    name: "the nearest parent comes first",
    rows: CHAIN,
    pid: 100,
    expected: [101, 102, 103, 104, 105, 106, 107, 108]
  },
  {
    name: "the walk stops at the eighth level",
    rows: CHAIN,
    pid: 101,
    expected: [102, 103, 104, 105, 106, 107, 108, 109]
  },
  {
    name: "a missing parent ends the chain",
    rows: [{ pid: 10, ppid: 99 }],
    pid: 10,
    expected: [99]
  },
  {
    name: "a non-positive parent ends the chain",
    rows: [{ pid: 5, ppid: 0 }],
    pid: 5,
    expected: []
  },
  {
    name: "a cycle in a damaged table ends without looping",
    rows: [
      { pid: 1, ppid: 2 },
      { pid: 2, ppid: 1 }
    ],
    pid: 1,
    expected: [2, 1]
  }
];

for (const row of ANCESTOR_CASES) {
  test(`process ancestry: ${row.name}`, () => {
    assert.deepEqual(ancestorsOf(row.rows, row.pid), row.expected);
  });
}

test("the default climb limit is eight levels", () => {
  assert.equal(ancestorsOf(CHAIN, 100).length, 8);
});

/** The instant of the reading, and two starts: one inside the presence grace, one long past it. */
const NOW = 10_000_000;
const INSIDE_GRACE = NOW - 1_000;
const PAST_GRACE = NOW - 2 * PROCESS_GRACE_MS;

const TABLE_WITH_PID: ProcessTableRead = {
  status: "available",
  rows: [{ pid: 50, ppid: 1 }]
};
const TABLE_WITHOUT_PID: ProcessTableRead = {
  status: "available",
  rows: [{ pid: 60, ppid: 1 }]
};
const TABLE_DOWN: ProcessTableRead = {
  status: "unavailable",
  reason: "command_failed"
};

const LISTED: AgentsSource = {
  status: "available",
  processes: [{ pid: 50, startedAt: 1000, sessionId: "s", status: "idle" }]
};
const LISTED_OTHER_START: AgentsSource = {
  status: "available",
  processes: [{ pid: 50, startedAt: 2000, sessionId: "s", status: "idle" }]
};
const LISTED_OTHER_SESSION: AgentsSource = {
  status: "available",
  processes: [{ pid: 50, startedAt: 1000, sessionId: "other", status: "idle" }]
};
const NOT_LISTED: AgentsSource = { status: "available", processes: [] };
const AGENTS_DOWN: AgentsSource = {
  status: "unavailable",
  reason: "command_failed"
};

/** The facts of a turn process that started at 1000 under session "s", read at NOW, with its grace past. */
const BASE: ProcessFacts = {
  pid: 50,
  startedAt: 1000,
  sessionId: "s",
  since: PAST_GRACE,
  now: NOW,
  agents: LISTED,
  table: TABLE_WITH_PID
};

/** Each row is one reading of the sources, and the view it must give. */
const VIEW_CASES: ReadonlyArray<{
  name: string;
  facts: ProcessFacts;
  expected: string;
}> = [
  {
    name: "a listed pid with the recorded start is alive",
    facts: BASE,
    expected: "alive"
  },
  {
    name: "a listed pid with another start is another process",
    facts: { ...BASE, agents: LISTED_OTHER_START },
    expected: "other"
  },
  {
    name: "a pid missing from the table is gone, whatever the agents say",
    facts: { ...BASE, table: TABLE_WITHOUT_PID },
    expected: "gone"
  },
  {
    name: "a listed pid with the bound session and no start is alive",
    facts: { ...BASE, startedAt: undefined },
    expected: "alive"
  },
  {
    name: "a listed pid with another session and no start is another process",
    facts: { ...BASE, startedAt: undefined, agents: LISTED_OTHER_SESSION },
    expected: "other"
  },
  {
    name: "a listed pid with no start and no session cannot be identified",
    facts: { ...BASE, startedAt: undefined, sessionId: undefined },
    expected: "unknown"
  },
  {
    name: "a pid the table holds but the agents do not list is another process once the grace has ended",
    facts: { ...BASE, agents: NOT_LISTED },
    expected: "other"
  },
  {
    name: "a pid not listed inside the grace of its start may be a fresh process, so it is not decided",
    facts: { ...BASE, agents: NOT_LISTED, since: INSIDE_GRACE },
    expected: "unknown"
  },
  {
    name: "without the table, an unlisted pid after the grace is another process",
    facts: { ...BASE, agents: NOT_LISTED, table: TABLE_DOWN },
    expected: "other"
  },
  {
    name: "without the table, a listed pid is still identified by the agents",
    facts: { ...BASE, table: TABLE_DOWN },
    expected: "alive"
  },
  {
    name: "with the agents unavailable, a pid the table holds is unknown",
    facts: { ...BASE, agents: AGENTS_DOWN },
    expected: "unknown"
  },
  {
    name: "with the agents and the table unavailable, nothing is decided",
    facts: { ...BASE, agents: AGENTS_DOWN, table: TABLE_DOWN },
    expected: "unknown"
  },
  {
    name: "with the agents unavailable, a pid absent from the table is gone",
    facts: { ...BASE, agents: AGENTS_DOWN, table: TABLE_WITHOUT_PID },
    expected: "gone"
  }
];

for (const row of VIEW_CASES) {
  test(`process view: ${row.name}`, () => {
    assert.equal(judgeProcessView(row.facts), row.expected);
  });
}

const SESSION_CASES: ReadonlyArray<{
  name: string;
  agents: AgentsSource;
  expected: string;
}> = [
  {
    name: "one entry for the session is found",
    agents: LISTED,
    expected: "found"
  },
  {
    name: "no entry for the session is absent",
    agents: NOT_LISTED,
    expected: "absent"
  },
  {
    name: "two entries for the session are ambiguous",
    agents: {
      status: "available",
      processes: [
        { pid: 50, startedAt: 1000, sessionId: "s", status: "idle" },
        { pid: 51, startedAt: 1000, sessionId: "s", status: "idle" }
      ]
    },
    expected: "ambiguous"
  },
  {
    name: "unreadable agents are unknown",
    agents: AGENTS_DOWN,
    expected: "unknown"
  }
];

for (const row of SESSION_CASES) {
  test(`session lookup: ${row.name}`, () => {
    assert.equal(lookupBySession(row.agents, "s").status, row.expected);
  });
}
