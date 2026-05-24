import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  withWorkspaceWriteLock,
  workspaceWriteLockPath,
  writeFileAtomically
} from "../src/core/write-coordination.js";

async function tempMarcPath(): Promise<string> {
  const workspace = await fs.mkdtemp(
    path.join(os.tmpdir(), "marc-write-lock-")
  );
  const marcPath = path.join(workspace, ".marc");
  await fs.mkdir(path.join(marcPath, "cache"), { recursive: true });
  return marcPath;
}

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("serializes writers targeting the same workspace resource", async () => {
  const marcPath = await tempMarcPath();
  const releaseFirst = deferred();
  const firstStarted = deferred();
  const events: string[] = [];

  const first = withWorkspaceWriteLock(marcPath, "thread:shared", async () => {
    events.push("first-start");
    firstStarted.resolve();
    await releaseFirst.promise;
    events.push("first-end");
  });
  await firstStarted.promise;

  const second = withWorkspaceWriteLock(marcPath, "thread:shared", async () => {
    events.push("second-start");
    events.push("second-end");
  });
  await new Promise((resolve) => setTimeout(resolve, 25));

  assert.deepEqual(events, ["first-start"]);

  releaseFirst.resolve();
  await Promise.all([first, second]);

  assert.deepEqual(events, [
    "first-start",
    "first-end",
    "second-start",
    "second-end"
  ]);
});

test("times out without entering a resource held by another writer", async () => {
  const marcPath = await tempMarcPath();
  const releaseFirst = deferred();
  const firstStarted = deferred();

  const first = withWorkspaceWriteLock(
    marcPath,
    "agent:codex-dev",
    async () => {
      firstStarted.resolve();
      await releaseFirst.promise;
    }
  );
  await firstStarted.promise;

  await assert.rejects(
    withWorkspaceWriteLock(marcPath, "agent:codex-dev", async () => undefined, {
      retryDelayMs: 5,
      timeoutMs: 20
    }),
    /Timed out acquiring write lock/
  );

  releaseFirst.resolve();
  await first;
});

test("recovers a stale write lock before executing the writer", async () => {
  const marcPath = await tempMarcPath();
  const lockPath = workspaceWriteLockPath(marcPath, "recommendations");
  const oldTime = new Date(Date.now() - 5_000);
  await fs.mkdir(lockPath, { recursive: true });
  await fs.utimes(lockPath, oldTime, oldTime);

  let executed = false;
  await withWorkspaceWriteLock(
    marcPath,
    "recommendations",
    async () => {
      executed = true;
    },
    { retryDelayMs: 1, staleAfterMs: 10, timeoutMs: 100 }
  );

  assert.equal(executed, true);
});

test("replaces files only after complete content has been written", async () => {
  const marcPath = await tempMarcPath();
  const targetPath = path.join(marcPath, "threads", "shared", "CHAT.md");
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, "old content");

  await writeFileAtomically(targetPath, "new complete content");

  assert.equal(await fs.readFile(targetPath, "utf8"), "new complete content");
  const directory = await fs.readdir(path.dirname(targetPath));
  assert.deepEqual(directory, ["CHAT.md"]);
});
