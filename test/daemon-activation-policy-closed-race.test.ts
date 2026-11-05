import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  threadWriteResource,
  withWorkspaceWriteLock
} from "../src/core/write-coordination.js";
import {
  registered,
  send,
  startDaemon,
  workspaceWithThread
} from "./daemon-session-http-fixtures.js";

const POLICY_BODY = { enabled: true, attemptCap: 2, pendingTtlMinutes: 1440 };

function gate(): { promise: Promise<void>; open: () => void } {
  let open = (): void => undefined;
  const promise = new Promise<void>((resolve) => {
    open = () => resolve();
  });
  return { promise, open };
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function exists(filePath: string): Promise<boolean> {
  return fs.access(filePath).then(
    () => true,
    () => false
  );
}

test("a save that loses the race to the summary is refused by the write, and leaves no policy.json", async (t) => {
  const daemon = await startDaemon();
  t.after(() => daemon.close());
  const ws = await workspaceWithThread();
  t.after(() => fs.rm(ws.root, { recursive: true, force: true }));
  await registered(daemon, ws.info);
  const base = `/api/workspaces/${ws.info.id}/threads/${ws.threadId}/activation`;
  const threadFolder = path.join(ws.root, ".marc", "threads", ws.threadId);
  const policyFile = path.join(threadFolder, "policy.json");
  const summaryFile = path.join(threadFolder, "SUMMARY.md");

  const held = gate();
  const release = gate();
  const lock = withWorkspaceWriteLock(
    ws.info.marcPath,
    threadWriteResource(ws.threadId),
    () => {
      held.open();
      return release.promise;
    }
  );
  await held.promise;
  const pending = send(daemon.baseUrl, "PUT", `${base}/policy`, POLICY_BODY);
  await pause(150);
  await fs.writeFile(summaryFile, "# Closed\n\nDone.\n");
  release.open();
  await lock;
  const reply = await pending;

  assert.equal(reply.status, 409);
  assert.ok(reply.text.includes("thread_closed"));
  assert.equal(await exists(policyFile), false);
});
