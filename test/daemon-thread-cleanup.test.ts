import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { threadFolderOf } from "../src/daemon/events.js";
import {
  createSessionRegistry,
  type SessionProbe
} from "../src/daemon/session-registry.js";
import { removeClosedThreads } from "../src/daemon/thread-cleanup.js";
import {
  createThread,
  initWorkspace,
  writeThreadSummary
} from "../src/core/workspace.js";
import {
  clock,
  listNames,
  stateHarness,
  threadPath
} from "./daemon-thread-state-fixtures.js";

const FREE: SessionProbe = async () => ({
  state: "unbound",
  details: {
    busy: false,
    listening: false,
    reason: "test",
    pastConflict: false
  }
});

test("startup removes the state of threads that already have a SUMMARY.md and keeps the open ones", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const root = await fs.mkdtemp(path.join(h.dataDir, "..", "marc-cleanup-ws-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const info = await initWorkspace(root);
  const closed = await createThread(root, "Closed work");
  const open = await createThread(root, "Open work");
  await writeThreadSummary(root, { threadId: closed.id, body: "Done." });

  const registry = createSessionRegistry(h.dataDir, { now: clock }, h.threads);
  await registry.acquire(
    {
      slot: {
        workspaceId: info.id,
        threadId: closed.id,
        profile: "claude-dev"
      },
      expectedGeneration: 0,
      hostId: "host-a"
    },
    FREE
  );
  await registry.acquire(
    {
      slot: { workspaceId: info.id, threadId: open.id, profile: "claude-dev" },
      expectedGeneration: 0,
      hostId: "host-a"
    },
    FREE
  );

  await removeClosedThreads([info], h.threads);

  assert.deepEqual(await listNames(path.join(h.dataDir, "threads", info.id)), [
    `${open.id}.json`,
    `${open.id}.meta.json`
  ]);
  await assert.rejects(fs.access(threadPath(h.dataDir, info.id, closed.id)));
});

test("a removed closed thread leaves no marker behind, so it cannot read as lost", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const root = await fs.mkdtemp(
    path.join(h.dataDir, "..", "marc-cleanup-marker-")
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const info = await initWorkspace(root);
  const closed = await createThread(root, "Closed work");
  await writeThreadSummary(root, { threadId: closed.id, body: "Done." });
  const registry = createSessionRegistry(h.dataDir, { now: clock }, h.threads);
  await registry.acquire(
    {
      slot: {
        workspaceId: info.id,
        threadId: closed.id,
        profile: "claude-dev"
      },
      expectedGeneration: 0,
      hostId: "host-a"
    },
    FREE
  );

  await removeClosedThreads([info], h.threads);

  assert.deepEqual(
    await h.threads.read({ workspaceId: info.id, threadId: closed.id }),
    {
      status: "ready",
      file: { version: 1, generation: 0, slots: {} },
      exists: false
    }
  );
});

const FOLDER_CASES: ReadonlyArray<{
  name: string;
  filename: string | null;
  threadId: string | undefined;
}> = [
  {
    name: "the summary, POSIX separators",
    filename: "threads/abc-123/SUMMARY.md",
    threadId: "abc-123"
  },
  {
    name: "the summary, Windows separators",
    filename: "threads\\abc-123\\SUMMARY.md",
    threadId: "abc-123"
  },
  {
    name: "the temporary name of an atomic summary write",
    filename: "threads\\abc-123\\.SUMMARY.md.1.uuid.tmp",
    threadId: "abc-123"
  },
  {
    name: "the chat file of the thread",
    filename: "threads/abc-123/CHAT.md",
    threadId: "abc-123"
  },
  {
    name: "an artifact inside the thread",
    filename: "threads/abc-123/artifacts/plan.md",
    threadId: "abc-123"
  },
  {
    name: "the thread folder itself",
    filename: "threads\\abc-123",
    threadId: undefined
  },
  {
    name: "a file outside the threads folder",
    filename: "SUMMARY.md",
    threadId: undefined
  },
  { name: "an unnamed change", filename: null, threadId: undefined }
];

for (const row of FOLDER_CASES) {
  test(`the watcher maps a change to its thread folder: ${row.name}`, () => {
    assert.equal(threadFolderOf(row.filename), row.threadId);
  });
}

test("the watcher also accepts the Buffer name that Node may report", () => {
  assert.equal(
    threadFolderOf(Buffer.from("threads\\abc-123\\CHAT.md")),
    "abc-123"
  );
});
