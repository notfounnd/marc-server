import assert from "node:assert/strict";
import test from "node:test";
import {
  AGENTS_CACHE_MS,
  LISTENING_STALE_MS,
  createSessionPresence,
  mcpLeaseSources,
  parseAgentsOutput,
  resolveIdentityFrom
} from "../src/daemon/presence.js";
import type { AgentsSource } from "../src/core/session-slots.js";
import type { DaemonLease } from "../src/core/types.js";
import {
  HOST,
  NOW,
  SESSION_A,
  SESSION_B,
  STARTED,
  UNAVAILABLE,
  entry,
  live
} from "./daemon-session-fixtures.js";

const LIVE_OUTPUT = JSON.stringify([
  {
    pid: 14920,
    cwd: "C:\\Projetos\\marc",
    kind: "interactive",
    startedAt: STARTED,
    sessionId: SESSION_A,
    name: "marc",
    status: "busy"
  }
]);

const PARSE_ROWS: Array<{
  name: string;
  output: string;
  expected: AgentsSource;
}> = [
  {
    name: "reads a live interactive session with its status",
    output: LIVE_OUTPUT,
    expected: {
      status: "available",
      processes: [
        { pid: 14920, startedAt: STARTED, sessionId: SESSION_A, status: "busy" }
      ]
    }
  },
  {
    name: "drops an entry without a pid, which is not a live process",
    output: JSON.stringify([
      { startedAt: STARTED, sessionId: SESSION_A, status: "idle" }
    ]),
    expected: { status: "available", processes: [] }
  },
  {
    name: "a valid list with a background entry without a pid stays available",
    output: JSON.stringify([
      { pid: 14920, startedAt: STARTED, sessionId: SESSION_A, status: "busy" },
      { startedAt: STARTED, sessionId: SESSION_B, status: "idle" }
    ]),
    expected: {
      status: "available",
      processes: [
        { pid: 14920, startedAt: STARTED, sessionId: SESSION_A, status: "busy" }
      ]
    }
  },
  {
    name: "a null pid is treated as no pid and skipped",
    output: JSON.stringify([
      { pid: null, startedAt: STARTED, sessionId: SESSION_A }
    ]),
    expected: { status: "available", processes: [] }
  },
  {
    name: "a pid entry without startedAt makes the inventory incomplete",
    output: JSON.stringify([
      { pid: 14920, sessionId: SESSION_A, status: "busy" }
    ]),
    expected: { status: "unavailable", reason: "incomplete_inventory" }
  },
  {
    name: "a pid that is not an integer makes the inventory incomplete",
    output: JSON.stringify([
      { pid: "14920", startedAt: STARTED, sessionId: SESSION_A }
    ]),
    expected: { status: "unavailable", reason: "incomplete_inventory" }
  },
  {
    name: "an entry that is not an object makes the inventory incomplete",
    output: JSON.stringify(["14920"]),
    expected: { status: "unavailable", reason: "incomplete_inventory" }
  },
  {
    name: "rejects output that is not an array",
    output: JSON.stringify({ sessions: [] }),
    expected: { status: "unavailable", reason: "invalid_output" }
  },
  {
    name: "rejects output that is not JSON",
    output: "claude: command not found",
    expected: { status: "unavailable", reason: "invalid_output" }
  }
];

for (const row of PARSE_ROWS) {
  test(`agents reader: ${row.name}`, () => {
    assert.deepEqual(parseAgentsOutput(row.output), row.expected);
  });
}

test("the agents snapshot is cached for the cache window and then refreshed", async () => {
  const clock = { ms: NOW };
  let calls = 0;
  const presence = createSessionPresence({
    hostId: HOST,
    now: () => clock.ms,
    runAgents: async () => {
      calls += 1;
      return LIVE_OUTPUT;
    }
  });
  await presence.agents();
  clock.ms = NOW + 1000;
  await presence.agents();
  assert.equal(calls, 1);
  clock.ms = NOW + AGENTS_CACHE_MS;
  await presence.agents();
  assert.equal(calls, 2);
});

test("a failing agents command yields an unavailable source, not an error", async () => {
  const presence = createSessionPresence({
    hostId: HOST,
    now: () => NOW,
    runAgents: async () => {
      throw new Error("spawn claude ENOENT");
    }
  });
  assert.deepEqual(await presence.agents(), UNAVAILABLE);
});

const IDENTITY_ROWS: Array<
  [
    string,
    Parameters<typeof resolveIdentityFrom>[0],
    string,
    string | undefined,
    number | undefined
  ]
> = [
  [
    "a listed client process at ppid is authoritative and verified",
    live([entry(100, SESSION_A)]),
    SESSION_A,
    undefined,
    STARTED
  ],
  [
    "after /clear the listed session replaces the environment session and keeps it for diagnosis",
    live([entry(100, SESSION_B)]),
    SESSION_B,
    SESSION_A,
    STARTED
  ],
  [
    "without a listed process the environment session is used and not verified",
    live([]),
    SESSION_A,
    undefined,
    undefined
  ],
  [
    "an unavailable source falls back to the environment session",
    UNAVAILABLE,
    SESSION_A,
    undefined,
    undefined
  ]
];

for (const [
  name,
  agents,
  sessionId,
  envSessionId,
  startedAt
] of IDENTITY_ROWS) {
  test(`identity resolution: ${name}`, () => {
    const resolved = resolveIdentityFrom(agents, {
      nativeSessionId: SESSION_A,
      pid: 200,
      ppid: 100,
      hostId: HOST
    });
    assert.equal(resolved.nativeSessionId, sessionId);
    assert.equal(resolved.envSessionId, envSessionId);
    assert.equal(resolved.clientStartedAt, startedAt);
    assert.equal(resolved.clientPid, 100);
  });
}

function lease(overrides: Partial<DaemonLease>): DaemonLease {
  return {
    clientId: "mcp-1",
    clientType: "mcp",
    workspaceId: "ws-1",
    startedAt: new Date(NOW).toISOString(),
    lastSeenAt: new Date(NOW).toISOString(),
    expiresAt: new Date(NOW + 45_000).toISOString(),
    nativeSessionId: SESSION_A,
    client: "claude-code",
    pid: 200,
    ppid: 100,
    hostId: HOST,
    identifiedAt: new Date(NOW).toISOString(),
    ...overrides
  };
}

test("only identified, unexpired leases of the same workspace count as MCP presence", () => {
  const leases = [
    lease({ clientId: "ok" }),
    lease({ clientId: "unidentified", identifiedAt: undefined }),
    lease({ clientId: "other-workspace", workspaceId: "ws-2" }),
    lease({ clientId: "expired", expiresAt: new Date(NOW - 1).toISOString() })
  ];
  assert.deepEqual(mcpLeaseSources(leases, "ws-1", NOW), [
    { nativeSessionId: SESSION_A, pid: 200, hostId: HOST }
  ]);
});

test("listening checks the wait lock of the same resource string the wait command uses", async () => {
  const seen: Array<[string, string, number]> = [];
  const presence = createSessionPresence({
    hostId: HOST,
    now: () => NOW,
    runAgents: async () => "[]",
    lockActive: async (marcPath, resource, staleAfterMs) => {
      seen.push([marcPath, resource, staleAfterMs]);
      return true;
    }
  });
  assert.equal(
    await presence.listening("/work/.marc", "thread-1", SESSION_A),
    true
  );
  assert.deepEqual(seen, [
    ["/work/.marc", `wait:thread-1:${SESSION_A}`, LISTENING_STALE_MS]
  ]);
});
