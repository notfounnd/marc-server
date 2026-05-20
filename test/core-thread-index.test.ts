import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { BackgroundThreadIndexReconciler } from "../src/core/thread-index.js";
import type {
  ThreadIndexSnapshot,
  ThreadIndexStore
} from "../src/core/types.js";
import {
  createThread,
  listThreads,
  listThreadsCached,
  readThread,
  readWorkspaceStatus,
  rebuildThreadIndexInBackground
} from "../src/core/workspace.js";

async function tempWorkspace(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "marc-core-"));
}

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
} {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test("lists open and closed threads from SUMMARY.md state", async () => {
  const workspace = await tempWorkspace();
  const older = await createThread(workspace, "Older open");
  const newer = await createThread(workspace, "Newer open");
  const olderClosed = await createThread(workspace, "Older closed work");
  const newerClosed = await createThread(workspace, "Newer closed work");
  const olderClosedAt = "2026-05-01T10:00:00.000Z";
  const newerClosedAt = "2026-05-02T10:00:00.000Z";

  await fs.writeFile(
    path.join(workspace, ".marc", "threads", olderClosed.id, "SUMMARY.md"),
    [
      "# Executive Summary",
      "",
      `Thread: \`${olderClosed.id}\``,
      `Closed: \`${olderClosedAt}\``,
      "",
      "- Done."
    ].join("\n")
  );
  await fs.writeFile(
    path.join(workspace, ".marc", "threads", newerClosed.id, "SUMMARY.md"),
    [
      "# Executive Summary",
      "",
      `Thread: \`${newerClosed.id}\``,
      `Closed: \`${newerClosedAt}\``,
      "",
      "- Done."
    ].join("\n")
  );

  const openThreads = await listThreads(workspace);
  const closedThreads = await listThreads(workspace, { status: "closed" });
  const allThreads = await listThreads(workspace, { status: "all" });
  const transcript = await readThread(workspace, newerClosed.id);

  assert.deepEqual(
    openThreads.map((thread) => thread.id),
    [newer.id, older.id]
  );
  assert.deepEqual(
    closedThreads.map((thread) => thread.id),
    [newerClosed.id, olderClosed.id]
  );
  assert.equal(closedThreads[0].status, "closed");
  assert.equal(closedThreads[0].closedAt, newerClosedAt);
  assert.match(closedThreads[0].summaryPath ?? "", /SUMMARY\.md$/);
  assert.deepEqual(
    allThreads.map((thread) => thread.id),
    [newer.id, older.id, newerClosed.id, olderClosed.id]
  );
  assert.match(transcript.summary ?? "", /Executive Summary/);
});

test("reconciles missing JSON index entries from thread files", async () => {
  const workspace = await tempWorkspace();
  const closed = await createThread(workspace, "Closed from disk");
  const closedAt = "2026-05-01T11:00:00.000Z";

  await fs.writeFile(
    path.join(workspace, ".marc", "threads", closed.id, "SUMMARY.md"),
    [
      "# Executive Summary",
      "",
      `Thread: \`${closed.id}\``,
      `Closed: \`${closedAt}\``,
      "",
      "- Done."
    ].join("\n")
  );

  await listThreads(workspace, { status: "all" });

  const indexPath = path.join(workspace, ".marc", "cache", "thread-index.json");
  const index = JSON.parse(await fs.readFile(indexPath, "utf8")) as {
    threads: Array<{ id: string }>;
  };
  index.threads = index.threads.filter((thread) => thread.id !== closed.id);
  await fs.writeFile(indexPath, JSON.stringify(index));

  const closedThreads = await listThreads(workspace, { status: "closed" });

  assert.equal(closedThreads.length, 1);
  assert.equal(closedThreads[0].id, closed.id);
  assert.equal(closedThreads[0].status, "closed");
  assert.equal(closedThreads[0].closedAt, closedAt);
});

test("handles concurrent thread index rebuilds", async () => {
  const workspace = await tempWorkspace();
  const closed = await createThread(workspace, "Concurrent closed");
  const open = await createThread(workspace, "Concurrent open");

  await fs.writeFile(
    path.join(workspace, ".marc", "threads", closed.id, "SUMMARY.md"),
    "# Executive Summary\n\nClosed: `2026-05-01T13:00:00.000Z`\n"
  );

  const results = await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      listThreads(workspace, { status: index % 2 === 0 ? "all" : "closed" })
    )
  );

  assert.ok(
    results.some((threads) => threads.some((thread) => thread.id === open.id))
  );
  assert.ok(
    results.every((threads) =>
      threads.some((thread) => thread.id === closed.id)
    )
  );
});

test("serves cached thread index entries while a background rebuild is running", async () => {
  const workspace = await tempWorkspace();
  const cached = await createThread(workspace, "Cached thread");
  const fresh = await createThread(workspace, "Fresh thread");
  const threadsRoot = path.join(workspace, ".marc", "threads");
  const saveGate = deferred();
  const initialSnapshot: ThreadIndexSnapshot = {
    version: 1,
    updatedAt: "2026-05-01T10:00:00.000Z",
    threads: [
      {
        id: cached.id,
        title: cached.title,
        path: cached.path,
        createdAt: cached.createdAt,
        status: "open",
        chatMtimeMs: 1
      }
    ]
  };
  let snapshot = initialSnapshot;
  let saves = 0;
  const store: ThreadIndexStore = {
    async load() {
      return snapshot;
    },
    async save(nextSnapshot) {
      saves += 1;
      await saveGate.promise;
      snapshot = nextSnapshot;
    },
    async clear() {
      snapshot = undefined as unknown as ThreadIndexSnapshot;
    }
  };
  const reconciler = new BackgroundThreadIndexReconciler(threadsRoot, store);

  const rebuild = reconciler.rebuild();
  const staleThreads = await reconciler.list({ status: "all" });
  const healthDuringRebuild = await reconciler.health();

  assert.deepEqual(
    staleThreads.map((thread) => thread.id),
    [cached.id]
  );
  assert.equal(healthDuringRebuild.status, "rebuilding");
  assert.equal(healthDuringRebuild.rebuilding, true);
  assert.equal(healthDuringRebuild.threadCount, 1);

  saveGate.resolve();
  await rebuild;

  const freshThreads = await reconciler.list({ status: "all" });

  assert.equal(saves, 1);
  assert.deepEqual(
    freshThreads.map((thread) => thread.id),
    [fresh.id, cached.id]
  );
});

test("marks cached thread index as degraded when a background rebuild fails", async () => {
  const workspace = await tempWorkspace();
  const cached = await createThread(workspace, "Cached degraded thread");
  const initialSnapshot: ThreadIndexSnapshot = {
    version: 1,
    updatedAt: "2026-05-01T10:00:00.000Z",
    threads: [
      {
        id: cached.id,
        title: cached.title,
        path: cached.path,
        createdAt: cached.createdAt,
        status: "open",
        chatMtimeMs: 1
      }
    ]
  };
  const store: ThreadIndexStore = {
    async load() {
      return initialSnapshot;
    },
    async save() {
      throw new Error("disk is unavailable");
    },
    async clear() {}
  };
  const reconciler = new BackgroundThreadIndexReconciler(
    path.join(workspace, ".marc", "threads"),
    store
  );

  await assert.rejects(() => reconciler.rebuild(), /disk is unavailable/);

  const health = await reconciler.health();
  const staleThreads = await reconciler.list({ status: "all" });

  assert.equal(health.status, "degraded");
  assert.equal(health.rebuilding, false);
  assert.equal(health.lastError, "disk is unavailable");
  assert.equal(health.threadCount, 1);
  assert.deepEqual(
    staleThreads.map((thread) => thread.id),
    [cached.id]
  );
});

test("workspace status reports background thread index health", async () => {
  const workspace = await tempWorkspace();
  const thread = await createThread(workspace, "Workspace status thread");

  await rebuildThreadIndexInBackground(workspace);

  const cachedThreads = await listThreadsCached(workspace, { status: "all" });
  const status = await readWorkspaceStatus(workspace);

  assert.deepEqual(
    cachedThreads.map((item) => item.id),
    [thread.id]
  );
  assert.equal(status.ok, true);
  assert.equal(status.modules.threadIndex.status, "ready");
  assert.equal(status.modules.threadIndex.rebuilding, false);
  assert.equal(status.modules.threadIndex.threadCount, 1);
});

test("removing SUMMARY.md reopens the thread", async () => {
  const workspace = await tempWorkspace();
  const thread = await createThread(workspace, "Reopen me");
  const summaryPath = path.join(
    workspace,
    ".marc",
    "threads",
    thread.id,
    "SUMMARY.md"
  );

  await fs.writeFile(
    summaryPath,
    "# Executive Summary\n\nClosed: `2026-05-01T12:00:00.000Z`\n"
  );
  assert.deepEqual(
    (await listThreads(workspace, { status: "closed" })).map((item) => item.id),
    [thread.id]
  );

  await fs.unlink(summaryPath);

  const openThreads = await listThreads(workspace);
  assert.deepEqual(
    openThreads.map((item) => item.id),
    [thread.id]
  );
  assert.equal(openThreads[0].status, "open");
});
