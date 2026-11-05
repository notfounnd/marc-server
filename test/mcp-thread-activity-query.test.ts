import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import test from "node:test";
import { writeThreadSummary } from "../src/core/workspace.js";
import { UNAVAILABLE_LINE } from "../src/core/thread-activity-markdown.js";
import { fetchThreadActivity } from "../src/mcp/daemon.js";
import {
  TOKEN,
  registered,
  startDaemon,
  workspaceWithThread
} from "./daemon-session-http-fixtures.js";

/**
 * The daemon variables are read from the environment when the options omit them. Each test
 * clears them first, so the result never depends on the shell that runs the suite.
 */
const DAEMON_VARIABLES = ["MARC_DAEMON_URL", "MARC_TOKEN"] as const;

function clearDaemonEnvironment(t: { after(fn: () => unknown): void }): void {
  const saved = Object.fromEntries(
    DAEMON_VARIABLES.map((name) => [name, process.env[name]]).filter(
      ([, value]) => value !== undefined
    )
  );
  clearVariables();
  t.after(() => {
    clearVariables();
    Object.assign(process.env, saved);
  });
}

function clearVariables(): void {
  for (const name of DAEMON_VARIABLES) delete process.env[name];
}

/** A listener that accepts connections and never answers, so only the query limit can end it. */
async function silentDaemon(t: {
  after(fn: () => unknown): void;
}): Promise<string> {
  const server = http.createServer(() => undefined);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function summaryFor(
  root: string,
  threadId: string,
  activity: Parameters<typeof writeThreadSummary>[1]["activity"]
): Promise<string> {
  await writeThreadSummary(root, { threadId, body: "Closed.", activity });
  return fs.readFile(
    path.join(root, ".marc", "threads", threadId, "SUMMARY.md"),
    "utf8"
  );
}

test("with no daemon configured there is nothing to record: no query result and no Activity section", async (t) => {
  clearDaemonEnvironment(t);
  const ws = await workspaceWithThread();
  t.after(() => fs.rm(ws.root, { recursive: true, force: true }));

  const activity = await fetchThreadActivity({}, ws.root, ws.threadId);
  const summary = await summaryFor(ws.root, ws.threadId, activity);

  assert.equal(activity, undefined);
  assert.equal(summary.includes("## Activity"), false);
  assert.equal(summary.includes(UNAVAILABLE_LINE), false);
});

test("a configured daemon that refuses the connection records the explicit unavailable line", async (t) => {
  clearDaemonEnvironment(t);
  const ws = await workspaceWithThread();
  t.after(() => fs.rm(ws.root, { recursive: true, force: true }));

  const activity = await fetchThreadActivity(
    { daemonUrl: "http://127.0.0.1:9", token: TOKEN },
    ws.root,
    ws.threadId
  );
  const summary = await summaryFor(ws.root, ws.threadId, activity);

  assert.deepEqual(activity, { status: "unavailable" });
  assert.ok(summary.includes(`## Activity\n\n${UNAVAILABLE_LINE}`));
});

test("a configured daemon that never answers within the query limit records the unavailable line and does not block", async (t) => {
  clearDaemonEnvironment(t);
  const ws = await workspaceWithThread();
  t.after(() => fs.rm(ws.root, { recursive: true, force: true }));
  const url = await silentDaemon(t);

  const started = Date.now();
  const activity = await fetchThreadActivity(
    { daemonUrl: url, token: TOKEN },
    ws.root,
    ws.threadId
  );
  const elapsed = Date.now() - started;

  assert.deepEqual(activity, { status: "unavailable" });
  assert.ok(elapsed < 5000, `the query returned after ${elapsed} ms`);
});

test("a configured daemon that answers records the snapshot", async (t) => {
  clearDaemonEnvironment(t);
  const daemon = await startDaemon();
  t.after(() => daemon.close());
  const ws = await workspaceWithThread();
  t.after(() => fs.rm(ws.root, { recursive: true, force: true }));
  await registered(daemon, ws.info);

  const activity = await fetchThreadActivity(
    { daemonUrl: daemon.baseUrl, token: TOKEN },
    ws.root,
    ws.threadId
  );

  assert.equal(activity?.status, "recorded");
});
