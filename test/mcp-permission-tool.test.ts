import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ALLOW,
  DENY,
  decisionTextOf,
  denyWith,
  PERMISSION_PROMPT_TOOL,
  permissionLaunchArgs,
  type PermissionDecision
} from "../src/core/supervision-permissions.js";
import {
  permissionDecisionOf,
  permissionResultOf,
  type PermissionDeps,
  type PromptInput
} from "../src/mcp/permission-tool.js";
import type { DaemonConnection } from "../src/mcp/daemon.js";

const RUN = "run-7";
const DAEMON_URL = "http://127.0.0.1:1";
const TOKEN = "permission-test-token";
const CONNECTION: DaemonConnection = { daemonUrl: DAEMON_URL, token: TOKEN };
const PROMPT: PromptInput = {
  tool_name: "Write",
  input: { file_path: "a.txt", content: "A" },
  tool_use_id: "toolu_1"
};
const RUN_ENV = { MARC_SUPERVISOR_RUN_ID: RUN };
const RUN_PATH = `/api/supervision/runs/${RUN}/permissions`;
const CREATE_BODY = {
  pid: 4001,
  ppid: 4000,
  toolName: "Write",
  input: { file_path: "a.txt", content: "A" },
  toolUseId: "toolu_1"
};

type Answer = { kind: "answer"; status: number; body: unknown };
type Unreachable = { kind: "unreachable" };
type Scripted = Answer | Unreachable;

type Call = {
  method: string;
  path: string;
  authorization: string | undefined;
  body: unknown;
};

/** What each scripted reply does, by its kind. A table keeps the fake free of branches. */
const RESPOND: Record<
  Scripted["kind"],
  (reply: Scripted) => Promise<Response>
> = {
  answer: async (reply) => {
    const answer = reply as Answer;
    return new Response(JSON.stringify(answer.body), {
      status: answer.status,
      headers: { "content-type": "application/json" }
    });
  },
  unreachable: async () => {
    throw new TypeError("fetch failed");
  }
};

/** A fetch that answers the script in order, and records every call it receives. */
function scriptedFetch(script: Scripted[], calls: Call[]): typeof fetch {
  let next = 0;
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    calls.push({
      method: init?.method ?? "GET",
      path: url.pathname,
      authorization: headers.get("authorization") ?? undefined,
      body: parsedBodyOf(init)
    });
    const reply = script[next];
    next += 1;
    return RESPOND[reply.kind](reply);
  }) as unknown as typeof fetch;
}

function parsedBodyOf(init: RequestInit | undefined): unknown {
  const raw = init?.body;
  if (typeof raw !== "string") return undefined;
  return JSON.parse(raw);
}

/** A fake clock: sleeping advances it, so a deadline is reached without waiting. */
function fakeClock() {
  const clock = { ms: 0 };
  return {
    now: () => clock.ms,
    sleep: async (ms: number) => {
      clock.ms += ms;
    }
  };
}

const answer = (httpStatus: number, body: unknown): Answer => ({
  kind: "answer",
  status: httpStatus,
  body
});
const UNREACHABLE: Unreachable = { kind: "unreachable" };

type Row = {
  name: string;
  env: Record<string, string | undefined>;
  connection: DaemonConnection | undefined;
  script: Scripted[];
  timeoutMs: number;
  expected: PermissionDecision;
  creates: number;
  polls: number;
};

const ROWS: Row[] = [
  {
    name: "without a run id nothing is asked, and the answer is deny",
    env: {},
    connection: CONNECTION,
    script: [],
    timeoutMs: 600_000,
    expected: denyWith(DENY.notSupervised),
    creates: 0,
    polls: 0
  },
  {
    name: "without a connection nothing is asked, and the answer is deny",
    env: RUN_ENV,
    connection: undefined,
    script: [],
    timeoutMs: 600_000,
    expected: denyWith(DENY.notSupervised),
    creates: 0,
    polls: 0
  },
  {
    name: "the panel allows after one open poll: the exact allow text, one request",
    env: RUN_ENV,
    connection: CONNECTION,
    script: [
      answer(201, { requestId: "req-1" }),
      answer(200, { status: "open" }),
      answer(200, { status: "allow" })
    ],
    timeoutMs: 600_000,
    expected: ALLOW,
    creates: 1,
    polls: 2
  },
  {
    name: "the panel denies with its message",
    env: RUN_ENV,
    connection: CONNECTION,
    script: [
      answer(201, { requestId: "req-1" }),
      answer(200, { status: "deny", message: "denied by the user" })
    ],
    timeoutMs: 600_000,
    expected: denyWith("denied by the user"),
    creates: 1,
    polls: 1
  },
  {
    name: "a deny without a message falls back to not a supervised turn",
    env: RUN_ENV,
    connection: CONNECTION,
    script: [
      answer(201, { requestId: "req-1" }),
      answer(200, { status: "deny" })
    ],
    timeoutMs: 600_000,
    expected: denyWith(DENY.notSupervised),
    creates: 1,
    polls: 1
  },
  {
    name: "the request deadline passes while it is open: deny timeout, the turn is not sent again",
    env: RUN_ENV,
    connection: CONNECTION,
    script: [
      answer(201, { requestId: "req-1" }),
      answer(200, { status: "open" }),
      answer(200, { status: "open" }),
      answer(200, { status: "open" })
    ],
    timeoutMs: 6_000,
    expected: denyWith(DENY.timeout),
    creates: 1,
    polls: 3
  },
  {
    name: "the daemon is unreachable on create: deny daemon_unavailable",
    env: RUN_ENV,
    connection: CONNECTION,
    script: [UNREACHABLE],
    timeoutMs: 600_000,
    expected: denyWith(DENY.daemonUnavailable),
    creates: 1,
    polls: 0
  },
  {
    name: "the daemon is unreachable while waiting: deny daemon_unavailable",
    env: RUN_ENV,
    connection: CONNECTION,
    script: [answer(201, { requestId: "req-1" }), UNREACHABLE],
    timeoutMs: 600_000,
    expected: denyWith(DENY.daemonUnavailable),
    creates: 1,
    polls: 1
  },
  {
    name: "the daemon refuses the claim with 403: deny not a supervised turn",
    env: RUN_ENV,
    connection: CONNECTION,
    script: [answer(403, { error: "not_turn_child" })],
    timeoutMs: 600_000,
    expected: denyWith(DENY.notSupervised),
    creates: 1,
    polls: 0
  },
  {
    name: "the run is gone while waiting, 404 on poll: deny not a supervised turn",
    env: RUN_ENV,
    connection: CONNECTION,
    script: [
      answer(201, { requestId: "req-1" }),
      answer(404, { error: "request_not_found" })
    ],
    timeoutMs: 600_000,
    expected: denyWith(DENY.notSupervised),
    creates: 1,
    polls: 1
  },
  {
    name: "a server error on create: deny daemon_unavailable",
    env: RUN_ENV,
    connection: CONNECTION,
    script: [answer(500, { error: "internal" })],
    timeoutMs: 600_000,
    expected: denyWith(DENY.daemonUnavailable),
    creates: 1,
    polls: 0
  }
];

for (const row of ROWS) {
  test(`permission prompt: ${row.name}`, async () => {
    const calls: Call[] = [];
    const clock = fakeClock();
    const deps: PermissionDeps = {
      env: row.env,
      connection: row.connection,
      pid: 4001,
      ppid: 4000,
      fetch: scriptedFetch(row.script, calls),
      now: clock.now,
      sleep: clock.sleep,
      timeoutMs: row.timeoutMs,
      pollMs: 2_000
    };
    const decision = await permissionDecisionOf(PROMPT, deps);
    assert.deepStrictEqual(decision, row.expected);
    const posts = calls.filter((call) => call.method === "POST");
    const gets = calls.filter((call) => call.method === "GET");
    assert.equal(posts.length, row.creates);
    assert.equal(gets.length, row.polls);
    calls.forEach((call) => {
      assert.equal(call.authorization, `Bearer ${TOKEN}`);
    });
  });
}

test("permission prompt: the create body carries the process pid and parent pid, and the poll reads the same request", async () => {
  const calls: Call[] = [];
  const clock = fakeClock();
  await permissionDecisionOf(PROMPT, {
    env: RUN_ENV,
    connection: CONNECTION,
    pid: 4001,
    ppid: 4000,
    fetch: scriptedFetch(
      [answer(201, { requestId: "req-1" }), answer(200, { status: "allow" })],
      calls
    ),
    now: clock.now,
    sleep: clock.sleep,
    timeoutMs: 600_000,
    pollMs: 2_000
  });
  assert.equal(calls[0].path, RUN_PATH);
  assert.deepStrictEqual(calls[0].body, CREATE_BODY);
  assert.equal(calls[1].path, `${RUN_PATH}/req-1`);
});

test("permission prompt: the tool result is one text block holding the JSON, without structured content", () => {
  assert.deepStrictEqual(permissionResultOf(ALLOW), {
    content: [{ type: "text", text: '{"behavior":"allow"}' }]
  });
  assert.deepStrictEqual(permissionResultOf(denyWith(DENY.timeout)), {
    content: [{ type: "text", text: '{"behavior":"deny","message":"timeout"}' }]
  });
  assert.equal(decisionTextOf(ALLOW), '{"behavior":"allow"}');
});

test("permission prompt: the tool is named after the workspace server, and the launch passes that name", () => {
  assert.equal(PERMISSION_PROMPT_TOOL, "mcp__mcp-marc__permission_prompt");
  assert.deepStrictEqual(permissionLaunchArgs(), [
    "--permission-prompt-tool",
    "mcp__mcp-marc__permission_prompt"
  ]);
});
