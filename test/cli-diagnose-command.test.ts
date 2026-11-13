import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { appendMessageInWorkspace } from "../src/core/threads.js";
import {
  productionDiagnoseDeps,
  runDiagnoseCommand,
  type DiagnoseDeps
} from "../src/cli-diagnose-command.js";
import type { OpenValues } from "../src/cli-open-input.js";
import { ARCHITECT, send, TOKEN } from "./daemon-session-http-fixtures.js";
import {
  CODEX,
  mention,
  reservationBody,
  started,
  tableOf,
  TREE
} from "./daemon-activation-reservation-fixtures.js";

const ENV: NodeJS.ProcessEnv = { MARC_TOKEN: TOKEN };

/** The deps of a test: production wiring, with the environment fixed so no outer setting leaks in. */
function depsOf(overrides: Partial<DiagnoseDeps>): DiagnoseDeps {
  return { ...productionDiagnoseDeps(), env: ENV, ...overrides };
}

async function runDiagnose(values: OpenValues, deps: DiagnoseDeps) {
  const lines: string[] = [];
  const exitCode = await runDiagnoseCommand(
    values,
    { print: (line) => lines.push(line) },
    deps
  );
  return {
    exitCode,
    text: lines.join("\n"),
    body: JSON.parse(lines[0]) as Record<string, unknown>
  };
}

/** An address that refuses connections: a port that was listening a moment ago and is closed now. */
async function closedUrl(): Promise<string> {
  const server = http.createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}`;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return url;
}

type Slots = Array<{ profile: string }>;
type Records = Array<{ recipient: string }>;

test("marc diagnose prints the thread view and exits 0 without the token", async (t) => {
  const { daemon, ws } = await started(
    t,
    tableOf({ status: "available", rows: TREE })
  );
  const result = await runDiagnose(
    {
      workspace: ws.root,
      thread: ws.threadId,
      "data-dir": daemon.dataDir,
      "daemon-url": daemon.baseUrl
    },
    depsOf({})
  );
  assert.equal(result.exitCode, 0);
  assert.equal(result.text.includes(TOKEN), false);
  assert.deepEqual(
    (result.body.slots as Slots).map((slot) => slot.profile),
    [CODEX]
  );
});

test("the thread can be named by its eight-character suffix", async (t) => {
  const { daemon, ws } = await started(t);
  const result = await runDiagnose(
    {
      workspace: ws.root,
      thread: ws.threadId.slice(-8),
      "data-dir": daemon.dataDir,
      "daemon-url": daemon.baseUrl
    },
    depsOf({})
  );
  assert.equal(result.exitCode, 0);
  assert.deepEqual(
    (result.body.slots as Slots).map((slot) => slot.profile),
    [CODEX]
  );
});

/** --profile keeps only that profile's slot and the records it wakes; another profile gets nothing. */
const PROFILES: ReadonlyArray<{
  name: string;
  profile: string;
  slots: string[];
  records: number;
}> = [
  {
    name: "the waiting profile keeps its slot and its reservation",
    profile: CODEX,
    slots: [CODEX],
    records: 1
  },
  {
    name: "a profile with no slot and no record gets an empty view",
    profile: ARCHITECT,
    slots: [],
    records: 0
  }
];

for (const row of PROFILES) {
  test(`marc diagnose --profile: ${row.name}`, async (t) => {
    const { daemon, ws, base } = await started(t);
    const message = await appendMessageInWorkspace(ws.info, ws.threadId, {
      agentId: ARCHITECT,
      body: mention(),
      role: "architect"
    });
    await send(
      daemon.baseUrl,
      "POST",
      `${base}/reservations`,
      reservationBody(message.id)
    );
    const result = await runDiagnose(
      {
        workspace: ws.root,
        thread: ws.threadId,
        "data-dir": daemon.dataDir,
        "daemon-url": daemon.baseUrl,
        profile: row.profile
      },
      depsOf({})
    );
    assert.equal(result.exitCode, 0);
    assert.deepEqual(
      (result.body.slots as Slots).map((slot) => slot.profile),
      row.slots
    );
    assert.equal((result.body.reservations as Records).length, row.records);
  });
}

test("a relative workspace path resolves like the absolute one", async (t) => {
  const { daemon, ws } = await started(t);
  const result = await runDiagnose(
    {
      workspace: path.relative(process.cwd(), ws.root),
      thread: ws.threadId,
      "data-dir": daemon.dataDir,
      "daemon-url": daemon.baseUrl
    },
    depsOf({})
  );
  assert.equal(result.exitCode, 0);
  assert.deepEqual(
    (result.body.slots as Slots).map((slot) => slot.profile),
    [CODEX]
  );
});

/** Each refusal exits 5 with its reason, and none of them prints the token. */
const REFUSALS: ReadonlyArray<{
  name: string;
  reason: string;
  env: NodeJS.ProcessEnv;
  url: (urls: { live: string; closed: string }) => string;
  thread: (threadId: string) => string;
}> = [
  {
    name: "a token the daemon refuses",
    reason: "token_rejected",
    env: { MARC_TOKEN: "wrong-token" },
    url: (urls) => urls.live,
    thread: (threadId) => threadId
  },
  {
    name: "no token at all",
    reason: "token_missing",
    env: {},
    url: (urls) => urls.live,
    thread: (threadId) => threadId
  },
  {
    name: "a daemon that is down",
    reason: "daemon_unreachable",
    env: ENV,
    url: (urls) => urls.closed,
    thread: (threadId) => threadId
  },
  {
    name: "a thread that does not exist",
    reason: "thread_not_found",
    env: ENV,
    url: (urls) => urls.live,
    thread: () => "ffffffff"
  }
];

for (const row of REFUSALS) {
  test(`marc diagnose refuses ${row.name} with exit 5`, async (t) => {
    const { daemon, ws } = await started(t);
    const urls = { live: daemon.baseUrl, closed: await closedUrl() };
    const result = await runDiagnose(
      {
        workspace: ws.root,
        thread: row.thread(ws.threadId),
        "data-dir": daemon.dataDir,
        "daemon-url": row.url(urls)
      },
      depsOf({ env: row.env })
    );
    assert.equal(result.exitCode, 5);
    assert.equal(result.body.status, "error");
    assert.equal(result.body.reason, row.reason);
    assert.equal(result.text.includes(TOKEN), false);
  });
}
