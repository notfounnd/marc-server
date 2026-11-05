import assert from "node:assert/strict";
import type { McpServer } from "@modelcontextprotocol/server";
import { test } from "node:test";
import { z } from "zod";
import {
  deadlineSourceOf,
  type DeadlineField
} from "../src/mcp/deadline-notice.js";
import type { McpOptions } from "../src/mcp/types.js";
import { text } from "../src/mcp/responses.js";
import {
  McpToolCoordinator,
  registerMcpTool
} from "../src/mcp/tool-registration.js";

const ENV_DAEMON = "http://127.0.0.1:1";
const OPTIONS_DAEMON = "http://127.0.0.1:2";
const RUN = "run-9";
const ENV_TOKEN = "env-registration-token";
const OPTIONS_TOKEN = "options-registration-token";
const WARNING: DeadlineField = {
  kind: "warning",
  message:
    "9 minutes left: finish the current change, post your progress and stop"
};

type Request = { url: string; authorization: string | undefined };
type TestResult = { content: Array<{ type: string; text?: string }> };
type TestContext = { mcpReq: { signal: AbortSignal } };
type TestCallback = (
  input: { value: string },
  context: TestContext
) => Promise<TestResult>;

/** The tool's answer when no notice applies: the handler's own response, as the server sends it. */
const PLAIN_TEXT = JSON.stringify({ value: "started" }, null, 2);
const WITH_WARNING_TEXT = JSON.stringify(
  { value: "started", deadline: WARNING },
  null,
  2
);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function recordingFetch(
  requests: Request[],
  reply: () => Response
): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    requests.push({
      url: String(input),
      authorization: headers.get("authorization") ?? undefined
    });
    return reply();
  }) as unknown as typeof fetch;
}

/** The daemon variables of the process environment for one row; an empty value is no connection. */
async function withDaemonEnv<T>(
  daemon: { url: string; token: string },
  run: () => Promise<T>
): Promise<T> {
  const saved = {
    url: process.env.MARC_DAEMON_URL ?? "",
    token: process.env.MARC_TOKEN ?? ""
  };
  process.env.MARC_DAEMON_URL = daemon.url;
  process.env.MARC_TOKEN = daemon.token;
  try {
    return await run();
  } finally {
    process.env.MARC_DAEMON_URL = saved.url;
    process.env.MARC_TOKEN = saved.token;
  }
}

/**
 * Each row registers one tool through registerMcpTool on a server that keeps the callback, calls it, and
 * checks the exact text of the answer and the requests the coordinator's notice source made.
 */
const REGISTRATION_ROWS: readonly {
  name: string;
  options: McpOptions;
  daemon: { url: string; token: string };
  env: NodeJS.ProcessEnv;
  reply: () => Response;
  expectedText: string;
  requests: Request[];
}[] = [
  {
    name: "with a connection from the options and a run, a warning reaches the tool response",
    options: { daemonUrl: OPTIONS_DAEMON, token: OPTIONS_TOKEN },
    daemon: { url: "", token: "" },
    env: { MARC_SUPERVISOR_RUN_ID: RUN },
    reply: () =>
      json({ kind: "warning", minutesLeft: 9, message: WARNING.message }),
    expectedText: WITH_WARNING_TEXT,
    requests: [
      {
        url: `${OPTIONS_DAEMON}/api/supervision/runs/${RUN}/notice`,
        authorization: `Bearer ${OPTIONS_TOKEN}`
      }
    ]
  },
  {
    name: "with a connection from the environment and a run, a warning reaches the tool response",
    options: {},
    daemon: { url: ENV_DAEMON, token: ENV_TOKEN },
    env: { MARC_SUPERVISOR_RUN_ID: RUN },
    reply: () =>
      json({ kind: "warning", minutesLeft: 9, message: WARNING.message }),
    expectedText: WITH_WARNING_TEXT,
    requests: [
      {
        url: `${ENV_DAEMON}/api/supervision/runs/${RUN}/notice`,
        authorization: `Bearer ${ENV_TOKEN}`
      }
    ]
  },
  {
    name: "without a run id, the tool response is unchanged and nothing is requested",
    options: { daemonUrl: OPTIONS_DAEMON, token: OPTIONS_TOKEN },
    daemon: { url: "", token: "" },
    env: {},
    reply: () =>
      json({ kind: "warning", minutesLeft: 9, message: WARNING.message }),
    expectedText: PLAIN_TEXT,
    requests: []
  },
  {
    name: "without a connection, the tool response is unchanged and nothing is requested",
    options: {},
    daemon: { url: "", token: "" },
    env: { MARC_SUPERVISOR_RUN_ID: RUN },
    reply: () =>
      json({ kind: "warning", minutesLeft: 9, message: WARNING.message }),
    expectedText: PLAIN_TEXT,
    requests: []
  },
  {
    name: "with the daemon down, the tool response is unchanged and no error is raised",
    options: { daemonUrl: OPTIONS_DAEMON, token: OPTIONS_TOKEN },
    daemon: { url: "", token: "" },
    env: { MARC_SUPERVISOR_RUN_ID: RUN },
    reply: () => {
      throw new Error("daemon down");
    },
    expectedText: PLAIN_TEXT,
    requests: [
      {
        url: `${OPTIONS_DAEMON}/api/supervision/runs/${RUN}/notice`,
        authorization: `Bearer ${OPTIONS_TOKEN}`
      }
    ]
  }
];

for (const row of REGISTRATION_ROWS) {
  test(`registered tool: ${row.name}`, async () => {
    let callback: TestCallback | undefined;
    const server = {
      registerTool(_name: string, _config: unknown, registered: unknown): void {
        callback = registered as TestCallback;
      }
    } as unknown as McpServer;
    const requests: Request[] = [];
    registerMcpTool(
      server,
      new McpToolCoordinator(
        undefined,
        deadlineSourceOf(
          row.options,
          row.env,
          recordingFetch(requests, row.reply)
        )
      ),
      "probe",
      "Test the deadline notice of a tool response.",
      z.object({ value: z.string() }),
      async () => text({ value: "started" })
    );

    const invoke: TestCallback | undefined = callback;
    assert.ok(invoke);
    const result = await withDaemonEnv(row.daemon, () =>
      invoke(
        { value: "input" },
        { mcpReq: { signal: new AbortController().signal } }
      )
    );
    assert.equal(result.content[0].text, row.expectedText);
    assert.deepEqual(requests, row.requests);
  });
}
