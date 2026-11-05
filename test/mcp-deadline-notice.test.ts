import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deadlineSourceOf,
  withDeadline,
  type DeadlineField
} from "../src/mcp/deadline-notice.js";
import type { McpOptions } from "../src/mcp/types.js";

const ENV_DAEMON = "http://127.0.0.1:1";
const OPTIONS_DAEMON = "http://127.0.0.1:2";
const RUN = "run-7";
const ENV_TOKEN = "env-test-token";
const OPTIONS_TOKEN = "options-test-token";
const WARNING_MESSAGE =
  "9 minutes left: finish the current change, post your progress and stop";
const STOP_MESSAGE =
  "stop now: do not start a new change, post your progress and stop";

type Request = { url: string; authorization: string | undefined };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

/** A fetch that records each request's URL and authorization header, and answers with the row's reply. */
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

/**
 * The daemon variables the process environment carries for one row. An empty value is no value, which is
 * how the MCP connection reads an absent variable. The previous values come back after the row.
 */
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

const NOTICE_PATH = `/api/supervision/runs/${RUN}/notice`;

/**
 * Each row resolves the connection in its own way, asks the notice source once, and expects the notice and
 * the exact requests the source made. An absent connection or run id makes no request at all.
 */
const SOURCE_ROWS: readonly {
  name: string;
  options: McpOptions;
  daemon: { url: string; token: string };
  env: NodeJS.ProcessEnv;
  reply: () => Response;
  expected: DeadlineField | undefined;
  requests: Request[];
}[] = [
  {
    name: "a connection from the options is used, before the environment",
    options: { daemonUrl: OPTIONS_DAEMON, token: OPTIONS_TOKEN },
    daemon: { url: ENV_DAEMON, token: ENV_TOKEN },
    env: { MARC_SUPERVISOR_RUN_ID: RUN },
    reply: () =>
      json({ kind: "warning", minutesLeft: 9, message: WARNING_MESSAGE }),
    expected: { kind: "warning", message: WARNING_MESSAGE },
    requests: [
      {
        url: `${OPTIONS_DAEMON}${NOTICE_PATH}`,
        authorization: `Bearer ${OPTIONS_TOKEN}`
      }
    ]
  },
  {
    name: "a connection from the environment is used when the options give none",
    options: {},
    daemon: { url: ENV_DAEMON, token: ENV_TOKEN },
    env: { MARC_SUPERVISOR_RUN_ID: RUN },
    reply: () => json({ kind: "stop", message: STOP_MESSAGE }),
    expected: { kind: "stop", message: STOP_MESSAGE },
    requests: [
      {
        url: `${ENV_DAEMON}${NOTICE_PATH}`,
        authorization: `Bearer ${ENV_TOKEN}`
      }
    ]
  },
  {
    name: "no connection anywhere: no notice and no request",
    options: {},
    daemon: { url: "", token: "" },
    env: { MARC_SUPERVISOR_RUN_ID: RUN },
    reply: () =>
      json({ kind: "warning", minutesLeft: 9, message: WARNING_MESSAGE }),
    expected: undefined,
    requests: []
  },
  {
    name: "a token without a URL is no connection: no notice and no request",
    options: {},
    daemon: { url: "", token: ENV_TOKEN },
    env: { MARC_SUPERVISOR_RUN_ID: RUN },
    reply: () =>
      json({ kind: "warning", minutesLeft: 9, message: WARNING_MESSAGE }),
    expected: undefined,
    requests: []
  },
  {
    name: "no run id: no notice and no request, even with a connection",
    options: { daemonUrl: OPTIONS_DAEMON, token: OPTIONS_TOKEN },
    daemon: { url: "", token: "" },
    env: {},
    reply: () =>
      json({ kind: "warning", minutesLeft: 9, message: WARNING_MESSAGE }),
    expected: undefined,
    requests: []
  },
  {
    name: "a daemon that is down gives no notice and no error",
    options: { daemonUrl: OPTIONS_DAEMON, token: OPTIONS_TOKEN },
    daemon: { url: "", token: "" },
    env: { MARC_SUPERVISOR_RUN_ID: RUN },
    reply: () => {
      throw new Error("daemon down");
    },
    expected: undefined,
    requests: [
      {
        url: `${OPTIONS_DAEMON}${NOTICE_PATH}`,
        authorization: `Bearer ${OPTIONS_TOKEN}`
      }
    ]
  },
  {
    name: "a running turn has no notice to show",
    options: { daemonUrl: OPTIONS_DAEMON, token: OPTIONS_TOKEN },
    daemon: { url: "", token: "" },
    env: { MARC_SUPERVISOR_RUN_ID: RUN },
    reply: () => json({ kind: "none" }),
    expected: undefined,
    requests: [
      {
        url: `${OPTIONS_DAEMON}${NOTICE_PATH}`,
        authorization: `Bearer ${OPTIONS_TOKEN}`
      }
    ]
  },
  {
    name: "a run that is not live gives no notice and no error",
    options: { daemonUrl: OPTIONS_DAEMON, token: OPTIONS_TOKEN },
    daemon: { url: "", token: "" },
    env: { MARC_SUPERVISOR_RUN_ID: RUN },
    reply: () => json({ error: "run_not_found" }, 404),
    expected: undefined,
    requests: [
      {
        url: `${OPTIONS_DAEMON}${NOTICE_PATH}`,
        authorization: `Bearer ${OPTIONS_TOKEN}`
      }
    ]
  }
];

for (const row of SOURCE_ROWS) {
  test(`deadline source: ${row.name}`, async () => {
    const requests: Request[] = [];
    const source = deadlineSourceOf(
      row.options,
      row.env,
      recordingFetch(requests, row.reply)
    );
    const field = await withDaemonEnv(row.daemon, () => source());
    assert.deepEqual(field, row.expected);
    assert.deepEqual(requests, row.requests);
  });
}

const FIELD: DeadlineField = { kind: "warning", message: WARNING_MESSAGE };

const WITH_ROWS: readonly {
  name: string;
  result: unknown;
  field: DeadlineField | undefined;
  expected: unknown;
}[] = [
  {
    name: "no notice leaves the response as it is",
    result: { content: [{ type: "text", text: '{"ok":true}' }] },
    field: undefined,
    expected: { content: [{ type: "text", text: '{"ok":true}' }] }
  },
  {
    name: "a JSON object response gets the deadline field",
    result: { content: [{ type: "text", text: '{"ok":true}' }] },
    field: FIELD,
    expected: {
      content: [
        {
          type: "text",
          text: JSON.stringify({ ok: true, deadline: FIELD }, null, 2)
        }
      ]
    }
  },
  {
    name: "a plain text response gets the message as one more block",
    result: { content: [{ type: "text", text: "done" }] },
    field: FIELD,
    expected: {
      content: [
        { type: "text", text: "done" },
        { type: "text", text: FIELD.message }
      ]
    }
  },
  {
    name: "a value that is not a tool response is left alone",
    result: "not a result",
    field: FIELD,
    expected: "not a result"
  }
];

for (const row of WITH_ROWS) {
  test(`notice in a response: ${row.name}`, () => {
    assert.deepEqual(withDeadline(row.result, row.field), row.expected);
  });
}
